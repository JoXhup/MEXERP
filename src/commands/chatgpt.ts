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
            {
              role: "system",
              content:
                "Eres un asistente útil del servidor de Discord 'Sonora RP'. Responde de forma clara y concisa en español.",
            },
            {
              role: "user",
              content: pregunta,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
      }) as any;

      if (!res.ok) {
        const errData = (await res.json()) as any;
        console.error("[GROQ] Error de API:", errData);
        await interaction.editReply({
          content: `❌ Error de Groq: \`${errData?.error?.message ?? res.status}\``,
        });
        return;
      }

      const data = (await res.json()) as any;
      respuesta = data?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
    } catch (err) {
      console.error("[GROQ] Error en fetch:", err);
      await interaction.editReply({
        content: "❌ Error al conectar con Groq AI.",
      });
      return;
    }

    // Truncar si la respuesta supera el límite de Discord
    if (respuesta.length > 3900) {
      respuesta = respuesta.substring(0, 3900) + "\n\n*(Respuesta truncada)*";
    }

    // Usar icono del servidor como thumbnail (URL estable, no expira como avatares de usuario)
    const thumbnailUrl =
      interaction.guild?.iconURL({ extension: "png", size: 256, forceStatic: true }) ??
      interaction.client.user?.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }) ??
      "https://i.imgur.com/AfFp7pu.png";

    const container = new ContainerBuilder()
      .setAccentColor(0xf55036) // Color Groq
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
          `**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}`
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
        new TextDisplayBuilder().setContent(`-# Sonora RP · Asistente Virtual · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
