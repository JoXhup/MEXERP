import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type User,
  Routes,
} from "discord.js";
import { config } from "../config.js";
import { getFooterTimestamp } from "../utils/components.js";
import { documentCache } from "../utils/documentCache.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const mammoth  = require("mammoth")   as { extractRawText(input: { buffer: Buffer }): Promise<{ value: string }> };
const XLSX     = require("xlsx")      as typeof import("xlsx");

// Extraer texto de PDF con unpdf y pdf-parse como fallback
async function extractPDFText(buf: Buffer): Promise<string> {
  // 1. Intentar con unpdf
  try {
    const { extractText } = await import("unpdf");
    const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = await extractText(uint8, { mergePages: true });

    let raw = "";
    if (typeof result?.text === "string") {
      raw = result.text;
    } else if (Array.isArray(result?.text)) {
      raw = (result.text as any[]).join("\n\n");
    } else if (Array.isArray(result)) {
      raw = (result as any[]).join("\n\n");
    }

    if (raw && raw.trim().length > 5) {
      return raw.trim();
    }
  } catch (err) {
    console.error("[PDF_EXTRACT] Error con unpdf:", err);
  }

  // 2. Fallback con pdf-parse
  try {
    const pdfParse = require("pdf-parse");
    const parsed = await pdfParse(buf);
    if (parsed?.text && parsed.text.trim().length > 5) {
      return parsed.text.trim();
    }
  } catch (err) {
    // pdf-parse fallback silencioso
  }

  return "";
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

const TIPOS_TEXTO  = [".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml", ".log"];
const TIPOS_PDF    = [".pdf"];
const TIPOS_WORD   = [".docx", ".doc"];
const TIPOS_EXCEL  = [".xlsx", ".xls", ".ods"];
const TIPOS_IMAGEN = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
export const TODOS_TIPOS = [...TIPOS_PDF, ...TIPOS_WORD, ...TIPOS_EXCEL, ...TIPOS_TEXTO, ...TIPOS_IMAGEN];

export function getExtension(name: string): string {
  const cleanName = name.split("?")[0].toLowerCase();
  const lastDot = cleanName.lastIndexOf(".");
  return lastDot !== -1 ? cleanName.substring(lastDot) : "";
}

export function getFilenameFromUrl(url: string): string {
  try {
    const cleanUrl = url.split("?")[0];
    const parts = cleanUrl.split("/");
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : "archivo";
  } catch {
    return "archivo";
  }
}

export function getTipoLabel(ext: string): "PDF" | "Word" | "Excel" | "Imagen" | "Texto" {
  if (TIPOS_PDF.includes(ext))    return "PDF";
  if (TIPOS_WORD.includes(ext))   return "Word";
  if (TIPOS_EXCEL.includes(ext))  return "Excel";
  if (TIPOS_IMAGEN.includes(ext)) return "Imagen";
  return "Texto";
}

// ─── DESCRIPCIÓN Y OCR DE IMÁGENES CON GROQ VISION ─────────────────────────────
export async function describirImagen(
  bufferOrUrl: Buffer | string,
  groqKey: string,
  fileNameOrUrl = "imagen.png"
): Promise<string> {
  let imageContent: { type: string; image_url: { url: string } };

  if (Buffer.isBuffer(bufferOrUrl)) {
    const ext = getExtension(fileNameOrUrl);
    const mime = ext.includes("png")
      ? "image/png"
      : ext.includes("webp")
      ? "image/webp"
      : "image/jpeg";
    const base64 = `data:${mime};base64,${bufferOrUrl.toString("base64")}`;
    imageContent = { type: "image_url", image_url: { url: base64 } };
  } else {
    imageContent = { type: "image_url", image_url: { url: bufferOrUrl } };
  }

  const visionModels = [
    "llama-3.2-11b-vision-preview",
    "llama-3.2-90b-vision-preview",
  ];

  for (const modelName of visionModels) {
    try {
      const res = (await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Instrucción de OCR y extracción: Analiza esta imagen con precisión. Transcribe TODO el texto legible en español, números, tablas, listas, títulos, sanciones o datos del reglamento presentes en la imagen.",
                },
                imageContent,
              ],
            },
          ],
          max_tokens: 2000,
        }),
      })) as any;

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 5) {
          return text;
        }
      } else {
        const errText = await res.text();
        console.error(`[GROQ_VISION] Error con modelo ${modelName}: status ${res.status}`, errText);
      }
    } catch (err) {
      console.error(`[GROQ_VISION] Excepción con modelo ${modelName}:`, err);
    }
  }

  throw new Error("No se pudo extraer texto de la imagen.");
}

