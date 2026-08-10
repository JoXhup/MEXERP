import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, SeparatorSpacingSize, } from "discord.js";
import { CATEGORIES, CATEGORY_ORDER } from "../constants/categories.js";
import { config } from "../config.js";
// ─── HELPERS DE FECHA ──────────────────────────────────────────────────────────
export function getFooterTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
    const time = now.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
    });
    return `${date} · ${time}`;
}
// ─── PRIORIDAD DISPLAY ─────────────────────────────────────────────────────────
export const PRIORITY_DISPLAY = {
    low: { label: "Baja" },
    medium: { label: "Media" },
    high: { label: "Alta" },
    critical: { label: "Critica" },
};
// ─── PANEL PRINCIPAL (COMPONENTS V2 CONTAINER) ────────────────────────────────
export function buildPanelContainer(client, guildIconUrl) {
    const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
    // Opciones del select menu
    const options = CATEGORY_ORDER.map(catId => {
        const cat = CATEGORIES[catId];
        return new StringSelectMenuOptionBuilder()
            .setLabel(cat.label)
            .setDescription(cat.description)
            .setValue(catId)
            .setEmoji(cat.emoji);
    });
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket:select_category")
        .setPlaceholder("Elige la categoría que mejor describa tu consulta...")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options);
    const selectRow = new ActionRowBuilder()
        .addComponents(selectMenu);
    const headerText = "# 🆘 Soporte & Ayuda\n**Bienvenid@** al apartado de ayuda y atencion a los usuarios de forma **OOC**, revisa con lo que podemos ayudarte y auxiliarte para tu mejor atencion.";
    const categoriesText = [
        "🛡️ **Reportar**\nInforma sobre un jugador que haya incumplido las normas del servidor.",
        "👮 **Reportar Staff**\nSi tuviste un problema con un miembro del equipo, cuéntanos qué ocurrió.",
        "📋 **Petición de Rol**\nSolicita un rol y adjunta las pruebas o requisitos necesarios.",
        "🔒 **Reporte Confidencial**\nEnvía un reporte de forma confidencial cuando la situación lo requiera.",
        "🎭 **Remover Rol**\nSolicita que se retire un rol de tu cuenta o de otro usuario cuando corresponda.",
        "💵 **IRL**\nSoporte para compras realizadas con dinero real o Robux.",
        "🎁 **Reclamar Sorteo**\nReclama el premio de un sorteo que hayas ganado.",
        "🤝 **Empresas y Facciones**\nCrea una empresa o facción, o solicita ayuda relacionada con una existente.",
        "📦 **Otros**\nSi tu consulta no encaja en ninguna categoría, abre un ticket aquí.",
        "💬 **Dudas Generales**\nHaz cualquier pregunta sobre el servidor y con gusto te ayudaremos.",
    ].join("\n\n");
    const recuerdaText = [
        "**❗RECUERDA**",
        "* Usa el sistema con madurez, cualquier chiste & broma sera una sancion directa sin apelacion.",
        "* Recuerda que todo reporte puede variar en su tiempo de respuesta, no hagas **ping a moderadores.**",
        "* Recuerda mantener una actitud deacuerdo a la normativa especifica dentro del servidor y en atención con la moderacion.",
    ].join("\n");
    return new ContainerBuilder()
        .setAccentColor(0x5865f2) // Azul-morado Blurple
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(categoriesText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(recuerdaText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(selectRow)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
}
// ─── PANEL DE JORNADAS STAFF (CHANNEL 1528869236687110215) ─────────────────
export function buildJornadasPanelContainer(client, guildIconUrl) {
    const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
    const startBtn = new ButtonBuilder()
        .setCustomId("jornada:start")
        .setLabel("Iniciar Turno")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success);
    const manageBtn = new ButtonBuilder()
        .setCustomId("jornada:manage")
        .setLabel("Gestionar")
        .setEmoji("⚙️")
        .setStyle(ButtonStyle.Primary);
    const row = new ActionRowBuilder().addComponents(startBtn, manageBtn);
    return new ContainerBuilder()
        .setAccentColor(0x7c3aed) // Morado
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Jornadas Staff\n> Inicia tu turno administrativo para moderar."))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("**Instrucciones**"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Para iniciar tu jornada da click en el boton **✅ Iniciar Turno**"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Para gestionar tu jornada da click en el boton **⚙️ Gestionar**"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Para realizar un breve descanso pulsa en el boton **⏸️ Pausar** y para reincorporarte da click en el boton **⏯️ Volver**"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("El boton **❗ Finalizar** para terminar tu tiempo de moderacion."))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Si tienes dudas en el funcionamiento comunicate con un administrador."))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(row)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff`));
}
// ─── PANEL DE GESTIÓN DE APERTURAS (CHANNEL 1532163697559208027) ─────────────
export function buildAperturasPanelContainer(client, guildIconUrl) {
    const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
    const abrirBtn = new ButtonBuilder()
        .setCustomId("apertura:abrir")
        .setLabel("Abrir")
        .setEmoji("🟢")
        .setStyle(ButtonStyle.Success);
    const mantenimientoBtn = new ButtonBuilder()
        .setCustomId("apertura:mantenimiento")
        .setLabel("Mantenimiento")
        .setEmoji("🟡")
        .setStyle(ButtonStyle.Secondary);
    const cierreBtn = new ButtonBuilder()
        .setCustomId("apertura:cierre")
        .setLabel("Cierre")
        .setEmoji("🔴")
        .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(abrirBtn, mantenimientoBtn, cierreBtn);
    return new ContainerBuilder()
        .setAccentColor(0x3b82f6) // Azul
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Gestion de Aperturas\n*Usalo para manipular el estado del servidor en ER:LC*\n> Este sistema actualmente es manipulado en discord, no tiene ningun efecto en ERLC."))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("🟢 Envia la notificacion de apertura del servidor"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("🟡 Mantenimiento del servidor"))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("🔴 Cierre del servidor"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Usalo correctamente, el mal uso sera sancionado."))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(row)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff`));
}
// ─── HELPER COLOR ALEATORIO ───────────────────────────────────────────────────
export function getRandomColor() {
    const colors = [
        0x7c3aed, // Morado
        0x3b82f6, // Azul
        0x10b981, // Verde
        0xf59e0b, // Naranja
        0xec4899, // Rosa
        0x8b5cf6, // Violeta
        0x06b6d4, // Cyan
        0x10b981, // Esmeralda
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
// ─── CONTAINER DEL TICKET ─────────────────────────────────────────────────────
export function buildTicketContainer(ticket, client, guildIconUrl) {
    const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
    const cat = CATEGORIES[ticket.category];
    const staffPing = `<@&${config.staffRoleId}>`;
    const headerText = `# ${cat.emoji} ${cat.label} - Sonora RP\nHola, tu solicitud esta creada, espera a un miembro del staff para ser **atendid@** ${staffPing}`;
    // Información de tu Ticket
    const infoLines = ["📝 **Información de tu Ticket:**"];
    const imageUrls = [];
    // Campos del modal (solo si el usuario rellenó información)
    for (const [key, value] of ticket.modalData) {
        if (!value || !value.trim())
            continue; // Si es opcional y no puso nada, no aparece
        const fieldDef = cat.fields.find(f => f.customId === key);
        const label = fieldDef?.label ?? key;
        const lines = value.split("\n").map(l => l.trim()).filter(Boolean);
        const urls = lines.filter(l => l.startsWith("attachment://") || l.startsWith("http://") || l.startsWith("https://"));
        if (urls.length > 0) {
            imageUrls.push(...urls);
            infoLines.push(`**${label}:**\n* 🖼️ ${urls.length} archivo(s) adjunto(s)`);
        }
        else {
            infoLines.push(`**${label}:**\n* ${value.trim()}`);
        }
    }
    // Usuario
    infoLines.push(`**Usuario:**\n* <@${ticket.ownerId}>`);
    // Registro (Fecha)
    const openedTimestamp = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
    infoLines.push(`**Registro (Fecha):**\n* <t:${openedTimestamp}:f>`);
    // Estado
    const statusText = ticket.claimedBy
        ? `* 🟢 Atendido por <@${ticket.claimedBy}>`
        : `* 🟡 Espera de atencion`;
    infoLines.push(`**Estado:**\n${statusText}`);
    // Botón Reclamar con estado
    const claimBtn = new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticket.channelId}`)
        .setEmoji("✅");
    if (ticket.claimedBy) {
        claimBtn
            .setLabel(`Reclamado por ${ticket.claimedByTag ?? "Staff"}`)
            .setStyle(ButtonStyle.Success)
            .setDisabled(true);
    }
    else {
        claimBtn
            .setLabel("Reclamar")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false);
    }
    const claimRow = new ActionRowBuilder().addComponents(claimBtn);
    // Select menu con las opciones de Cerrar / Transcript
    const managementSelect = new StringSelectMenuBuilder()
        .setCustomId(`ticket:management:${ticket.channelId}`)
        .setPlaceholder("Opciones de gestión...")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(new StringSelectMenuOptionBuilder()
        .setLabel("Cerrar")
        .setValue("close")
        .setEmoji("🔒")
        .setDescription("Cierra este ticket"), new StringSelectMenuOptionBuilder()
        .setLabel("Transcript")
        .setValue("transcript")
        .setEmoji("📰")
        .setDescription("Genera la transcripción de este ticket"));
    const selectRow = new ActionRowBuilder().addComponents(managementSelect);
    const container = new ContainerBuilder()
        .setAccentColor(getRandomColor()) // Color aleatorio
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(infoLines.join("\n")));
    // Si hay imágenes subidas, agregamos MediaGallery arriba del botón Reclamar y la línea separadora
    if (imageUrls.length > 0) {
        console.log("[CONTAINER] Agregando imágenes a MediaGallery:", imageUrls);
        const galleryItems = imageUrls.slice(0, 10).map(url => ({ media: { url } }));
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
        container.components.push({
            type: 12, // ComponentType.MEDIA_GALLERY
            items: galleryItems,
            toJSON() {
                return {
                    type: 12,
                    items: galleryItems,
                };
            },
        });
    }
    container
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(claimRow)
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(selectRow)
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
    return container;
}
// ─── CONTAINER DE LOG ─────────────────────────────────────────────────────────
export function buildLogContainer(action, description, fields, client) {
    const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";
    const fieldsText = fields.map(f => `**${f.name}:** ${f.value}`).join("\n");
    return new ContainerBuilder()
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${action}\n${description}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)))
        .addSeparatorComponents(new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(fieldsText))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
}
// ─── CONTAINER DE ERROR ───────────────────────────────────────────────────────
export function buildErrorContainer(message, client) {
    const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";
    return new ContainerBuilder()
        .setAccentColor(0xef4444) // Rojo — Error / Sin Permisos
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Permisos Insuficientes / Error\n${message}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
}
// ─── CONTAINER DE EXITO ───────────────────────────────────────────────────────
export function buildSuccessContainer(title, message, client) {
    const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";
    return new ContainerBuilder()
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}\n${message}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
}
// ─── CONTAINER DE PRIORIDAD ───────────────────────────────────────────────────
export function buildPrioritySelectContainer(channelId, client) {
    const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";
    const lowBtn = new ButtonBuilder()
        .setCustomId(`ticket:setpriority:${channelId}:low`)
        .setLabel("Baja")
        .setStyle(ButtonStyle.Secondary);
    const medBtn = new ButtonBuilder()
        .setCustomId(`ticket:setpriority:${channelId}:medium`)
        .setLabel("Media")
        .setStyle(ButtonStyle.Primary);
    const highBtn = new ButtonBuilder()
        .setCustomId(`ticket:setpriority:${channelId}:high`)
        .setLabel("Alta")
        .setStyle(ButtonStyle.Danger);
    const critBtn = new ButtonBuilder()
        .setCustomId(`ticket:setpriority:${channelId}:critical`)
        .setLabel("Critica")
        .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder()
        .addComponents(lowBtn, medBtn, highBtn, critBtn);
    return new ContainerBuilder()
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Cambiar Prioridad\nSelecciona la nueva prioridad para este ticket.`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)))
        .addSeparatorComponents(new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true))
        .addActionRowComponents(row)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
}
// ─── CONTAINER DE ESTADISTICAS ────────────────────────────────────────────────
export function buildStatsContainer(stats, client) {
    const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";
    const rows = stats
        .map((s, i) => `**${i + 1}.** ${s.userTag} — Reclamados: **${s.totalClaimed}** · Cerrados: **${s.totalClosed}** · Transcripciones: **${s.totalTranscripts}**`)
        .join("\n");
    return new ContainerBuilder()
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Estadisticas del Staff\nRanking basado en actividad en tickets.`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)))
        .addSeparatorComponents(new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(rows || "Sin datos registrados."))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
}
export function formatShiftTime(ms) {
    if (!ms || ms <= 0)
        return "0";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}
export function buildStaffProfileContainer(targetMember, processedCount, robloxName, hiredAt, client, totalShiftTimeMs) {
    const userAvatar = targetMember.user.displayAvatarURL({ size: 256 });
    const HIERARCHY_ROLES = [
        "1528876703450136737",
        "1528876795783282880",
        "1529312367706378341",
        "1529312300207443978",
        "1529322176757628970",
        "1531855122634772630",
        "1531420532753305853",
        "1531835160222503123",
        "1531825255889506506",
    ];
    const matchingRoleId = HIERARCHY_ROLES.find(roleId => targetMember.roles.cache.has(roleId));
    const rangoDisplay = matchingRoleId
        ? `<@&${matchingRoleId}>`
        : (targetMember.roles.highest && targetMember.roles.highest.id !== targetMember.guild.id
            ? `<@&${targetMember.roles.highest.id}>`
            : "Sin Rango");
    const robloxText = robloxName ? `**${robloxName}**` : "*Sin registro*";
    const fechaIngresoText = hiredAt
        ? `<t:${Math.floor(hiredAt.getTime() / 1000)}:F>`
        : "*Sin fecha de contratacion.*";
    const infoStaffText = [
        "**Informacion del staff:**",
        `* <:discotoolsxyzicon4:1532137819726675968> Usuario:\n<@${targetMember.id}> (@${targetMember.user.username})`,
        `* <:discotoolsxyzicon5:1532137818652934324> Roblox user vinculado:\n${robloxText}`,
        `* <:discotoolsxyzicon2:1532137821949923569> Fecha de Ingreso:\n${fechaIngresoText}`,
        `* <:discotoolsxyzicon6:1532137817843437741> Rango:\n${rangoDisplay}`,
    ].join("\n");
    const horasDisplay = formatShiftTime(totalShiftTimeMs);
    const statsText = [
        "**Estadisticas:**",
        `* <:discotoolsxyzicon3:1532137821077504020> Tickets Atendidos:\n${processedCount}`,
        `* <:discotoolsxyzicon8:1532141321198764093> Horas Realizadas:\n${horasDisplay}`,
    ].join("\n");
    const sancionesText = [
        "**Sanciones:**",
        `* <:discotoolsxyzicon7:1532137816832606449> Advertencias:\n*Sin registro de advertencias administrativas*`,
    ].join("\n");
    return new ContainerBuilder()
        .setAccentColor(getRandomColor())
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Perfil Administrativo"))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatar)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(infoStaffText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(sancionesText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));
}
