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
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse  = require("pdf-parse")  as (buf: Buffer) => Promise<{ text: string }>;
const mammoth   = require("mammoth")    as { extractRawText(input: { buffer: Buffer }): Promise<{ value: string }> };
const XLSX      = require("xlsx")       as typeof import("xlsx");

const GROQ_API_URL        = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL          = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL   = "meta-llama/llama-4-scout-17b-16e-instruct"; // Soporta vision

// ─── Tipos de archivo soportados ─────────────────────────────────────────────
const TIPOS_TEXTO   = [".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml", ".log"];
const TIPOS_PDF     = [".pdf"];
const TIPOS_WORD    = [".docx", ".doc"];
const TIPOS_EXCEL   = [".xlsx", ".xls", ".ods"];
const TIPOS_IMAGEN  = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
const TODOS_TIPOS   = [...TIPOS_PDF, ...TIPOS_WORD, ...TIPOS_EXCEL, ...TIPOS_TEXTO, ...TIPOS_IMAGEN];

function getExtension(name: string): string {
  return name.toLowerCase().substring(name.lastIndexOf("."));
}

function getTipoLabel(ext: string): string {
  if (TIPOS_PDF.includes(ext))    return "PDF";
  if (TIPOS_WORD.includes(ext))   return "Word";
  if (TIPOS_EXCEL.includes(ext))  return "Excel";
  if (TIPOS_IMAGEN.includes(ext)) return "Imagen";
  return "Texto";
}

// ─── Parsear archivo según su tipo ───────────────────────────────────────────
async function parsearArchivo(
  buffer: Buffer,
  ext: string,
  url: string
): Promise<{ texto: string; esImagen: boolean }> {
  // PDF
  if (TIPOS_PDF.includes(ext)) {
    const parsed = await pdfParse(buffer);
    return { texto: parsed.text.trim(), esImagen: false };
  }

  // Word
  if (TIPOS_WORD.includes(ext)) {
    const result = await mammoth.extractRawText({ buffer });
    return { texto: result.value.trim(), esImagen: false };
  }

  // Excel
  if (TIPOS_EXCEL.includes(ext)) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const lineas: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws);
      lineas.push(`=== Hoja: ${sheetName} ===\n${csv}`);
    }
    return { texto: lineas.join("\n\n").trim(), esImagen: false };
  }

  // Imagen
  if (TIPOS_IMAGEN.includes(ext)) {
    return { texto: url, esImagen: true };
  }

  // Texto plano y demás
  return { texto: buffer.toString("utf-8").trim(), esImagen: false };
}

// ─── Describir imagen con Groq Vision ────────────────────────────────────────
async function describirImagen(imageUrl: string, groqKey: string): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe detalladamente el contenido de esta imagen en español. Extrae todo el texto visible, tablas, datos, etc.",
            },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  }) as any;

  if (!res.ok) throw new Error(`Groq Vision error: ${res.status}`);
  const data = (await res.json()) as any;
  return data?.choices?.[0]?.message?.content?.trim() ?? "No se pudo describir la imagen.";
}

// ─── Comando ─────────────────────────────────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName("tryout")
  .setDescription("Sistema de conocimiento IA para Sonora RP (solo admins).")

  .addSubcommand((sub) =>
    sub
      .setName("ia")
      .setDescription("Carga conocimiento (archivo o texto) y/o consulta la IA (solo admins).")
      .addStringOption((opt) =>
        opt
          .setName("pregunta")
          .setDescription("Pregunta basada en el conocimiento cargado.")
          .setRequired(false)
          .setMaxLength(800)
      )
      .addAttachmentOption((opt) =>
        opt
          .setName("archivo")
          .setDescription("PDF, Word, Excel, imagen, TXT, etc.")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("texto")
          .setDescription("Escribe o pega texto para que la IA lo memorice.")
          .setRequired(false)
          .setMaxLength(4000)
      )
      .addStringOption((opt) =>
        opt
          .setName("modo")
          .setDescription("¿Reemplazar el conocimiento actual o añadir? (default: reemplazar)")
          .setRequired(false)
          .addChoices(
            { name: "Reemplazar todo", value: "reemplazar" },
            { name: "Añadir al conocimiento actual", value: "añadir" }
          )
      )
  )

  .addSubcommand((sub) =>
    sub
      .setName("limpiar")
      .setDescription("Elimina TODO el conocimiento almacenado en la IA (solo admins).")
  )

  .addSubcommand((sub) =>
    sub
      .setName("info")
      .setDescription("Muestra qué conocimiento tiene cargado la IA actualmente (solo admins).")
  );