// ─── PROCESADOR UNIFICADO DE ARCHIVOS E IMÁGENES ──────────────────────────────
export async function procesarContenidoOArchivo(
  buffer: Buffer,
  nombreOUrl: string,
  contentTypeHeader = ""
): Promise<{ texto: string; tipo: "PDF" | "Word" | "Excel" | "Imagen" | "Texto" }> {
  const ext = getExtension(nombreOUrl);
  const isImage =
    TIPOS_IMAGEN.includes(ext) ||
    contentTypeHeader.toLowerCase().includes("image/");
  const isPdf =
    TIPOS_PDF.includes(ext) ||
    contentTypeHeader.toLowerCase().includes("pdf");
  const isWord = TIPOS_WORD.includes(ext);
  const isExcel = TIPOS_EXCEL.includes(ext);

  // 1. IMAGEN -> Groq Vision OCR
  if (isImage) {
    if (config.groqApiKey) {
      try {
        const descripcion = await describirImagen(buffer, config.groqApiKey, nombreOUrl);
        if (descripcion && descripcion.length > 5) {
          return { texto: `[OCR Imagen "${nombreOUrl}"]:\n${descripcion}`, tipo: "Imagen" };
        }
      } catch (err) {
        console.error(`[PROCESAR_ARCHIVO] Error Groq Vision OCR para ${nombreOUrl}:`, err);
      }
    }
    return {
      texto: `[Imagen cargada "${nombreOUrl}"] (Procesada como referencia de imagen)`,
      tipo: "Imagen",
    };
  }

  // 2. PDF -> unpdf / pdf-parse / Groq Vision OCR
  if (isPdf) {
    try {
      const texto = await extractPDFText(buffer);
      if (texto && texto.trim().length > 5) {
        return { texto: texto.trim(), tipo: "PDF" };
      }
    } catch (err) {
      console.error(`[PROCESAR_ARCHIVO] Error parseando PDF ${nombreOUrl}:`, err);
    }

    // Si el PDF no tenía capa de texto (documento PDF escaneado), intentar OCR con Groq Vision
    if (config.groqApiKey) {
      try {
        const descripcion = await describirImagen(buffer, config.groqApiKey, nombreOUrl);
        if (descripcion && descripcion.length > 5) {
          return { texto: `[OCR PDF Escaneado "${nombreOUrl}"]:\n${descripcion}`, tipo: "PDF" };
        }
      } catch (ocrErr) {
        console.error(`[PROCESAR_ARCHIVO] Error OCR para PDF escaneado ${nombreOUrl}:`, ocrErr);
      }
    }
  }

  // 3. WORD -> mammoth
  if (isWord) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 5) {
        return { texto: result.value.trim(), tipo: "Word" };
      }
    } catch (err) {
      console.error(`[PROCESAR_ARCHIVO] Error parseando Word ${nombreOUrl}:`, err);
    }
  }

  // 4. EXCEL -> xlsx
  if (isExcel) {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const lineas: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws);
        lineas.push(`=== Hoja: ${sheetName} ===\n${csv}`);
      }
      if (lineas.length > 0) {
        return { texto: lineas.join("\n\n").trim(), tipo: "Excel" };
      }
    } catch (err) {
      console.error(`[PROCESAR_ARCHIVO] Error parseando Excel ${nombreOUrl}:`, err);
    }
  }

  // 5. TEXTO PLANO / UTF-8
  const textoUtf8 = buffer.toString("utf-8").trim();
  return { texto: textoUtf8, tipo: "Texto" };
}

