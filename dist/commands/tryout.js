import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, } from "discord.js";
import { config } from "../config.js";
import { documentCache } from "../utils/documentCache.js";
import { renderTryoutPanel, renderDeleteMultiSelect, renderInfoView, parsearArchivo, describirImagen, getExtension, getTipoLabel, TODOS_TIPOS, buildTryoutContainer, buildMainMenuRow, } from "../handlers/tryoutHandler.js";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const data = new SlashCommandBuilder()
    .setName("tryout")
    .setDescription("Sistema de conocimiento e IA para Sonora RP (solo admins).")
    .addSubcommand((sub) => sub
    .setName("ia")
    .setDescription("Carga un archivo, imagen o texto y/o realiza una consulta a la IA (solo admins).")
    .addStringOption((opt) => opt
    .setName("pregunta")
    .setDescription("Pregunta basada en el conocimiento cargado.")
    .setRequired(false)
    .setMaxLength(800))
    .addAttachmentOption((opt) => opt
    .setName("archivo")
    .setDescription("Sube PDF, Word, Excel, Imagen (Groq Vision), TXT, JSON, etc.")
    .setRequired(false))
    .addStringOption((opt) => opt
    .setName("texto")
    .setDescription("Escribe o pega texto directo para memorizar.")
    .setRequired(false)
    .setMaxLength(3800))
    .addStringOption((opt) => opt
    .setName("modo")
    .setDescription("¿Añadir al conocimiento existente o reemplazar? (default: añadir)")
    .setRequired(false)
    .addChoices({ name: "Añadir al conocimiento actual", value: "añadir" }, { name: "Reemplazar todo", value: "reemplazar" })))
    .addSubcommand((sub) => sub
    .setName("panel")
    .setDescription("Abre el Panel Interactivo V2 con menú de opciones (solo admins)."))
    .addSubcommand((sub) => sub
    .setName("limpiar")
    .setDescription("Abre el Menú de Selección Múltiple para borrar documentos (solo admins)."))
    .addSubcommand((sub) => sub
    .setName("info")
    .setDescription("Muestra la lista de documentos y conocimiento almacenado (solo admins)."));
