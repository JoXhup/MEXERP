import { MessageFlags, ComponentType } from "discord.js";
import { CATEGORIES } from "../constants/categories.js";
import { buildErrorContainer, buildSuccessContainer } from "../utils/components.js";
import { createTicketChannel, countOpenTickets } from "../utils/ticketHelper.js";
import { setCooldown } from "../utils/cooldown.js";
import { sendLog } from "../utils/logger.js";
import { config } from "../config.js";
// ─── HANDLER: ENVIO DE MODAL V2 ───────────────────────────────────────────────
export async function handleModalSubmit(interaction, client) {
    // customId formato: ticket:modal:<categoryId>
    const parts = interaction.customId.split(":");
    if (parts[0] !== "ticket" || parts[1] !== "modal")
        return;
    const categoryId = parts[2];
    const cat = CATEGORIES[categoryId];
    if (!cat || !interaction.guild) {
        await interaction.reply({
            components: [buildErrorContainer("No se pudo procesar tu solicitud.", client)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Verificar limite de tickets abiertos
    const openCount = await countOpenTickets(interaction.guild.id, interaction.user.id);
    if (openCount >= config.maxOpenTickets) {
        await interaction.editReply({
            components: [buildErrorContainer(`Ya tienes **${openCount}** tickets abiertos. Cierra uno antes de abrir otro.`, client)],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }
    try {
        console.log("[MODAL SUBMIT DEBUG] customId:", interaction.customId);
        console.log("[MODAL SUBMIT DEBUG] interaction.fields keys:", Object.keys(interaction.fields ?? {}));
        console.log("[MODAL SUBMIT DEBUG] interaction.components:", interaction.components);
        console.log("[MODAL SUBMIT DEBUG] interaction.data:", interaction.data);
        // Deep search for resolved attachments in interaction
        const rawData = interaction.data ?? interaction.raw?.data ?? {};
        const resolvedData = rawData.resolved ?? interaction.fields?.resolved ?? interaction.resolved;
        const attachmentsMap = resolvedData?.attachments;
        console.log("[MODAL SUBMIT DEBUG] attachmentsMap:", attachmentsMap);
        // ─── RECOPILAR DATOS DEL MODAL V2 ───────────────────────────────────────
        const modalData = {};
        // 1. Leer TextInputs (metodo clasico, sigue funcionando)
        for (const field of cat.fields) {
            try {
                const value = interaction.fields.getTextInputValue(field.customId);
                if (value)
                    modalData[field.customId] = value;
            }
            catch {
                // Campo opcional no rellenado o es un Select (no TextInput)
            }
        }
        // 2. Leer StringSelects del modal v2 (componentes en los labels o action rows)
        try {
            const rawComponents = interaction.data?.components ?? interaction.components ?? [];
            for (const row of rawComponents) {
                const inner = row?.component ?? row?.components?.[0] ?? row;
                if (inner?.type === ComponentType.StringSelect || inner?.type === 3 || inner?.componentType === ComponentType.StringSelect) {
                    const customId = inner.customId ?? inner.custom_id;
                    const values = inner.values;
                    if (customId && values?.length) {
                        modalData[customId] = values[0];
                    }
                }
            }
        }
        catch {
            // Si no hay selects en el modal, ignorar
        }
        // 3. Leer FileUploads del modal v2 — los archivos subidos llegan en resolved.attachments
        try {
            const fileMap = new Map(); // attachment_id -> url
            // Buscar resolved.attachments en todas las ubicaciones posibles
            const candidateResolved = [
                interaction.fields?.resolved,
                interaction.resolved,
                interaction.data?.resolved,
                interaction.raw?.data?.resolved,
                interaction._rawData?.data?.resolved,
            ];
            for (const res of candidateResolved) {
                if (!res)
                    continue;
                const atts = res.attachments;
                if (!atts)
                    continue;
                if (typeof atts.get === "function") {
                    for (const [id, att] of atts) {
                        const url = att?.url ?? att?.proxyURL ?? att?.proxy_url;
                        if (url)
                            fileMap.set(String(id), url);
                    }
                }
                else if (typeof atts === "object") {
                    for (const id of Object.keys(atts)) {
                        const att = atts[id];
                        const url = att?.url ?? att?.proxy_url ?? att?.proxyURL;
                        if (url)
                            fileMap.set(String(id), url);
                    }
                }
            }
            console.log("[MODAL ATTACHMENTS] Archivos encontrados en resolved:", Array.from(fileMap.values()));
            if (fileMap.size > 0) {
                // Mapear a custom_id si existe
                const rawData = interaction.data ?? interaction.raw?.data ?? {};
                const rawComponents = rawData?.components ?? interaction.components ?? [];
                let matchedAny = false;
                for (const row of rawComponents) {
                    const inner = row?.component ?? row?.components?.[0] ?? row;
                    const isFileUpload = inner?.type === 19 || inner?.componentType === 19;
                    if (isFileUpload) {
                        const customId = inner.customId ?? inner.custom_id;
                        const fileIds = inner.values ?? [];
                        if (customId && fileIds.length) {
                            const urls = fileIds.map((id) => fileMap.get(String(id))).filter(Boolean);
                            if (urls.length) {
                                modalData[customId] = urls.join("\n");
                                matchedAny = true;
                            }
                        }
                    }
                }
                // Fallback: si se subieron archivos pero no se mapearon por custom_id, asignarlos al campo de pruebas
                if (!matchedAny) {
                    const proofKey = cat.fields.find(f => f.customId === "pruebas" || f.customId === "comprobante" || f.customId === "prueba_ganador")?.customId ?? "pruebas";
                    modalData[proofKey] = Array.from(fileMap.values()).join("\n");
                    console.log(`[MODAL ATTACHMENTS] Asignados ${fileMap.size} archivo(s) al campo '${proofKey}' vía fallback`);
                }
            }
        }
        catch (err) {
            console.error("[MODAL] Error al procesar archivos adjuntos:", err);
        }
        // ─── CREAR CANAL DE TICKET ───────────────────────────────────────────────
        const channel = await createTicketChannel(interaction.guild, interaction.user.id, interaction.user.tag, categoryId, modalData, client);
        // Aplicar cooldown
        setCooldown(interaction.user.id, "create_ticket", config.cooldownMs);
        // Responder
        await interaction.editReply({
            components: [buildSuccessContainer("Ticket creado", `Tu ticket ha sido creado en ${channel.toString()}. Un miembro del staff te atendra pronto.`, client)],
            flags: MessageFlags.IsComponentsV2,
        });
        // Log
        await sendLog(client, "Ticket Abierto", `Ticket creado por ${interaction.user.tag}`, [
            { name: "Usuario", value: `<@${interaction.user.id}> (${interaction.user.tag})` },
            { name: "Categoria", value: cat.label },
            { name: "Canal", value: channel.toString() },
            { name: "ID", value: channel.name },
        ]);
    }
    catch (err) {
        console.error("[MODAL] Error creando ticket:", err);
        await interaction.editReply({
            components: [buildErrorContainer("Ocurrio un error al crear tu ticket. Intenta de nuevo mas tarde.", client)],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}