// ─── HELPER DE EXTRAER ADJUNTOS DEL MODAL V2 ─────────────────────────────────
function extractModalAttachments(interaction: ModalSubmitInteraction): Array<{ url: string; filename: string; content_type: string }> {
  const list: Array<{ url: string; filename: string; content_type: string }> = [];
  const raw = interaction as any;

  // Log full raw structure for debugging
  console.log("[MODAL_ATTACHMENTS] Extracting attachments from modal submit...");

  // 1. Gather the resolved attachments map from ALL possible locations
  //    Discord docs: resolved.attachments is at the top level of the interaction
  const resolvedMap: Record<string, any> =
    raw.resolved?.attachments ??          // discord.js may put it here
    raw.data?.resolved?.attachments ??    // or nested in data
    raw.fields?.resolved?.attachments ??  // or in fields
    raw.message?.resolved?.attachments ?? // or in message
    {};

  const resolvedKeys = Object.keys(resolvedMap);
  console.log(`[MODAL_ATTACHMENTS] Found ${resolvedKeys.length} resolved attachment(s):`, resolvedKeys);

  // 2. If we have resolved attachments, use them directly
  if (resolvedKeys.length > 0) {
    for (const att of Object.values(resolvedMap) as any[]) {
      if (att?.url) {
        list.push({
          url: att.url,
          filename: att.filename ?? att.name ?? "archivo",
          content_type: att.content_type ?? "",
        });
      }
    }
  }

  // 3. Also check the components array for type 19 (FILE_UPLOAD) with values (snowflake IDs)
  //    Per Discord docs: components[].values = array of snowflake IDs
  const components = raw.data?.components ?? raw.components ?? [];
  for (const row of components) {
    // Could be a direct component or nested in an action row
    const comps = row.components ?? [row];
    for (const comp of comps) {
      // type 19 = FILE_UPLOAD, values = array of attachment snowflake IDs
      if (comp.type === 19 && Array.isArray(comp.values)) {
        for (const attachId of comp.values) {
          // Look up in resolved map
          const att = resolvedMap[attachId];
          if (att?.url) {
            // Avoid duplicates
            if (!list.some(l => l.url === att.url)) {
              list.push({
                url: att.url,
                filename: att.filename ?? att.name ?? "archivo",
                content_type: att.content_type ?? "",
              });
            }
          }
        }
      }

      // Also check nested component (type 18 LABEL wraps a component)
      if (comp.component?.type === 19 && Array.isArray(comp.component.values)) {
        for (const attachId of comp.component.values) {
          const att = resolvedMap[attachId];
          if (att?.url && !list.some(l => l.url === att.url)) {
            list.push({
              url: att.url,
              filename: att.filename ?? att.name ?? "archivo",
              content_type: att.content_type ?? "",
            });
          }
        }
      }
    }
  }

  // 4. Fallback: discord.js Collection of attachments
  if (list.length === 0 && raw.attachments) {
    try {
      for (const att of raw.attachments.values()) {
        if (att?.url) {
          list.push({
            url: att.url,
            filename: att.name ?? att.filename ?? "archivo",
            content_type: att.contentType ?? att.content_type ?? "",
          });
        }
      }
    } catch {}
  }

  // 5. Fallback: fields.fields Collection may contain file upload entries
  if (list.length === 0) {
    try {
      const fieldsMap = raw.fields?.fields ?? raw.fields?.data ?? raw.data?.components;
      if (fieldsMap) {
        const iterate = (items: any[]) => {
          for (const item of items) {
            if (item.type === 19 && Array.isArray(item.values)) {
              for (const id of item.values) {
                const att = resolvedMap[id];
                if (att?.url) {
                  list.push({
                    url: att.url,
                    filename: att.filename ?? "archivo",
                    content_type: att.content_type ?? "",
                  });
                }
              }
            }
            if (item.components) iterate(item.components);
          }
        };
        iterate(Array.isArray(fieldsMap) ? fieldsMap : [...fieldsMap.values()]);
      }
    } catch {}
  }

  console.log(`[MODAL_ATTACHMENTS] Total attachments extracted: ${list.length}`);
  if (list.length > 0) {
    for (const att of list) {
      console.log(`  -> ${att.filename} (${att.content_type}) ${att.url.substring(0, 80)}...`);
    }
  }

  return list;
}

// ─── HELPER DE EXTRAER CAMPOS DE TEXTO DEL MODAL V2 ──────────────────────────
function findModalFieldValue(interaction: ModalSubmitInteraction, customId: string): string {
  try {
    const val = interaction.fields.getTextInputValue(customId);
    if (val) return val.trim();
  } catch {}

  const rawComponents =
    (interaction as any).data?.components ??
    (interaction as any).components ??
    [];

  function search(compList: any[]): string | null {
    for (const comp of compList) {
      if (comp.custom_id === customId && comp.value) {
        return comp.value;
      }
      if (comp.component) {
        const res = search([comp.component]);
        if (res !== null) return res;
      }
      if (comp.components && Array.isArray(comp.components)) {
        const res = search(comp.components);
        if (res !== null) return res;
      }
    }
    return null;
  }

  return search(rawComponents)?.trim() ?? "";
}

// ─── HELPER DE CONTAINER V2 ──────────────────────────────────────────────────
export function buildTryoutContainer(
  guild: Guild | null,
  user: User,
  color: number,
  title: string,
  body: string,
  actionRow?: ActionRowBuilder<StringSelectMenuBuilder>
): ContainerBuilder {
  const thumbnailUrl =
    guild?.iconURL({ extension: "png", size: 256, forceStatic: true }) ??
    user.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }) ??
    "https://i.imgur.com/AfFp7pu.png";

  const container = new ContainerBuilder()
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
      new TextDisplayBuilder().setContent(`-# Sonora RP · Tryout IA · ${getFooterTimestamp()}`)
    );

  if (actionRow) {
    container.addActionRowComponents(actionRow);
  }

  return container;
}

