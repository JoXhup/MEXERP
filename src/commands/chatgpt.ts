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

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chatgpt")
    .setDescription("Consulta algo a ChatGPT (solo administradores).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("pregunta")
        .setDescription("¿Qué quieres preguntarle a ChatGPT?")
        .setRequired(true)
        .setMaxLength(1000)
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Solo admins (doble verificación por si acaso)
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Solo los administradores pueden usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const pregunta = interaction.options.getString("pregunta", true);

    // Defer con ephemeral mientras esperamos respuesta de OpenAI
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!config.openaiApiKey) {
      await interaction.editReply({
        content: "❌ No hay API Key de OpenAI configurada.",
      });
      return;
    }

    let respuesta = "";
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente útil del servidor de Discord 'Tamaulipas RP'. Responde de forma clara y concisa en español.",
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
        console.error("[CHATGPT] Error de OpenAI:", errData);
        await interaction.editReply({
          content: `❌ Error de OpenAI: \`${errData?.error?.message ?? res.status}\``,
        });
        return;
      }

      const data = (await res.json()) as any;
      respuesta = data?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
    } catch (err) {
      console.error("[CHATGPT] Error en fetch:", err);
      await interaction.editReply({
        content: "❌ Error al conectar con OpenAI.",
      });
      return;
    }

    // Truncar si la respuesta es muy larga para Discord (4096 char limit)
    if (respuesta.length > 3900) {
      respuesta = respuesta.substring(0, 3900) + "\n\n*(Respuesta truncada)*";
    }

    const avatarUrl = interaction.user.displayAvatarURL({ extension: "png", size: 256 });

    const container = new ContainerBuilder()
      .setAccentColor(0x10a37f) // Verde de OpenAI
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# 🤖 ChatGPT")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(avatarUrl)
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
        new TextDisplayBuilder().setContent(`-# Tamaulipas RP · ChatGPT · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
