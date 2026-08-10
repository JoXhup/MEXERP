import { Events, AuditLogEvent, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, MessageFlags, } from "discord.js";
// Roles monitoreados de bonificación
const MONITORED_ROLES = [
    "1529598709653049385",
    "1530686768586821842",
    "1529585650070851737",
];
// Roles autorizados para otorgar o quitar los roles monitoreados
const WHITELIST_ROLES = [
    "1532445933785186444",
    "1532446141809954968",
];
// Rol a hacer ping si se activa la alarma por usuario no autorizado
const ALERT_PING_ROLE_ID = "1532446141809954968";
// Canal de logs de auditoría de roles
const AUDIT_LOG_CHANNEL_ID = "1536293235528310897";
export const name = Events.GuildMemberUpdate;
export async function execute(oldMember, newMember) {
    try {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        // Detectar roles agregados y removidos
        const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id));
        const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id));
        // Filtrar cambios en los roles monitoreados
        const monitoredAdded = addedRoles.filter((role) => MONITORED_ROLES.includes(role.id));
        const monitoredRemoved = removedRoles.filter((role) => MONITORED_ROLES.includes(role.id));
        if (monitoredAdded.size === 0 && monitoredRemoved.size === 0) {
            return;
        }
        const guild = newMember.guild;
        const logChannel = guild.channels.cache.get(AUDIT_LOG_CHANNEL_ID)
            ?? await guild.channels.fetch(AUDIT_LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) {
            return;
        }
        // Esperar un momento breve para que Discord registre la entrada en los Audit Logs
        await new Promise((res) => setTimeout(res, 1200));
        // Buscar la entrada correspondiente en Audit Logs
        const auditLogs = await guild
            .fetchAuditLogs({
            limit: 5,
            type: AuditLogEvent.MemberRoleUpdate,
        })
            .catch(() => null);
        const logEntry = auditLogs?.entries.find((entry) => entry.target?.id === newMember.id);
        const executorUser = logEntry?.executor ?? null;
        let executorMember = null;
        if (executorUser) {
            executorMember =
                guild.members.cache.get(executorUser.id) ??
                    (await guild.members.fetch(executorUser.id).catch(() => null));
        }
        // Verificar si el ejecutor tiene alguno de los roles whitelist autorizados
        const isAuthorized = executorMember
            ? executorMember.roles.cache.some((r) => WHITELIST_ROLES.includes(r.id))
            : false;
        const guildIcon = guild.iconURL({ extension: "png", size: 256 }) ??
            "https://i.erlc.gg/erlc-logo.png";
        const now = new Date();
        const dateStr = now.toLocaleString("es-MX", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        // Procesar cada rol agregado
        for (const [, role] of monitoredAdded) {
            await sendRoleAuditLog({
                logChannel,
                guildIcon,
                actionType: "ADDED",
                roleName: role.name,
                roleId: role.id,
                targetMember: newMember,
                executorUser,
                isAuthorized,
                dateStr,
            });
        }
        // Procesar cada rol removido
        for (const [, role] of monitoredRemoved) {
            await sendRoleAuditLog({
                logChannel,
                guildIcon,
                actionType: "REMOVED",
                roleName: role.name,
                roleId: role.id,
                targetMember: newMember,
                executorUser,
                isAuthorized,
                dateStr,
            });
        }
    }
    catch (err) {
        console.error("[ROLE_AUDIT] Error procesando auditoría de roles:", err);
    }
}
async function sendRoleAuditLog(options) {
    const { logChannel, guildIcon, actionType, roleName, roleId, targetMember, executorUser, isAuthorized, dateStr, } = options;
    const actionText = actionType === "ADDED" ? "🟢 Rol Otorgado (+)" : "🔴 Rol Retirado (-)";
    const containerColor = isAuthorized ? 0x2ecc71 : 0xe74c3c; // Verde si autorizado, Rojo si alarma
    const titleText = isAuthorized
        ? "# 📋 Auditoría de Roles · Acción Autorizada"
        : `# 🚨 ALARMA DE SEGURIDAD - AUDITORÍA DE ROLES\n<@&${ALERT_PING_ROLE_ID}>`;
    const detailsText = [
        `› **Acción:** ${actionText}`,
        `› **Rol:** <@&${roleId}> (\`${roleName}\`)`,
        `› **Ejecutado por:** ${executorUser ? `<@${executorUser.id}> (\`${executorUser.tag ?? executorUser.username}\`)` : "*Desconocido / Sistema*"}`,
        `› **Usuario afectado:** <@${targetMember.id}> (\`${targetMember.user.tag ?? targetMember.user.username}\`)`,
        `› **Estado:** ${isAuthorized ? "✅ Autorizado" : "⚠️ **NO AUTORIZADO (Alarma Activada)**"}`,
    ].join("\n");
    const container = new ContainerBuilder()
        .setAccentColor(containerColor)
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(titleText))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIcon)))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(detailsText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · Auditoría de Roles · ${dateStr}`));
    await logChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        // allowedMentions: solo permite ping al rol de alerta si no está autorizado
        allowedMentions: {
            roles: isAuthorized ? [] : [ALERT_PING_ROLE_ID],
            users: [],
        },
    });
}