// ─── CONSTRUIR MENU PRINCIPAL DE OPCIONES ─────────────────────────────────────
export function buildMainMenuRow(guildId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const items = documentCache.getItems(guildId);
  const totalCount = items.length;

  const select = new StringSelectMenuBuilder()
    .setCustomId("tryout:main_menu")
    .setPlaceholder("📌 Selecciona una opción del panel de IA...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Cargar Imagen / PDF / Link (Modal V2)")
        .setValue("upload_url_modal")
        .setDescription("Abre Modal V2 para subir enlace de imagen, PDF o texto.")
        .setEmoji("📁"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Agregar Texto Manual (Modal V2)")
        .setValue("add_text")
        .setDescription("Abre Modal V2 para guardar notas, reglas o contenido directo.")
        .setEmoji("📝"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Consultar IA (Modal V2)")
        .setValue("ask")
        .setDescription("Abre Modal V2 para hacer preguntas a la IA.")
        .setEmoji("💡"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Eliminar Documentos (Multi-Select)")
        .setValue("delete_docs")
        .setDescription("Elige cuáles documentos o textos eliminar.")
        .setEmoji("🗑️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Ver Estado / Documentos Cargados")
        .setValue("view_info")
        .setDescription(`Ver lista de ${totalCount} fuente(s) en la base de datos.`)
        .setEmoji("ℹ️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Borrar TODO el Conocimiento")
        .setValue("clear_all")
        .setDescription("Limpia toda la base de datos de este servidor.")
        .setEmoji("🧹")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// ─── PANEL PRINCIPAL V2 ───────────────────────────────────────────────────────
export async function renderTryoutPanel(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction
): Promise<void> {
  const guildId = interaction.guildId ?? "global";
  await documentCache.ensureLoaded(guildId);
  const items = documentCache.getItems(guildId);

  const body = [
    "### 🤖 Panel Interactivo Tryout IA · Sonora RP (Modals V2 & MongoDB)",
    "Gestión de conocimiento persistente en base de datos y consultas inteligentes.",
    "",
    `› **Fuentes activas en DB:** \`${items.length} fuente(s)\``,
    `› **Soporta:** Imágenes (Groq Vision OCR), PDF, Word, Excel, Links, TXT, MD, JSON.`,
    "› **Persistencia:** Guardado automáticamente en MongoDB (no se borra al reiniciar).",
    "",
    "Utiliza el **Menú de Selección** abajo para interactuar con los **Modals V2** de la IA.",
  ].join("\n");

  const container = buildTryoutContainer(
    interaction.guild,
    interaction.user,
    0x7c3aed,
    "# Panel de Control · Tryout IA",
    body,
    buildMainMenuRow(guildId)
  );

  if (interaction.isRepliable()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  }
}

// ─── HANDLER PARA EL SELECT MENU PRINCIPAL ────────────────────────────────────
export async function handleTryoutMainMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const value = interaction.values[0];
  const guildId = interaction.guildId ?? "global";
  await documentCache.ensureLoaded(guildId);

  // 1. CARGAR ARCHIVO / IMAGEN / LINK (MODAL V2 CON FILE UPLOAD TYPE 19)
  if (value === "upload_url_modal" || value === "upload_file" || value === "upload_info") {
    try {
      await interaction.client.rest.post(
        Routes.interactionCallback(interaction.id, interaction.token),
        {
          body: {
            type: 9,
            data: {
              custom_id: "tryout:modal_upload_url",
              title: "Cargar Archivo / Imagen (Modal V2)",
              components: [
                {
                  type: 18, // ComponentType.LABEL
                  label: "Subir Archivo o Imagen",
                  description: "Selecciona o arrastra tu archivo (PDF, Imagen, Word, Excel, TXT)",
                  component: {
                    type: 19, // ComponentType.FILE_UPLOAD
                    custom_id: "file_upload",
                    min_values: 1,
                    max_values: 10,
                    required: false,
                  },
                },
                {
                  type: 18, // ComponentType.LABEL
                  label: "Título de la Fuente",
                  description: "Nombre o título asignado a este conocimiento",
                  component: {
                    type: 4, // TextInput
                    custom_id: "titulo",
                    style: 1, // Short
                    placeholder: "Ej. Reglamento de Facciones / Captura",
                    required: false,
                    max_length: 100,
                  },
                },
                {
                  type: 18, // ComponentType.LABEL
                  label: "Texto o Enlace alternativo (Opcional)",
                  description: "Pega el texto directo o una URL si no subes un archivo arriba",
                  component: {
                    type: 4, // TextInput
                    custom_id: "contenido_url",
                    style: 2, // Paragraph
                    placeholder: "Pega el texto o URL si aplica...",
                    required: false,
                    max_length: 3800,
                  },
                },
              ],
            },
          },
        }
      );
    } catch (err) {
      console.error("[TRYOUT_MODAL_V2] Error enviando Modal V2 de File Upload:", err);
      // Fallback a modal estándar
      const modal = new ModalBuilder()
        .setCustomId("tryout:modal_upload_url")
        .setTitle("Cargar Archivo/Imagen/Link");

      const inputTitulo = new TextInputBuilder()
        .setCustomId("titulo")
        .setLabel("Título o Nombre del Archivo/Imagen")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej. Captura de Reglamento / PDF de Sanciones")
        .setRequired(true)
        .setMaxLength(100);

      const inputContenido = new TextInputBuilder()
        .setCustomId("contenido_url")
        .setLabel("URL de Imagen / PDF / Doc O Texto directo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Pega el enlace de la imagen (Discord CDN/Imgur), PDF o texto...")
        .setRequired(true)
        .setMaxLength(3800);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
        new ActionRowBuilder<TextInputBuilder>().addComponents(inputContenido)
      );
      await interaction.showModal(modal);
    }
    return;
  }

  // 2. CONSULTAR IA -> Abrir Modal V2
  if (value === "ask") {
    const modal = new ModalBuilder()
      .setCustomId("tryout:modal_ask")
      .setTitle("Consultar a Tryout IA");

    const inputPregunta = new TextInputBuilder()
      .setCustomId("pregunta")
      .setLabel("¿Qué deseas consultar a la IA?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Ej. ¿Cuáles son las sanciones por robar en zona segura?")
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(inputPregunta));
    await interaction.showModal(modal);
    return;
  }

  // 3. AGREGAR TEXTO MANUAL -> Abrir Modal V2
  if (value === "add_text") {
    const modal = new ModalBuilder()
      .setCustomId("tryout:modal_add_text")
      .setTitle("Agregar Texto a Tryout IA");

    const inputTitulo = new TextInputBuilder()
      .setCustomId("titulo")
      .setLabel("Título o Nombre del Documento/Texto")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej. Reglamento de Facciones Ilegales")
      .setRequired(true)
      .setMaxLength(100);

    const inputContenido = new TextInputBuilder()
      .setCustomId("contenido")
      .setLabel("Contenido del Texto")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Pega o escribe aquí las reglas o información...")
      .setRequired(true)
      .setMaxLength(3800);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputContenido)
    );
    await interaction.showModal(modal);
    return;
  }

  // 4. ELIMINAR DOCUMENTOS -> Mostrar Select Menu Múltiple
  if (value === "delete_docs") {
    await renderDeleteMultiSelect(interaction);
    return;
  }

  // 5. VER INFO
  if (value === "view_info") {
    await renderInfoView(interaction);
    return;
  }

  // 6. BORRAR TODO
  if (value === "clear_all") {
    await documentCache.clear(guildId);
    await interaction.deferUpdate();
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0xef4444,
      "# Tryout IA · Base de Datos Borrada",
      "🧹 **Todo el conocimiento de este servidor ha sido eliminado de la base de datos MongoDB.**",
      buildMainMenuRow(guildId)
    );
    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return;
  }
}

