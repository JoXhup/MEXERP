import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { config } from "../config.js";
import { getFooterTimestamp } from "../utils/components.js";
import { documentCache } from "../utils/documentCache.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chatgpt")
    .setDescription("Consulta algo al Asistente Virtual de Sonora RP (solo administradores).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("pregunta")
        .setDescription("¿Qué quieres preguntar?")
        .setRequired(true)
        .setMaxLength(1000)
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Solo los administradores pueden usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pregunta = interaction.options.getString("pregunta", true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!config.groqApiKey) {
      await interaction.editReply({
        content: "❌ No hay API Key de Groq configurada (`GROQ_API_KEY`).",
      });
      return;
    }

    // ─── Verificar si hay documentos cargados via /tryout ia ─────────────────
    const guildId = interaction.guildId ?? "global";
    const combined = documentCache.getCombined(guildId);

    let systemPrompt: string;
    let modoDoc = false;

    if (combined.count > 0) {
      modoDoc = true;
      systemPrompt =
        `Eres un asistente inteligente de Sonora RP. Hay (${combined.count}) documento(s)/fuente(s) de conocimiento activa(s).\n` +
        `Si la pregunta está relacionada con el conocimiento cargado, responde ÚNICAMENTE basándote en su contenido.\n` +
        `Si la pregunta no tiene relación, responde de forma general en español.\n\n` +
        `--- CONOCIMIENTO CARGADO (${combined.sources}) ---\n${combined.text}\n--- FIN DEL CONOCIMIENTO ---`;
    } else {
      systemPrompt =
        "Eres un asistente útil del servidor de Discord 'Sonora RP'. " +
        "Responde de forma clara y concisa en español.";
    }

    let respuesta = "";
    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: pregunta },
          ],
          max_tokens: 1000,
          temperature: modoDoc ? 0.3 : 0.7,
        }),
      }) as any;

      if (!res.ok) {
        const errData = await res.json() as any;
        console.error("[GROQ] Error de API:", errData);
        await interaction.editReply({
          content: `❌ Error de Groq: \`${errData?.error?.message ?? res.status}\``,
        });
        return;
      }

      const data = await res.json() as any;
      respuesta = data?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
    } catch (err) {
      console.error("[GROQ] Error en fetch:", err);
      await interaction.editReply({ content: "❌ Error al conectar con Groq AI." });
      return;
    }

    if (respuesta.length > 3900) {
      respuesta = respuesta.substring(0, 3900) + "\n\n*(Respuesta truncada)*";
    }

    // Thumbnail: icono del servidor
    const thumbnailUrl =
      interaction.guild?.iconURL({ extension: "png", size: 256, forceStatic: true }) ??
      interaction.client.user?.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }) ??
      "https://i.imgur.com/AfFp7pu.png";

    const docInfo = modoDoc
      ? `**Conocimiento activo (${combined.count}):** \`${combined.sources}\`\n`
      : "";

    const container = new ContainerBuilder()
      .setAccentColor(0xf55036)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Asistente Virtual · Sinaloa RP")
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(thumbnailUrl)
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${docInfo}**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Respuesta:**\n${respuesta}`)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Sonora RP · Asistente Virtual${modoDoc ? ` · ${combined.count} Fuentes` : ""} · ${getFooterTimestamp()}`
        )
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
