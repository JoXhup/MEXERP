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
} from "discord.js";
import { config } from "../config.js";
import { getFooterTimestamp } from "../utils/components.js";
import { documentCache } from "../utils/documentCache.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
const mammoth  = require("mammoth")   as { extractRawText(input: { buffer: Buffer }): Promise<{ value: string }> };
const XLSX     = require("xlsx")      as typeof import("xlsx");

const GROQ_API_URL       = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL         = "llama-3.3-70b-versatile";
const GROQ_VISION_MODEL  = "meta-llama/llama-4-scout-17b-16e-instruct";

const TIPOS_TEXTO  = [".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml", ".log"];
const TIPOS_PDF    = [".pdf"];
const TIPOS_WORD   = [".docx", ".doc"];
const TIPOS_EXCEL  = [".xlsx", ".xls", ".ods"];
const TIPOS_IMAGEN = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
export const TODOS_TIPOS = [...TIPOS_PDF, ...TIPOS_WORD, ...TIPOS_EXCEL, ...TIPOS_TEXTO, ...TIPOS_IMAGEN];

export function getExtension(name: string): string {
  return name.toLowerCase().substring(name.lastIndexOf("."));
}

export function getTipoLabel(ext: string): "PDF" | "Word" | "Excel" | "Imagen" | "Texto" {
  if (TIPOS_PDF.includes(ext))    return "PDF";
  if (TIPOS_WORD.includes(ext))   return "Word";
  if (TIPOS_EXCEL.includes(ext))  return "Excel";
  if (TIPOS_IMAGEN.includes(ext)) return "Imagen";
  return "Texto";
}

export async function parsearArchivo(
  buffer: Buffer,
  ext: string,
  url: string
): Promise<{ texto: string; esImagen: boolean }> {
  if (TIPOS_PDF.includes(ext)) {
    const parsed = await pdfParse(buffer);
    return { texto: parsed.text.trim(), esImagen: false };
  }
  if (TIPOS_WORD.includes(ext)) {
    const result = await mammoth.extractRawText({ buffer });
    return { texto: result.value.trim(), esImagen: false };
  }
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
  if (TIPOS_IMAGEN.includes(ext)) {
    return { texto: url, esImagen: true };
  }
  return { texto: buffer.toString("utf-8").trim(), esImagen: false };
}