// ─── RENDERIZAR MULTI-SELECT PARA ELIMINAR DOCUMENTOS ─────────────────────────
export async function renderDeleteMultiSelect(
  interaction: StringSelectMenuInteraction | ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId ?? "global";
  await documentCache.ensureLoaded(guildId);
  const items = documentCache.getItems(guildId);

  if (items.length === 0) {
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x6b7280,
      "# Tryout IA · Eliminar Documentos",
      "ℹ️ **No hay documentos cargados en la base de datos de este servidor.**\nUsa el menú principal para cargar imágenes, archivos o textos.",
      buildMainMenuRow(guildId)
    );
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      } else {
        await interaction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
      }
    }
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("tryout:delete_select")
    .setPlaceholder("🗑️ Selecciona los documentos que deseas eliminar...")
    .setMinValues(1)
    .setMaxValues(Math.min(items.length, 25));

  for (const item of items) {
    const charsFormatted = item.text.length.toLocaleString("es-MX");
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${item.type}: ${item.name.substring(0, 50)}`)
        .setValue(item.id)
        .setDescription(`[${item.type}] ${charsFormatted} caracteres cargados`)
        .setEmoji(getEmojiForType(item.type))
    );
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const container = buildTryoutContainer(
    interaction.guild,
    interaction.user,
    0xf59e0b,
    "# Tryout IA · Eliminar Documentos (Multi-Selección)",
    `Selecciona **uno o varios documentos** de la lista desplegable abajo para eliminarlos de MongoDB:\n\n` +
    `*Puedes seleccionar hasta ${Math.min(items.length, 25)} documentos a la vez.*`,
    row
  );

  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isMessageComponent()) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  }
  await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

function getEmojiForType(type: string): string {
  switch (type) {
    case "PDF": return "📄";
    case "Word": return "🟦";
    case "Excel": return "🟩";
    case "Imagen": return "🖼️";
    default: return "📝";
  }
}

// ─── HANDLER PARA EL MULTI-SELECT DE ELIMINACIÓN ──────────────────────────────
export async function handleTryoutDeleteSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const guildId = interaction.guildId ?? "global";
  const selectedIds = interaction.values;

  const countRemoved = await documentCache.deleteItems(guildId, selectedIds);
  const remaining = documentCache.getItems(guildId).length;

  await interaction.deferUpdate();

  const container = buildTryoutContainer(
    interaction.guild,
    interaction.user,
    0xef4444,
    "# Tryout IA · Documentos Eliminados",
    [
      `✅ **Se eliminaron \`${countRemoved}\` documento(s) de MongoDB correctamente.**`,
      `› **Documentos restantes en la DB:** \`${remaining}\``,
      "",
      "Usa el menú de selección abajo para continuar gestionando.",
    ].join("\n"),
    buildMainMenuRow(guildId)
  );

  await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