const command = {
    data,
    adminOnly: false,
    async execute(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: "❌ Solo los administradores pueden usar este comando.",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        const sub = interaction.options.getSubcommand(false) ?? "panel";
        const guildId = interaction.guildId ?? "global";
        // ─── Subcomando: /tryout panel ───────────────────────────────────────────
        if (sub === "panel") {
            await renderTryoutPanel(interaction);
            return;
        }
        // ─── Subcomando: /tryout limpiar ─────────────────────────────────────────
        if (sub === "limpiar") {
            await renderDeleteMultiSelect(interaction);
            return;
        }
        // ─── Subcomando: /tryout info ─────────────────────────────────────────────
        if (sub === "info") {
            await renderInfoView(interaction);
            return;
        }
        // ─── Subcomando: /tryout ia ───────────────────────────────────────────────
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const attachment = interaction.options.getAttachment("archivo");
        const textoInput = interaction.options.getString("texto");
        const pregunta = interaction.options.getString("pregunta");
        const modo = interaction.options.getString("modo") ?? "añadir";
        if (!attachment && !textoInput && !pregunta) {
            await renderTryoutPanel(interaction);
            return;
        }
        let nuevoTexto = "";
        let nuevaFuente = "";
        let tipoFuente = "Texto";
        let seCargoAlgo = false;
        // ── 1. Procesar Archivo (PDF, Word, Excel, Imagen, TXT, etc.) ─────────────
        if (attachment) {
            const ext = getExtension(attachment.name);
            tipoFuente = getTipoLabel(ext);
            if (!TODOS_TIPOS.includes(ext)) {
                await interaction.editReply({
                    content: [
                        `❌ Tipo de archivo no soportado: \`${ext}\``,
                        `Tipos aceptados: PDF, Word, Excel, TXT, MD, CSV, JSON, YAML, XML, PNG, JPG, GIF, WEBP.`,
                    ].join("\n"),
                });
                return;
            }
            let fileBuffer;
            try {
                const res = await fetch(attachment.url);
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                fileBuffer = Buffer.from(await res.arrayBuffer());
            }
            catch (err) {
                console.error("[TRYOUT_IA] Error descargando archivo:", err);
                await interaction.editReply({ content: "❌ No se pudo descargar el archivo." });
                return;
            }
            try {
                const { texto, esImagen } = await parsearArchivo(fileBuffer, ext, attachment.url);
                if (esImagen) {
                    if (!config.groqApiKey) {
                        await interaction.editReply({ content: "❌ No hay API Key de Groq configurada (`GROQ_API_KEY`)." });
                        return;
                    }
                    try {
                        const descripcion = await describirImagen(attachment.url, config.groqApiKey);
                        nuevoTexto = `[Contenido de imagen "${attachment.name}"]:\n${descripcion}`;
                        nuevaFuente = `Imagen: ${attachment.name}`;
                    }
                    catch (err) {
                        console.error("[TRYOUT_IA] Error Groq Vision:", err);
                        await interaction.editReply({ content: "❌ No se pudo analizar la imagen con IA." });
                        return;
                    }
                }
                else {
                    if (!texto || texto.length < 5) {
                        await interaction.editReply({ content: "⚠️ El archivo no contiene texto legible." });
                        return;
                    }
                    nuevoTexto = texto;
                    nuevaFuente = attachment.name;
                }
                seCargoAlgo = true;
            }
            catch (err) {
                console.error("[TRYOUT_IA] Error parseando archivo:", err);
                await interaction.editReply({
                    content: `❌ No se pudo procesar el archivo \`${attachment.name}\`.`,
                });
                return;
            }
        }
        // ── 2. Procesar Texto Manual ──────────────────────────────────────────────
        if (textoInput?.trim()) {
            const textoLimpio = textoInput.trim();
            if (seCargoAlgo) {
                nuevoTexto = nuevoTexto + "\n\n" + textoLimpio;
                nuevaFuente = `${nuevaFuente} + texto manual`;
            }
            else {
                nuevoTexto = textoLimpio;
                nuevaFuente = `Texto manual (${new Date().toLocaleTimeString("es-MX")})`;
                tipoFuente = "Texto";
            }
            seCargoAlgo = true;
        }
        // ── 3. Guardar en Cache ───────────────────────────────────────────────────
        if (seCargoAlgo) {
            if (modo === "reemplazar") {
                documentCache.clear(guildId);
            }
            documentCache.addItem(guildId, {
                name: nuevaFuente,
                type: tipoFuente,
                text: nuevoTexto,
            });
            if (!pregunta) {
                const items = documentCache.getItems(guildId);
                const container = buildTryoutContainer(interaction.guild, interaction.user, 0x2ecc71, "# Tryout IA · Conocimiento Cargado Exitosamente", [
                    `✅ **Se memorizó nueva fuente de información.**`,
                    `› **Nombre:** \`${nuevaFuente}\``,
                    `› **Tipo:** \`${tipoFuente}\``,
                    `› **Modo:** \`${modo === "reemplazar" ? "Reemplazado todo" : "Añadido al conocimiento existente"}\``,
                    `› **Total de fuentes activas:** \`${items.length}\``,
                    "",
                    "Usa el menú de opciones abajo para consultar o gestionar.",
                ].join("\n"), buildMainMenuRow(guildId));
                await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
                return;
            }
        }
        // ── 4. Responder Pregunta si la hay ───────────────────────────────────────
        if (!pregunta) {
            await renderTryoutPanel(interaction);
            return;
        }
        const combined = documentCache.getCombined(guildId);
        if (!config.groqApiKey) {
            await interaction.editReply({ content: "❌ No hay API Key de Groq configurada." });
            return;
        }
        let systemPrompt;
        let modoDoc = false;
        if (combined.count > 0) {
            modoDoc = true;
            systemPrompt =
                `Eres un asistente inteligente de Sonora RP. Hay (${combined.count}) documento(s)/fuente(s) de conocimiento activa(s).\n` +
                    `Si la pregunta está relacionada con el conocimiento cargado, responde ÚNICAMENTE basándote en su contenido.\n` +
                    `Si la pregunta no tiene relación, responde de forma general en español.\n\n` +
                    `--- CONOCIMIENTO CARGADO (${combined.sources}) ---\n${combined.text}\n--- FIN DEL CONOCIMIENTO ---`;
        }
        else {
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
            });
            if (!res.ok) {
                const errData = (await res.json());
                await interaction.editReply({
                    content: `❌ Error de Groq: \`${errData?.error?.message ?? res.status}\``,
                });
                return;
            }
            const resData = (await res.json());
            respuesta = resData?.choices?.[0]?.message?.content?.trim() ?? "Sin respuesta.";
        }
        catch (err) {
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
        const container = buildTryoutContainer(interaction.guild, interaction.user, 0xf55036, "# Tryout IA · Respuesta", `${docInfo}**Pregunta de <@${interaction.user.id}>:**\n> ${pregunta}\n\n**Respuesta:**\n${respuesta}`, buildMainMenuRow(guildId));
        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};
export default command;
