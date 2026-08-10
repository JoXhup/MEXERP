import { ModalBuilder, LabelBuilder, UserSelectMenuBuilder, TextInputBuilder, TextInputStyle, FileUploadBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from "discord.js";
import { Arrest } from "../models/Arrest.js";
import { getFooterTimestamp } from "../utils/components.js";
// ID del rol requerido para usar el comando
export const ARREST_OFFICER_ROLE_ID = "1532588594659594241";
// ID del rol que se le da al ciudadano arrestado
export const ARRESTED_CITIZEN_ROLE_ID = "1535377528418730075";
// ID del canal donde se envían los logs de arrestos
export const ARREST_LOG_CHANNEL_ID = "1529875976513781981";
// ID del rol Legal (inmune a arrestos)
export const LEGAL_ROLE_ID = "1531406827668115547";
// ID del canal de cadena perpetua (juicio)
export const PERPETUA_CHANNEL_ID = "1535783515063320596";
// Rol a pingar en canal de cadena perpetua
export const PERPETUA_PING_ROLE_ID = "1535783604624302122";
// Rol a pingar cuando cadena perpetua es aceptada (en canal de arrestos)
export const PERPETUA_ACCEPT_ROLE_ID = "1535785095808552990";
// ─── TABLA OOC → IC ─────────────────────────────────────────────────────────
// [oocMs, icLabel]
const OOC_IC_TABLE = [
    [1 * 60 * 1000, "2 horas"],
    [5 * 60 * 1000, "10 horas"],
    [10 * 60 * 1000, "1 día"],
    [30 * 60 * 1000, "3 días"],
    [1 * 3600 * 1000, "5 meses"],
    [2 * 3600 * 1000, "10 meses"],
    [3 * 3600 * 1000, "1 año 3 meses"],
    [6 * 3600 * 1000, "2 años 6 meses"],
    [12 * 3600 * 1000, "5 años"],
    [24 * 3600 * 1000, "10 años"],
];
/** Dado un tiempo OOC en ms, devuelve la etiqueta IC más cercana */
function getIcLabel(oocMs) {
    let closest = OOC_IC_TABLE[0];
    let minDiff = Math.abs(oocMs - OOC_IC_TABLE[0][0]);
    for (const entry of OOC_IC_TABLE) {
        const diff = Math.abs(oocMs - entry[0]);
        if (diff < minDiff) {
            minDiff = diff;
            closest = entry;
        }
    }
    return closest[1];
}
/** Devuelve true si el input es cadena perpetua */
function isCadenaPerpetua(input) {
    const norm = input.trim().toLowerCase().replace(/[^a-záéíóúüñ0-9\s]/gi, "");
    return ["cp", "cadena perpetua", "perpetua", "cadena"].includes(norm);
}
/** Construye el Modal V2 de Arresto */
export function buildArrestarModal() {
    const modal = new ModalBuilder()
        .setCustomId("arrestar:modal")
        .setTitle("Arresto de Ciudadano — Sonora RP");
    // 1. Compañeros (Opción no requerida / UserSelectMenu)
    const l1 = new LabelBuilder()
        .setLabel("Compañeros (Opcional)")
        .setDescription("Selecciona el compañero oficial que apoyó en el arresto")
        .setUserSelectMenuComponent(new UserSelectMenuBuilder()
        .setCustomId("compañeros")
        .setPlaceholder("Selecciona un compañero (opcional)...")
        .setMinValues(0)
        .setMaxValues(1)
        .setRequired(false));
    // 2. Ciudadano (Opción requerida / UserSelectMenu)
    const l2 = new LabelBuilder()
        .setLabel("Ciudadano")
        .setDescription("Selecciona el ciudadano que será arrestado")
        .setUserSelectMenuComponent(new UserSelectMenuBuilder()
        .setCustomId("ciudadano")
        .setPlaceholder("Selecciona el ciudadano...")
        .setMinValues(1)
        .setMaxValues(1));
    // 3. Tiempo (TextInput)
    const l3 = new LabelBuilder()
        .setLabel("Tiempo")
        .setDescription("Formato: s/m/h (Ej: 2h 3m) · Escribe 'cp' para Cadena Perpetua")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("tiempo")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: 2h 3m | cp = Cadena Perpetua")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(30));
    // 4. Cargos Penales (TextInput Paragraph)
    const l4 = new LabelBuilder()
        .setLabel("Cargos Penales")
        .setDescription("Describe los cargos penales del arresto")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("cargos")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Coloca los cargos penales...")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(1000));
    // 5. Addfiles update (FileUpload para la imagen)
    const l5 = new LabelBuilder()
        .setLabel("Addfiles (Imagen / Prueba)")
        .setDescription("Sube una imagen o fotografía de prueba del arresto (opcional)")
        .setFileUploadComponent(new FileUploadBuilder()
        .setCustomId("imagen")
        .setMinValues(0)
        .setMaxValues(1)
        .setRequired(false));
    modal.addLabelComponents(l1, l2, l3, l4, l5);
    return modal;
}
/** Parsea un string de tiempo como "2h 3m", "45m", "30s" y devuelve milisegundos */
export function parseDuration(input) {
    const regex = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i;
    const trimmed = input.trim();
    const match = trimmed.match(regex);
    if (!match || (!match[1] && !match[2] && !match[3])) {
        return null;
    }
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds > 0 ? totalSeconds * 1000 : null;
}
/** Maneja la entrega del Modal V2 de Arresto */
export async function handleArrestarModalSubmit(interaction, client) {
    // Defer reply ephemerally
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // 1. Extraer campos del modal
    const selectedCitizens = interaction.fields.getSelectedUsers("ciudadano");
    const citizenUser = selectedCitizens?.first();
    const selectedPartners = interaction.fields.getSelectedUsers("compañeros");
    const partnerUser = selectedPartners?.first();
    const tiempoInput = interaction.fields.getTextInputValue("tiempo").trim();
    const cargosInput = interaction.fields.getTextInputValue("cargos").trim();
    const uploadedFiles = interaction.fields.getUploadedFiles("imagen");
    const imageFile = uploadedFiles?.first();
    // Helper para error rápido (naranja)
    const sendError = async (title, desc) => {
        const errContainer = new ContainerBuilder()
            .setAccentColor(0xe67e22)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
        await interaction.editReply({
            components: [errContainer],
            flags: MessageFlags.IsComponentsV2,
        });
    };
    // Validar selección de ciudadano
    if (!citizenUser) {
        await sendError("Ciudadano No Seleccionado", "Debes seleccionar al menos a un ciudadano para efectuar el arresto.");
        return;
    }
    // Validar: no puedes arrestarte a ti mismo
    if (citizenUser.id === interaction.user.id) {
        await sendError("Acción No Permitida", "No puedes arrestarte a ti mismo.");
        return;
    }
    // Validar: ciudadano con rol Legal no puede ser arrestado
    try {
        const citizenMember = await interaction.guild?.members.fetch(citizenUser.id);
        if (citizenMember?.roles.cache.has(LEGAL_ROLE_ID)) {
            await sendError("Ciudadano Inmune", `<@${citizenUser.id}> pertenece al departamento **Legal** y no puede ser arrestado.\nSi crees que esto es un error, contacta a un administrador.`);
            return;
        }
    }
    catch (err) {
        console.error("[ARREST] Error verificando rol Legal del ciudadano:", err);
    }
    // ─── CADENA PERPETUA ──────────────────────────────────────────────────────
    if (isCadenaPerpetua(tiempoInput)) {
        await handleCadenaPerpetua(interaction, client, citizenUser, partnerUser, cargosInput, imageFile?.url);
        return;
    }
    // 2. Parsear tiempo
    const durationMs = parseDuration(tiempoInput);
    if (!durationMs) {
        await sendError("Formato de Tiempo Inválido", [
            `El tiempo ingresado (\`${tiempoInput}\`) no es válido.`,
            "",
            "**Formato aceptado:**",
            "• `s` = segundos (ej: `30s`)",
            "• `m` = minutos (ej: `45m`)",
            "• `h` = horas (ej: `2h 3m`)",
            "• `cp` = Cadena Perpetua (va a juicio)",
            "",
            "**Ejemplo:** `2h 3m` son 2 horas y 3 minutos.",
        ].join("\n"));
        return;
    }
    const icLabel = getIcLabel(durationMs);
    const expiresAt = new Date(Date.now() + durationMs);
    const expiresUnix = Math.floor(expiresAt.getTime() / 1000);
    // 3. Asignar el rol de arrestado al ciudadano
    try {
        const member = await interaction.guild?.members.fetch(citizenUser.id);
        if (member) {
            await member.roles.add(ARRESTED_CITIZEN_ROLE_ID).catch(() => null);
        }
    }
    catch (err) {
        console.error("[ARREST] Error asignando rol de arrestado:", err);
    }
    // 4. Guardar en base de datos MongoDB
    try {
        await Arrest.create({
            citizenId: citizenUser.id,
            officerId: interaction.user.id,
            partnerId: partnerUser?.id,
            tiempoStr: tiempoInput,
            durationMs,
            expiresAt,
            cargos: cargosInput,
        });
    }
    catch (err) {
        console.error("[ARREST] Error guardando registro en DB:", err);
    }
    // 5. Programar temporizador para quitar el rol al vencer
    scheduleArrestExpiration(client, interaction.guildId, citizenUser.id, durationMs);
    // 6. Enviar log de arresto al canal
    try {
        const logChannel = await client.channels.fetch(ARREST_LOG_CHANNEL_ID).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
            const textChan = logChannel;
            const citizenAvatar = citizenUser.displayAvatarURL({ extension: "png", size: 256 });
            const logContainer = new ContainerBuilder()
                .setAccentColor(0x992d22)
                .addSectionComponents(new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# REGISTRO DE ARRESTO\n**Oficial al mando:** <@${interaction.user.id}>`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(citizenAvatar)))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent([
                `**DATOS DEL ARRESTO**`,
                `› **Ciudadano:** <@${citizenUser.id}> (${citizenUser.username})`,
                `› **Compañeros:** ${partnerUser ? `<@${partnerUser.id}>` : "Ninguno"}`,
                `› **Tiempo de Condena:** \`${tiempoInput}\` (Libre: <t:${expiresUnix}:R>)`,
                `  · **IC:** ${icLabel}`,
                `  · **OOC:** ${tiempoInput}`,
                `› **Cargos Penales:**\n> ${cargosInput}`,
            ].join("\n")));
            if (imageFile?.url) {
                logContainer
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageFile.url)));
            }
            logContainer
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`));
            await textChan.send({
                components: [logContainer],
                // @ts-ignore — Components V2 flag
                flags: MessageFlags.IsComponentsV2,
            });
        }
    }
    catch (logErr) {
        console.error("[ARREST] Error enviando log al canal:", logErr);
    }
    // 7. Enviar DM al ciudadano arrestado
    try {
        const officerAvatar = interaction.user.displayAvatarURL({ extension: "png", size: 256 });
        const dmContainer = new ContainerBuilder()
            .setAccentColor(0xe67e22)
            .addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Has sido arrestado\nSonora RP — Departamento de Policía"))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(officerAvatar)))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            "**DETALLES DEL ARRESTO**",
            `› **Oficial:** <@${interaction.user.id}>`,
            `› **Condena:** \`${tiempoInput}\``,
            `  · **IC:** ${icLabel}`,
            `  · **OOC:** ${tiempoInput}`,
            `› **Liberación:** <t:${expiresUnix}:R>`,
            `› **Cargos:**\n> ${cargosInput}`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Notificación automática"));
        await citizenUser.send({
            components: [dmContainer],
            // @ts-ignore — Components V2 flag
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);
    }
    catch (dmErr) {
        console.error("[ARREST] Error enviando DM al ciudadano:", dmErr);
    }
    // 8. Responder de forma efímera al oficial confirmando el arresto
    const confirmContainer = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Arresto Registrado Exitosamente"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `El arresto de <@${citizenUser.id}> ha sido procesado correctamente.`,
        `› **Tiempo OOC:** \`${tiempoInput}\``,
        `› **Tiempo IC:** ${icLabel}`,
        `› **Liberación:** <t:${expiresUnix}:R>`,
        `› **Rol asignado:** <@&${ARRESTED_CITIZEN_ROLE_ID}>`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
    await interaction.editReply({
        components: [confirmContainer],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── CADENA PERPETUA ─────────────────────────────────────────────────────────
/** Maneja el flujo de Cadena Perpetua — manda al canal de juicio con botones */
async function handleCadenaPerpetua(interaction, client, citizenUser, partnerUser, cargosInput, imageUrl) {
    try {
        const perpetuaChannel = await client.channels.fetch(PERPETUA_CHANNEL_ID).catch(() => null);
        if (!perpetuaChannel || !perpetuaChannel.isTextBased()) {
            await interaction.editReply({ content: "❌ No se pudo acceder al canal de juicio." });
            return;
        }
        const textChan = perpetuaChannel;
        const guildIcon = interaction.guild?.iconURL({ extension: "png", size: 256 }) ?? citizenUser.displayAvatarURL({ extension: "png", size: 256 });
        const nowUnix = Math.floor(Date.now() / 1000);
        // Botones dentro del container
        const buttons = new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId(`arrest:cp:accept:${citizenUser.id}:${interaction.user.id}:${partnerUser?.id ?? "none"}`)
            .setLabel("Aceptar")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success), new ButtonBuilder()
            .setCustomId(`arrest:cp:reject:${citizenUser.id}:${interaction.user.id}`)
            .setLabel("Rechazar")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Danger));
        // Container V2 — ping incluido, solo guild icon como thumbnail
        const cpContainer = new ContainerBuilder()
            .setAccentColor(0x1a1a2e)
            .addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`<@&${PERPETUA_PING_ROLE_ID}>\n# ⚖️ SOLICITUD DE CADENA PERPETUA\n**Oficial solicitante:** <@${interaction.user.id}>`))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIcon)))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            "**ACUSADO**",
            `› **Ciudadano:** <@${citizenUser.id}> (${citizenUser.username})`,
            `› **Compañeros en operativo:** ${partnerUser ? `<@${partnerUser.id}>` : "Ninguno"}`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(["**CARGOS PENALES**", `> ${cargosInput}`].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`› **Solicitado:** <t:${nowUnix}:F>\n› **Veredicto requerido:** Aceptar o Rechazar la sentencia de Cadena Perpetua`));
        if (imageUrl) {
            cpContainer
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)));
        }
        cpContainer
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP — Sistema Judicial · ${getFooterTimestamp()}`))
            .addActionRowComponents(buttons);
        // Un solo mensaje (ping en el texto del container)
        await textChan.send({
            components: [cpContainer],
            // @ts-ignore — Components V2 flag
            flags: MessageFlags.IsComponentsV2,
        });
    }
    catch (err) {
        console.error("[ARREST CP] Error enviando solicitud de cadena perpetua:", err);
    }
    // Confirmar al oficial efímeramente
    const confirmContainer = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Solicitud Enviada al Tribunal"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `La solicitud de **Cadena Perpetua** para <@${citizenUser.id}> ha sido enviada para su revision.`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
    await interaction.editReply({
        components: [confirmContainer],
        flags: MessageFlags.IsComponentsV2,
    });
}
/** Maneja los botones de Aceptar / Rechazar de Cadena Perpetua */
export async function handleCpButton(interaction, client) {
    const parts = interaction.customId.split(":");
    // arrest:cp:accept/reject:citizenId:officerId:partnerId
    const action = parts[2]; // "accept" | "reject"
    const citizenId = parts[3];
    const officerId = parts[4];
    const partnerId = parts[5] !== "none" ? parts[5] : null;
    if (action === "accept") {
        // Dar rol de arrestado al ciudadano
        try {
            const member = await interaction.guild?.members.fetch(citizenId);
            if (member) {
                await member.roles.add(ARRESTED_CITIZEN_ROLE_ID).catch(() => null);
            }
        }
        catch (err) {
            console.error("[ARREST CP] Error asignando rol de cadena perpetua:", err);
        }
        // Enviar al canal de arrestos (ping separado + container negro)
        try {
            const logChannel = await client.channels.fetch(ARREST_LOG_CHANNEL_ID).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
                const logChan = logChannel;
                const citizenUser = await client.users.fetch(citizenId).catch(() => null);
                const officerUser = await client.users.fetch(officerId).catch(() => null);
                const citizenAvatar = citizenUser?.displayAvatarURL({ extension: "png", size: 256 }) ?? "";
                const approvedUnix = Math.floor(Date.now() / 1000);
                const logContainer = new ContainerBuilder()
                    .setAccentColor(0x000000)
                    .addSectionComponents(new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⛓️ CADENA PERPETUA — APROBADA\n**Juez/Autoridad:** <@${interaction.user.id}>`))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(citizenAvatar)))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
                    `**DATOS DEL CASO**`,
                    `› **Arrestad@:** <@${citizenId}>${citizenUser ? ` (${citizenUser.username})` : ""}`,
                    `› **Encargado:** <@${officerId}>${officerUser ? ` (${officerUser.username})` : ""}`,
                    partnerId ? `› **Sub Oficiales:** <@${partnerId}>` : `› **Sub Oficiales:** Ninguno`,
                    `› **Sentencia:** Cadena Perpetua — **Va a juicio**`,
                    `› **Aprobado:** <t:${approvedUnix}:F>`,
                ].join("\n")))
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`));
                // Ping separado luego container
                await logChan.send({
                    content: `<@&${PERPETUA_ACCEPT_ROLE_ID}> — Cadena Perpetua aprobada para <@${citizenId}>`,
                });
                await logChan.send({
                    components: [logContainer],
                    // @ts-ignore
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        }
        catch (err) {
            console.error("[ARREST CP] Error enviando log de cadena perpetua aceptada:", err);
        }
        // Actualizar mensaje en canal de juicio — container verde
        const acceptedContainer = new ContainerBuilder()
            .setAccentColor(0x2ecc71)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            "# ✅ CADENA PERPETUA — ACEPTADA",
            `**Aprobado por:** <@${interaction.user.id}>`,
            `**Ciudadano:** <@${citizenId}>`,
            `**Oficial solicitante:** <@${officerId}>`,
            `<t:${Math.floor(Date.now() / 1000)}:F>`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora RP — Sistema Judicial"));
        await interaction.update({
            components: [acceptedContainer],
            // @ts-ignore
            flags: MessageFlags.IsComponentsV2,
        });
        // DM al oficial que solicitó el CP
        try {
            const officerUser = await client.users.fetch(officerId).catch(() => null);
            if (officerUser) {
                const dmEmbed = new EmbedBuilder()
                    .setDescription("Tu solicitud de **C.P (Cadena Perpetua)** fue aceptado.")
                    .setColor(0x2ecc71);
                await officerUser.send({ embeds: [dmEmbed] }).catch(() => null);
            }
        }
        catch (err) {
            console.error("[ARREST CP] Error enviando DM al oficial:", err);
        }
    }
    else {
        // Rechazar — container rojo
        const rejectedContainer = new ContainerBuilder()
            .setAccentColor(0xe74c3c)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            "# ❌ CADENA PERPETUA — RECHAZADA",
            `**Rechazado por:** <@${interaction.user.id}>`,
            `**Ciudadano:** <@${citizenId}>`,
            `**Oficial solicitante:** <@${officerId}>`,
            `<t:${Math.floor(Date.now() / 1000)}:F>`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora RP — Sistema Judicial"));
        await interaction.update({
            components: [rejectedContainer],
            // @ts-ignore
            flags: MessageFlags.IsComponentsV2,
        });
    }
}
/** Programa la expiración del rol de arrestado */
export function scheduleArrestExpiration(client, guildId, citizenId, delayMs) {
    setTimeout(async () => {
        try {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                const member = await guild.members.fetch(citizenId).catch(() => null);
                if (member) {
                    await member.roles.remove(ARRESTED_CITIZEN_ROLE_ID).catch(() => null);
                    console.log(`[ARREST] Rol de arrestado removido para ciudadano ${citizenId}`);
                }
            }
            await Arrest.deleteMany({ citizenId }).catch(() => null);
        }
        catch (err) {
            console.error("[ARREST] Error removiendo rol de arrestado expirado:", err);
        }
    }, Math.max(delayMs, 1000));
}
/** Recupera y re-programa los arrestos activos al iniciar el bot */
export async function restoreActiveArrests(client) {
    try {
        const activeArrests = await Arrest.find({});
        const now = Date.now();
        for (const arrest of activeArrests) {
            const remainingMs = arrest.expiresAt.getTime() - now;
            if (remainingMs <= 0) {
                await Arrest.deleteOne({ _id: arrest._id }).catch(() => null);
                const guildId = process.env.GUILD_ID ?? "1528571127352262866";
                const guild = await client.guilds.fetch(guildId).catch(() => null);
                if (guild) {
                    const member = await guild.members.fetch(arrest.citizenId).catch(() => null);
                    if (member) {
                        await member.roles.remove(ARRESTED_CITIZEN_ROLE_ID).catch(() => null);
                    }
                }
            }
            else {
                const guildId = process.env.GUILD_ID ?? "1528571127352262866";
                scheduleArrestExpiration(client, guildId, arrest.citizenId, remainingMs);
            }
        }
        console.log(`[ARREST] ${activeArrests.length} arrestos activos restaurados/comprobados.`);
    }
    catch (err) {
        console.error("[ARREST] Error restaurando arrestos activos:", err);
    }
}