// ─── Handler ─────────────────────────────────────────────────────────────────
const command: Command = {
  data,
  adminOnly: false,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Solo los administradores pueden usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub      = interaction.options.getSubcommand();
    const guildId  = interaction.guildId ?? "global";

    const thumbnailUrl =
      interaction.guild?.iconURL({ extension: "png", size: 256, forceStatic: true }) ??
      interaction.client.user?.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }) ??
      "https://i.imgur.com/AfFp7pu.png";

    // ── Función helper: construir embed base ─────────────────────────────────
    const buildContainer = (color: number, title: string, body: string, footer?: string) =>
      new ContainerBuilder()
        .setAccentColor(color)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(title))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl))
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(body))
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Sonora RP · Tryout IA · ${footer ?? getFooterTimestamp()}`
          )
        );

    // ════════════════════════════════════════════════════════════════════════
    // /tryout limpiar
    // ════════════════════════════════════════════════════════════════════════
    if (sub === "limpiar") {
      const habia = documentCache.has(guildId);
      const info  = documentCache.get(guildId);
      documentCache.delete(guildId);

      await interaction.editReply({
        components: [
          buildContainer(
            habia ? 0xef4444 : 0x6b7280,
            "# Tryout IA · Conocimiento Eliminado",
            habia
              ? `✅ El conocimiento **\`${info?.filename}\`** ha sido eliminado.\nLa IA responderá de forma general a partir de ahora.`
              : "ℹ️ No había ningún conocimiento cargado."
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // /tryout info
    // ════════════════════════════════════════════════════════════════════════
    if (sub === "info") {
      const cachedDoc = documentCache.get(guildId);

      await interaction.editReply({
        components: [
          buildContainer(
            cachedDoc ? 0x2ecc71 : 0x6b7280,
            "# Tryout IA · Estado del Conocimiento",
            cachedDoc
              ? [
                  `› **Estado:** ✅ Conocimiento activo`,
                  `› **Fuente:** \`${cachedDoc.filename}\``,
                  `› **Caracteres almacenados:** \`${cachedDoc.text.length.toLocaleString("es-MX")}\``,
                  ``,
                  `Usa \`/tryout ia pregunta:[...]\` o \`/chatgpt\` para consultarlo.`,
                  `Usa \`/tryout limpiar\` para borrar el conocimiento.`,
                ].join("\n")
              : [
                  `› **Estado:** ❌ Sin conocimiento cargado`,
                  ``,
                  `Usa \`/tryout ia archivo:[archivo]\` o \`/tryout ia texto:[...]\` para cargar.`,
                ].join("\n")
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // /tryout ia
    // ════════════════════════════════════════════════════════════════════════
    const attachment  = interaction.options.getAttachment("archivo");
    const textoInput  = interaction.options.getString("texto");
    const pregunta    = interaction.options.getString("pregunta");
    const modo        = interaction.options.getString("modo") ?? "reemplazar";

    if (!attachment && !textoInput && !pregunta) {
      await interaction.editReply({
        content: "❌ Debes proporcionar al menos: `archivo`, `texto`, o `pregunta`.",
      });
      return;
    }

    let nuevoTexto  = "";
    let nuevaFuente = "";
    let seCargoAlgo = false;

    // ── Procesar archivo ─────────────────────────────────────────────────────
    if (attachment) {
      const ext = getExtension(attachment.name);

      if (!TODOS_TIPOS.includes(ext)) {
        await interaction.editReply({
          content: [
            `❌ Tipo de archivo no soportado: \`${ext}\``,
            `Tipos aceptados: PDF, Word, Excel, TXT, MD, CSV, JSON, YAML, XML, PNG, JPG, GIF, WEBP.`,
          ].join("\n"),
        });
        return;
      }

      // Descargar
      let fileBuffer: Buffer;
      try {
        const res: any = await fetch(attachment.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        fileBuffer = Buffer.from(await res.arrayBuffer());
      } catch (err) {
        console.error("[TRYOUT_IA] Error descargando archivo:", err);
        await interaction.editReply({ content: "❌ No se pudo descargar el archivo." });
        return;
      }

      // Parsear
      try {
        const { texto, esImagen } = await parsearArchivo(fileBuffer, ext, attachment.url);

        if (esImagen) {
          // Usar Groq Vision para describir la imagen
          if (!config.groqApiKey) {
            await interaction.editReply({ content: "❌ No hay API Key de Groq configurada." });
            return;
          }
          try {
            const descripcion = await describirImagen(attachment.url, config.groqApiKey);
            nuevoTexto  = `[Contenido de imagen "${attachment.name}"]:\n${descripcion}`;
            nuevaFuente = `Imagen: ${attachment.name}`;
          } catch (err) {
            console.error("[TRYOUT_IA] Error en Groq Vision:", err);
            await interaction.editReply({
              content: "❌ No se pudo analizar la imagen con IA.",
            });
            return;
          }
        } else {
          if (!texto || texto.length < 5) {
            await interaction.editReply({
              content: "⚠️ El archivo no contiene texto legible.",
            });
            return;
          }
          nuevoTexto  = texto;
          nuevaFuente = `${getTipoLabel(ext)}: ${attachment.name}`;
        }

        seCargoAlgo = true;
      } catch (err) {
        console.error("[TRYOUT_IA] Error parseando archivo:", err);
        await interaction.editReply({
          content: `❌ No se pudo procesar el archivo \`${attachment.name}\`. ¿Está dañado o protegido?`,
        });
        return;
      }
    }

    // ── Procesar texto manual ─────────────────────────────────────────────────
    if (textoInput?.trim()) {
      const textoLimpio = textoInput.trim();
      if (seCargoAlgo) {
        nuevoTexto  = nuevoTexto + "\n\n" + textoLimpio;
        nuevaFuente = `${nuevaFuente} + texto manual`;
      } else {
        nuevoTexto  = textoLimpio;
        nuevaFuente = "Texto manual";
      }
      seCargoAlgo = true;
    }

    // ── Guardar en cache ──────────────────────────────────────────────────────
    if (seCargoAlgo) {
      const existente = documentCache.get(guildId);

      if (modo === "añadir" && existente) {
        documentCache.set(guildId, {
          text:     existente.text + "\n\n" + nuevoTexto,
          filename: `${existente.filename} + ${nuevaFuente}`,
        });
      } else {
        documentCache.set(guildId, { text: nuevoTexto, filename: nuevaFuente });
      }

      // Solo confirmar carga si no hay pregunta
      if (!pregunta) {
        const cached = documentCache.get(guildId)!;

        await interaction.editReply({
          components: [
            buildContainer(
              0x2ecc71,
              "# Tryout IA · Conocimiento Cargado",
              [
                `› **Fuente:** \`${cached.filename}\``,
                `› **Modo:** \`${modo === "añadir" ? "Añadido al conocimiento anterior" : "Reemplazado"}\``,
                `› **Caracteres totales:** \`${cached.text.length.toLocaleString("es-MX")}\``,
                `› **Estado:** ✅ Listo para consultas`,
                ``,
                `Puedes consultar con \`/tryout ia pregunta:[...]\` o \`/chatgpt pregunta:[...]\`.`,
                `Para borrar: \`/tryout limpiar\` · Para ver estado: \`/tryout info\``,
              ].join("\n")
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
        return;
      }
    }

    // ── Responder pregunta ────────────────────────────────────────────────────
    if (!pregunta) {
      await interaction.editReply({
        content: "❌ Proporciona `archivo`, `texto`, o una `pregunta` si ya hay conocimiento cargado.",
      });
      return;
    }

    const cachedDoc = documentCache.get(guildId);
    if (!cachedDoc) {
      await interaction.editReply({
        content: "⚠️ No hay conocimiento cargado.\nUsa `/tryout ia archivo:[...]` o `/tryout ia texto:[...]` primero.",
      });
      return;
    }

    if (!config.groqApiKey) {
      await interaction.editReply({ content: "❌ No hay API Key de Groq configurada." });
      return;
    }

    const maxLen     = 12000;
    const docContext = cachedDoc.text.length > maxLen
      ? cachedDoc.text.substring(0, maxLen) + "\n\n[... contexto truncado ...]"
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
              content:
                `Eres un asistente inteligente de Sonora RP. ` +
                `Responde ÚNICAMENTE basándote en el siguiente conocimiento. ` +
                `Si la respuesta no está en el conocimiento, indícalo claramente. ` +
                `Responde siempre en español de forma clara y precisa.\n\n` +
                `--- CONOCIMIENTO: ${cachedDoc.filename} ---\n${docContext}\n--- FIN ---`,
            },
            { role: "user", content: pregunta },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      }) as any;

      if (!res.ok) {
        const err = (await res.json()) as any;
        await interaction.editReply({
          content: `❌ Error de Groq: \`${err?.error?.message ?? res.status}\``,
        });
        return;
      }

      const resData = (await res.json()) as any;
      respuesta = resData?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
    } catch (err) {
      console.error("[TRYOUT_IA] Error Groq:", err);
      await interaction.editReply({ content: "❌ Error al conectar con Groq AI." });
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
            new TextDisplayBuilder().setContent("# Tryout IA · Consulta")
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnailUrl))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Conocimiento activo:** \`${cachedDoc.filename}\`\n**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}`
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

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  },
};

export default command;