export async function describirImagen(imageUrl: string, groqKey: string): Promise<string> {
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
              text: "Describe detalladamente el contenido de esta imagen en español. Extrae todo el texto visible, números, listas y datos importantes.",
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

// ─── HELPER DE EMBED / CONTAINER V2 ──────────────────────────────────────────
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
        .setLabel("Consultar IA (Modal V2)")
        .setValue("ask")
        .setDescription("Abre Modal V2 para hacer preguntas a la IA.")
        .setEmoji("💡"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Agregar Texto Manual (Modal V2)")
        .setValue("add_text")
        .setDescription("Abre Modal V2 para guardar notas, reglas o texto directo.")
        .setEmoji("📝"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Cargar Archivos / Imágenes")
        .setValue("upload_info")
        .setDescription("Instrucciones para subir PDF, Word, Excel o imágenes (Groq Vision).")
        .setEmoji("📁"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Eliminar Documentos (Multi-Select)")
        .setValue("delete_docs")
        .setDescription("Elige cuáles documentos o textos eliminar.")
        .setEmoji("🗑️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Ver Estado / Documentos Cargados")
        .setValue("view_info")
        .setDescription(`Ver lista de ${totalCount} fuente(s) de conocimiento activa(s).`)
        .setEmoji("ℹ️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Borrar TODO el Conocimiento")
        .setValue("clear_all")
        .setDescription("Limpia la base de datos de conocimiento de este servidor.")
        .setEmoji("🧹")
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

// ─── PANEL PRINCIPAL V2 ───────────────────────────────────────────────────────
export async function renderTryoutPanel(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction
): Promise<void> {
  const guildId = interaction.guildId ?? "global";
  const items = documentCache.getItems(guildId);

  const body = [
    "### 🤖 Panel Interactivo Tryout IA · Sonora RP",
    "Gestión de conocimiento y consultas en tiempo real para administradores.",
    "",
    `› **Fuentes activas:** \`${items.length} fuente(s)\``,
    `› **Formatos aceptados:** PDF, Word, Excel, Imágenes (Groq Vision), TXT, MD, JSON.`,
    "",
    "Utiliza el **Menú de Selección** abajo para interactuar con los **Modals V2** y la IA.",
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

  // 1. CONSULTAR IA -> Abrir Modal V2
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

  // 2. AGREGAR TEXTO MANUAL -> Abrir Modal V2
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

  // 3. CARGAR ARCHIVOS E IMÁGENES -> Mostrar guía
  if (value === "upload_info") {
    await interaction.deferUpdate();
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x3b82f6,
      "# Tryout IA · Subir Archivos e Imágenes",
      [
        "### 📁 ¿Cómo subir archivos o imágenes al bot?",
        "",
        "Para subir documentos o imágenes y agregarlos a la base de conocimiento de la IA:",
        "",
        "› **Comando:** `/tryout ia archivo:[adjuntar tu archivo]`",
        "",
        "**Formatos aceptados:**",
        "• 📄 **Documentos:** PDF (`.pdf`), Word (`.docx`), Excel (`.xlsx`, `.xls`)",
        "• 🖼️ **Imágenes (Groq Vision):** PNG, JPG, JPEG, WEBP, GIF",
        "• 📝 **Texto:** TXT, Markdown (`.md`), CSV, JSON, XML",
        "",
        "También puedes agregar una pregunta opcional en el mismo comando.",
      ].join("\n"),
      buildMainMenuRow(guildId)
    );
    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
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
    documentCache.clear(guildId);
    await interaction.deferUpdate();
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0xef4444,
      "# Tryout IA · Conocimiento Borrado",
      "🧹 **Todo el conocimiento de este servidor ha sido eliminado exitosamente.**",
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
  const items = documentCache.getItems(guildId);

  if (items.length === 0) {
    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x6b7280,
      "# Tryout IA · Eliminar Documentos",
      "ℹ️ **No hay documentos cargados en este servidor.**\nUsa `/tryout ia` para cargar archivos o textos.",
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
    `Selecciona **uno o varios documentos** de la lista desplegable abajo para eliminarlos del bot:\n\n` +
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

  const countRemoved = documentCache.deleteItems(guildId, selectedIds);
  const remaining = documentCache.getItems(guildId).length;

  await interaction.deferUpdate();

  const container = buildTryoutContainer(
    interaction.guild,
    interaction.user,
    0xef4444,
    "# Tryout IA · Documentos Eliminados",
    [
      `✅ **Se eliminaron \`${countRemoved}\` documento(s) correctamente.**`,
      `› **Documentos restantes en el bot:** \`${remaining}\``,
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
  const items = documentCache.getItems(guildId);

  let body = "";
  if (items.length === 0) {
    body = "❌ **No hay conocimiento ni documentos cargados actualmente en este servidor.**";
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
      `### 📊 Conocimiento Activo (${items.length} fuentes)`,
      `**Total de caracteres memorizados:** \`${totalChars.toLocaleString("es-MX")}\``,
      "",
      list,
    ].join("\n");
  }

  const container = buildTryoutContainer(
    interaction.guild,
    interaction.user,
    items.length > 0 ? 0x2ecc71 : 0x6b7280,
    "# Tryout IA · Conocimiento Almacenado",
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

// ─── HANDLER PARA MODALS V2 (PREGUNTA, AGREGAR TEXTO) ─────────────────────────
export async function handleTryoutModalSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const id = interaction.customId;
  const guildId = interaction.guildId ?? "global";

  // 1. MODAL V2: PREGUNTA (tryout:modal_ask)
  if (id === "tryout:modal_ask") {
    const pregunta = interaction.fields.getTextInputValue("pregunta");
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
        `Eres un asistente inteligente de Sonora RP. Hay (${combined.count}) documento(s)/fuente(s) de conocimiento activa(s).\n` +
        `Si la pregunta está relacionada con el conocimiento cargado, responde ÚNICAMENTE basándote en su contenido.\n` +
        `Si la pregunta no tiene relación, responde de forma general en español.\n\n` +
        `--- CONOCIMIENTO CARGADO (${combined.sources}) ---\n${combined.text}\n--- FIN DEL CONOCIMIENTO ---`;
    } else {
      systemPrompt =
        "Eres un asistente útil del servidor de Discord 'Sonora RP'. Responde de forma clara y concisa en español.";
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
          max_tokens: 1000,
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
      ? `**Conocimiento activo (${combined.count}):** \`${combined.sources}\`\n`
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

  // 2. MODAL V2: AGREGAR TEXTO (tryout:modal_add_text)
  if (id === "tryout:modal_add_text") {
    const titulo = interaction.fields.getTextInputValue("titulo").trim();
    const contenido = interaction.fields.getTextInputValue("contenido").trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const item = documentCache.addItem(guildId, {
      name: titulo,
      type: "Texto",
      text: contenido,
    });

    const container = buildTryoutContainer(
      interaction.guild,
      interaction.user,
      0x2ecc71,
      "# Tryout IA · Texto Agregado Exitosamente",
      [
        `✅ **El texto fue memorizado por la IA.**`,
        `› **Título:** \`${item.name}\``,
        `› **Caracteres:** \`${item.text.length.toLocaleString("es-MX")}\``,
        `› **ID asignado:** \`${item.id}\``,
        "",
        "Ahora puedes hacer preguntas sobre este texto desde el menú o con `/chatgpt`.",
      ].join("\n"),
      buildMainMenuRow(guildId)
    );

    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return;
  }
}