// ─── RENDERIZAR VISTA DE INFORMACIÓN DE DOCUMENTOS ───────────────────────────
export async function renderInfoView(
  interaction: StringSelectMenuInteraction | ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId ?? "global";
  await documentCache.ensureLoaded(guildId);
  const items = documentCache.getItems(guildId);

  let body = "";
  if (items.length === 0) {
    body = "❌ **No hay conocimiento ni documentos cargados en la base de datos de este servidor.**";
  } else {
    const list = items
      .map(
        (it, i) =>
          `**${i + 1}. [${it.type}] \`${it.name}\`**\n` +
          `   └ Caracteres: \`${it.text.length.toLocaleString("es-MX")}\` | ID: \`${it.id}\``
      )
      .join("\n\n");

    const totalChars = items.reduce((acc, curr) => acc + curr.text.length, 0);

    body = [
      `### 📊 Conocimiento Guardado en MongoDB (${items.length} fuentes)`,
      `**Total de caracteres memorizados:** \`${totalChars.toLocaleString("es-MX")}\``,
      "",
      list,
    ].join("\n");
  }

  const container = buildTryoutContainer(
    interaction.guild,
    interaction.user,
    items.length > 0 ? 0x2ecc71 : 0x6b7280,
    "# Tryout IA · Base de Datos de Conocimiento",
    body,
    buildMainMenuRow(guildId)
  );

  if (!interaction.deferred && !interaction.replied) {
    if (interaction.isMessageComponent()) {
      await interaction.deferUpdate();
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  }
  await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

// ─── HANDLER PARA MODALS V2 (URL/TEXTO, PREGUNTA, AGREGAR TEXTO) ──────────────
export async function handleTryoutModalSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const id = interaction.customId;
  const guildId = interaction.guildId ?? "global";
  await documentCache.ensureLoaded(guildId);

  // ── 1. MODAL V2: CARGAR URL O TEXTO (tryout:modal_upload_url) ───────────
  if (id === "tryout:modal_upload_url" || id === "tryout:modal_upload_file") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ── DEBUG: Log raw interaction structure for FILE_UPLOAD diagnosis ──
    const rawInteraction = interaction as any;
    console.log("[MODAL_SUBMIT_DEBUG] customId:", id);
    console.log("[MODAL_SUBMIT_DEBUG] Has resolved?", !!rawInteraction.resolved);
    console.log("[MODAL_SUBMIT_DEBUG] Has data?", !!rawInteraction.data);
    console.log("[MODAL_SUBMIT_DEBUG] Has data.resolved?", !!rawInteraction.data?.resolved);
    console.log("[MODAL_SUBMIT_DEBUG] Has data.resolved.attachments?", !!rawInteraction.data?.resolved?.attachments);
    console.log("[MODAL_SUBMIT_DEBUG] Has fields?", !!rawInteraction.fields);
    console.log("[MODAL_SUBMIT_DEBUG] Has attachments?", !!rawInteraction.attachments);
    try {
      const dataKeys = Object.keys(rawInteraction.data ?? {});
      console.log("[MODAL_SUBMIT_DEBUG] data keys:", dataKeys);
      if (rawInteraction.data?.components) {
        console.log("[MODAL_SUBMIT_DEBUG] data.components:", JSON.stringify(rawInteraction.data.components, null, 2).substring(0, 1500));
      }
      if (rawInteraction.data?.resolved) {
        console.log("[MODAL_SUBMIT_DEBUG] data.resolved:", JSON.stringify(rawInteraction.data.resolved, null, 2).substring(0, 1500));
      }
      if (rawInteraction.resolved) {
        console.log("[MODAL_SUBMIT_DEBUG] interaction.resolved:", JSON.stringify(rawInteraction.resolved, null, 2).substring(0, 1500));
      }
    } catch (e) { console.log("[MODAL_SUBMIT_DEBUG] Error logging:", e); }

    const attachmentsList = extractModalAttachments(interaction);

    const tituloVal   = findModalFieldValue(interaction, "titulo");
    const inputVal    = findModalFieldValue(interaction, "contenido_url");
    const preguntaVal = findModalFieldValue(interaction, "pregunta");

    const itemsProcesados: Array<{ name: string; type: any; text: string }> = [];

    // PROCESAR ARCHIVOS SUBIDOS DIRECTAMENTE EN EL MODAL V2 (type 19)
    if (attachmentsList.length > 0) {
      for (const fileAtt of attachmentsList) {
        try {
          const res: any = await fetch(fileAtt.url);
          if (!res.ok) continue;
          const contentType = res.headers.get("content-type") ?? "";
          const fileBuffer = Buffer.from(await res.arrayBuffer());

          const { texto, tipo } = await procesarContenidoOArchivo(fileBuffer, fileAtt.filename, contentType);

          if (texto && texto.length >= 5) {
            const itemGuardado = await documentCache.addItem(guildId, {
              name: tituloVal ? `${tituloVal} (${fileAtt.filename})` : fileAtt.filename,
              type: tipo,
              text: texto,
            });
            itemsProcesados.push(itemGuardado);
          }
        } catch (err) {
          console.error(`[MODAL_SUBMIT] Error procesando adjunto ${fileAtt.filename}:`, err);
        }
      }
    }

    // PROCESAR URL O TEXTO SI SE INGRESÓ EN EL CAMPO DE TEXTO
    if (inputVal && itemsProcesados.length === 0) {
      const esUrl = /^https?:\/\//i.test(inputVal);

      if (esUrl) {
        try {
          const res: any = await fetch(inputVal);
          if (res.ok) {
            const contentType = res.headers.get("content-type") ?? "";
            const fileBuffer = Buffer.from(await res.arrayBuffer());
            const filename = getFilenameFromUrl(inputVal);

            const { texto, tipo } = await procesarContenidoOArchivo(fileBuffer, filename, contentType);

            if (texto && texto.length >= 5) {
              const itemGuardado = await documentCache.addItem(guildId, {
                name: tituloVal || filename,
                type: tipo,
                text: texto,
              });
              itemsProcesados.push(itemGuardado);
            }
          }
        } catch (err) {
          console.error(`[MODAL_SUBMIT] Error descargando URL ${inputVal}:`, err);
        }
      } else {
        // Texto plano directo
        const itemGuardado = await documentCache.addItem(guildId, {
          name: tituloVal || "Nota / Reglamento",
          type: "Texto",
          text: inputVal,
        });
        itemsProcesados.push(itemGuardado);
      }
    }

    if (itemsProcesados.length === 0) {
      await interaction.editReply({
        content: "⚠️ No se pudo extraer texto o información del archivo/enlace proporcionado. Verifica el enlace o sube un archivo legible.",
      });
      return;
    }

    // Si había pregunta opcional, consultar a Groq AI
    let respuestaIA = "";
    if (preguntaVal) {
      const combined = documentCache.getCombined(guildId);
      if (config.groqApiKey && combined.count > 0) {
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
                    `Eres el Asistente Inteligente Oficial de Sonora RP.\n` +
                    `Proporciona una respuesta clara, profunda, pulida y bien estructurada basándote en las fuentes de conocimiento.\n\n` +
                    `--- CONOCIMIENTO (${combined.sources}) ---\n${combined.text}\n--- FIN ---`,
                },
                { role: "user", content: preguntaVal },
              ],
              max_tokens: 1200,
              temperature: 0.25,
            }),
          }) as any;

          if (res.ok) {
            const data = await res.json() as any;
            respuestaIA = data?.choices?.[0]?.message?.content?.trim() ?? "";
          }
        } catch (e) {
          console.error("[TRYOUT_IA] Error consultando IA tras guardar modal:", e);
        }
      }
    }

    const primerItem = itemsProcesados[0];
    const items = documentCache.getItems(guildId);
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x2ecc71,
      "# Tryout IA · Fuente Guardada en MongoDB",
      [
        `✅ **Nueva fuente memorizada y guardada en la base de datos.**`,
        `› **Título:** \`${primerItem.name}\``,
        `› **Tipo:** \`${primerItem.type}\``,
        `› **Caracteres memorizados:** \`${primerItem.text.length.toLocaleString("es-MX")}\``,
        `› **Total de fuentes procesadas en esta entrega:** \`${itemsProcesados.length}\``,
        `› **Total de fuentes en DB:** \`${items.length}\``,
        respuestaIA ? `\n---\n**Pregunta:** > ${preguntaVal}\n\n**Respuesta IA:**\n${respuestaIA}` : "",
      ].join("\n"),
      buildMainMenuRow(guildId)
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // ── 2. MODAL V2: PREGUNTA (tryout:modal_ask) ─────────────────────────────
  if (id === "tryout:modal_ask") {
    const pregunta = findModalFieldValue(interaction, "pregunta");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!config.groqApiKey) {
      await interaction.editReply({ content: "❌ No hay API Key de Groq configurada." });
      return;
    }

    const combined = documentCache.getCombined(guildId);
    let systemPrompt: string;
    let modoDoc = false;

    if (combined.count > 0) {
      modoDoc = true;
      systemPrompt =
        `Eres el Asistente Inteligente Oficial de Sonora RP.\n` +
        `Tu objetivo es brindar respuestas profesionales, explicativas, bien estructuradas y formalmente redactadas en español.\n\n` +
        `REGLAS:\n` +
        `1. Analiza detenidamente el conocimiento de la base de datos (${combined.count} fuentes activas).\n` +
        `2. Si la consulta está relacionada con la información cargada, proporciona una respuesta detallada, pulida y completa, organizando la información si es útil.\n` +
        `3. Si la pregunta no se responde con el conocimiento oficial, explícalo con amabilidad y responde con el conocimiento general disponible.\n\n` +
        `--- BASE DE DATOS DE CONOCIMIENTO (${combined.sources}) ---\n${combined.text}\n--- FIN DEL CONOCIMIENTO ---`;
    } else {
      systemPrompt =
        "Eres el Asistente Inteligente del servidor 'Sonora RP'. Responde de forma clara, educada y profesional en español.";
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
            { role: "user", content: pregunta },
          ],
          max_tokens: 1200,
          temperature: modoDoc ? 0.3 : 0.7,
        }),
      }) as any;

      if (!res.ok) {
        const errData = (await res.json()) as any;
        await interaction.editReply({
          content: `❌ Error de Groq: \`${errData?.error?.message ?? res.status}\``,
        });
        return;
      }

      const data = (await res.json()) as any;
      respuesta = data?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
    } catch (err) {
      console.error("[TRYOUT_IA] Error en fetch Groq:", err);
      await interaction.editReply({ content: "❌ Error al conectar con Groq AI." });
      return;
    }

    if (respuesta.length > 3900) {
      respuesta = respuesta.substring(0, 3900) + "\n\n*(Respuesta truncada)*";
    }

    const docInfo = modoDoc
      ? `**Base de datos activa (${combined.count}):** \`${combined.sources}\`\n`
      : "";

    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0xf55036,
      "# Tryout IA · Respuesta",
      `${docInfo}**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}\n\n**Respuesta:**\n${respuesta}`,
      buildMainMenuRow(guildId)
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // ── 3. MODAL V2: AGREGAR TEXTO (tryout:modal_add_text) ───────────────────
  if (id === "tryout:modal_add_text") {
    const titulo = findModalFieldValue(interaction, "titulo");
    const contenido = findModalFieldValue(interaction, "contenido");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const item = await documentCache.addItem(guildId, {
      name: titulo || "Nota Manual",
      type: "Texto",
      text: contenido,
    });

    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x2ecc71,
      "# Tryout IA · Texto Guardado en MongoDB",
      [
        `✅ **El texto fue guardado en la base de datos y memorizado por la IA.**`,
        `› **Título:** \`${item.name}\``,
        `› **Caracteres:** \`${item.text.length.toLocaleString("es-MX")}\``,
        `› **ID asignado:** \`${item.id}\``,
        "",
        "El conocimiento ahora es permanente y sobrevivirá a reinicios del bot.",
      ].join("\n"),
      buildMainMenuRow(guildId)
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return;
  }
}

