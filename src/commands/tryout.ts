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
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number; info: any }>;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Cache en memoria: guildId → texto del documento cargado
const documentCache = new Map<string, { text: string; filename: string }>();

const data = new SlashCommandBuilder()
  .setName("tryout")
  .setDescription("Comandos de Tryout IA para Sonora RP.")
  .addSubcommand((sub) =>
    sub
      .setName("ia")
      .setDescription("Carga un PDF y/o consulta el documento cargado con IA (solo admins).")
      .addStringOption((opt) =>
        opt
          .setName("pregunta")
          .setDescription("Pregunta basada en el documento cargado.")
          .setRequired(false)
          .setMaxLength(800)
      )
      .addAttachmentOption((opt) =>
        opt
          .setName("pdf")
          .setDescription("Sube el PDF a cargar como base de conocimiento.")
          .setRequired(false)
      )
  );

const command: Command = {
  data,
  adminOnly: false,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Solo admins
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Solo los administradores pueden usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const attachment = interaction.options.getAttachment("pdf");
    const pregunta = interaction.options.getString("pregunta");
    const guildId = interaction.guildId ?? "global";

    const thumbnailUrl =
      interaction.guild?.iconURL({ extension: "png", size: 256, forceStatic: true }) ??
      interaction.client.user?.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }) ??
      "https://i.imgur.com/AfFp7pu.png";

    // ─── CASO 1: Se sube un PDF (con o sin pregunta) ─────────────────────────
    if (attachment) {
      // Validar que sea PDF
      if (
        !attachment.contentType?.includes("pdf") &&
        !attachment.name.toLowerCase().endsWith(".pdf")
      ) {
        await interaction.editReply({
          content: "❌ El archivo debe ser un PDF válido.",
        });
        return;
      }

      // Descargar el PDF
      let pdfBuffer: Buffer;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await fetch(attachment.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        pdfBuffer = Buffer.from(arrayBuffer);
      } catch (err) {
        console.error("[TRYOUT_IA] Error descargando PDF:", err);
        await interaction.editReply({
          content: "❌ No se pudo descargar el PDF. Inténtalo de nuevo.",
        });
        return;
      }



      // Parsear el texto del PDF
      let docText = "";
      try {
        const parsed = await pdfParse(pdfBuffer);
        docText = parsed.text.trim();
      } catch (err) {
        console.error("[TRYOUT_IA] Error parseando PDF:", err);
        await interaction.editReply({
          content: "❌ No se pudo leer el contenido del PDF. Asegúrate de que el archivo no esté protegido.",
        });
        return;
      }

      if (!docText || docText.length < 10) {
        await interaction.editReply({
          content: "⚠️ El PDF no contiene texto legible (puede estar escaneado como imagen).",
        });
        return;
      }

      // Guardar en cache
      documentCache.set(guildId, { text: docText, filename: attachment.name });

      // Si no hay pregunta, solo confirmar la carga
      if (!pregunta) {
        const container = new ContainerBuilder()
          .setAccentColor(0x2ecc71)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# Tryout IA · Documento Cargado")
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl))
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `› **Archivo:** \`${attachment.name}\``,
                `› **Caracteres extraídos:** \`${docText.length.toLocaleString("es-MX")}\``,
                `› **Estado:** ✅ Listo para consultas`,
                ``,
                `Ahora puedes usar \`/tryout ia pregunta:[tu pregunta]\` para consultar el documento.`,
              ].join("\n")
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Sonora RP · Tryout IA · ${getFooterTimestamp()}`)
          );

        await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
    }

    // ─── CASO 2: Hay pregunta (con o sin PDF ya cargado) ─────────────────────
    if (!pregunta) {
      await interaction.editReply({
        content: "❌ Debes proporcionar un `pdf` para cargar, o una `pregunta` si ya cargaste un documento.",
      });
      return;
    }

    const cachedDoc = documentCache.get(guildId);
    if (!cachedDoc) {
      await interaction.editReply({
        content: "⚠️ No hay ningún documento cargado. Sube primero un PDF con `/tryout ia pdf:[archivo]`.",
      });
      return;
    }

    if (!config.groqApiKey) {
      await interaction.editReply({
        content: "❌ No hay API Key de Groq configurada (`GROQ_API_KEY`).",
      });
      return;
    }

    // Truncar documento si es muy largo para el contexto (Groq tiene límite de tokens)
    const maxDocLength = 12000;
    const docContext = cachedDoc.text.length > maxDocLength
      ? cachedDoc.text.substring(0, maxDocLength) + "\n\n[... documento truncado por límite de contexto ...]"
      : cachedDoc.text;

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
              content: `Eres un asistente inteligente de Sonora RP. Responde únicamente basándote en el siguiente documento. Si la respuesta no está en el documento, indícalo claramente. Responde siempre en español de forma clara y precisa.\n\n--- DOCUMENTO: ${cachedDoc.filename} ---\n${docContext}\n--- FIN DEL DOCUMENTO ---`,
            },
            {
              role: "user",
              content: pregunta,
            },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      }) as any;

      if (!res.ok) {
        const errData = (await res.json()) as any;
        console.error("[TRYOUT_IA] Error Groq:", errData);
        await interaction.editReply({
          content: `❌ Error de Groq: \`${errData?.error?.message ?? res.status}\``,
        });
        return;
      }

      const data = (await res.json()) as any;
      respuesta = data?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
    } catch (err) {
      console.error("[TRYOUT_IA] Error en fetch:", err);
      await interaction.editReply({
        content: "❌ Error al conectar con Groq AI.",
      });
      return;
    }

    if (respuesta.length > 3900) {
      respuesta = respuesta.substring(0, 3900) + "\n\n*(Respuesta truncada)*";
    }

    const container = new ContainerBuilder()
      .setAccentColor(0xf55036)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Tryout IA · Consulta de Documento")
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Documento activo:** \`${cachedDoc.filename}\`\n**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}`
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
        new TextDisplayBuilder().setContent(`-# Sonora RP · Tryout IA · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