// ─── HANDLER PARA SUBIDA DIRECTA DE ARCHIVOS CON /tryout subir ────────────────
export async function handleTryoutUploadCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const guildId = interaction.guildId ?? "global";
  await documentCache.ensureLoaded(guildId);

  const attachment = interaction.options.getAttachment("archivo", true);
  const tituloOpt  = interaction.options.getString("titulo");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let fileBuffer: Buffer;
  let contentType = "";
  try {
    const res: any = await fetch(attachment.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contentType = res.headers.get("content-type") ?? "";
    fileBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("[TRYOUT_SUBIR] Error descargando archivo:", err);
    await interaction.editReply({ content: "❌ No se pudo descargar el archivo." });
    return;
  }

  const tituloDoc = tituloOpt?.trim() || attachment.name;

  try {
    const { texto, tipo } = await procesarContenidoOArchivo(fileBuffer, attachment.name, contentType);

    if (!texto || texto.length < 5) {
      await interaction.editReply({ content: "⚠️ No se pudo extraer información o texto legible del archivo." });
      return;
    }

    const item = await documentCache.addItem(guildId, {
      name: tituloDoc,
      type: tipo,
      text: texto,
    });

    const items = documentCache.getItems(guildId);
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x2ecc71,
      "# Tryout IA · Archivo / Imagen Procesado Exitosamente",
      [
        `✅ **Contenido extraído y guardado en MongoDB.**`,
        `› **Título:** \`${item.name}\``,
        `› **Tipo:** \`${item.type}\``,
        `› **Caracteres memorizados:** \`${item.text.length.toLocaleString("es-MX")}\``,
        `› **Total de fuentes en DB:** \`${items.length}\``,
        "",
        "El bot ahora conoce esta información y responderá preguntas sobre ella.",
      ].join("\n"),
      buildMainMenuRow(guildId)
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
  } catch (err) {
    console.error("[TRYOUT_SUBIR] Error procesando archivo:", err);
    await interaction.editReply({ content: `❌ No se pudo procesar el archivo \`${attachment.name}\`.` });
  }
}
