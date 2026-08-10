import { EmbedBuilder, MessageFlags } from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
const ROLES_TO_REVOKE = [
    "1532069032583237873",
    "1531819188341968906",
    "1531830006509076480",
    "1531825255889506506",
    "1531834575796310096",
    "1531835160222503123",
    "1531420532753305853",
    "1531855122634772630",
    "1531426134732837018",
    "1531426429848522872",
    "1531426497942781972",
    "1530650993472180425",
];
const LOG_CHANNEL_ID = "1532138719845421330";
export async function handleDespedirButton(interaction, client) {
    // customId: despedir:confirm:<targetUserId>:<executorUserId>
    // or despedir:cancel:<targetUserId>:<executorUserId>
    const parts = interaction.customId.split(":");
    const actionType = parts[1];
    const targetUserId = parts[2];
    const executorUserId = parts[3];
    if (!targetUserId || !executorUserId)
        return;
    // Solo la persona que ejecuto el comando puede confirmar/cancelar
    if (interaction.user.id !== executorUserId) {
        await interaction.reply({
            content: "No tienes permiso para interactuar con esta confirmacion.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferUpdate();
    if (actionType === "cancel") {
        const cancelEmbed = new EmbedBuilder()
            .setColor(0x6b7280) // Gris
            .setDescription(`Acción cancelada. El usuario <@${targetUserId}> no fue despedido.`);
        await interaction.editReply({
            embeds: [cancelEmbed],
            components: [],
        });
        return;
    }
    if (actionType === "confirm") {
        const guild = interaction.guild;
        let targetMember = guild?.members.cache.get(targetUserId);
        if (!targetMember && guild) {
            try {
                targetMember = await guild.members.fetch(targetUserId);
            }
            catch {
                /* ok */
            }
        }
        let rolesRevocados = 0;
        const removedRoleIds = [];
        if (targetMember) {
            // Revocar roles de la lista que el usuario tenga
            for (const roleId of ROLES_TO_REVOKE) {
                if (targetMember.roles.cache.has(roleId)) {
                    try {
                        await targetMember.roles.remove(roleId, `Despedido del staff por ${interaction.user.tag}`);
                        rolesRevocados++;
                        removedRoleIds.push(roleId);
                    }
                    catch (err) {
                        console.error(`[DESPEDIR] Error removiendo rol ${roleId}:`, err);
                    }
                }
            }
            // Remover apodo de staff (ej: (T.M))
            try {
                const currentNick = targetMember.nickname || "";
                if (currentNick.startsWith("(T.M)")) {
                    const cleanNick = currentNick.replace(/^\(T\.M\)\s*/i, "").trim();
                    await targetMember.setNickname(cleanNick || null, "Despedido del staff.");
                }
            }
            catch (err) {
                console.error("[DESPEDIR] Error removiendo apodo:", err);
            }
        }
        // Eliminar completamente el perfil administrativo de MongoDB
        try {
            await StaffStats.findOneAndDelete({
                guildId: guild?.id ?? "",
                userId: targetUserId,
            });
        }
        catch (err) {
            console.error("[DESPEDIR] Error eliminando perfil en DB:", err);
        }
        const successEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle("🚨 Staff Despedido")
            .setDescription(`El usuario <@${targetUserId}> ha sido despedido exitosamente y se han removido sus permisos y estadísticas administrativas.`);
        await interaction.editReply({
            embeds: [successEmbed],
            components: [],
        });
        // Enviar Log al canal 1532138719845421330
        try {
            const logChannel = guild?.channels.cache.get(LOG_CHANNEL_ID)
                ?? (await guild?.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
            if (logChannel && logChannel.isTextBased()) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("🚨 Registro de Despido de Staff")
                    .setDescription("Se ha procesado el despido de un miembro del equipo.")
                    .addFields({ name: "Usuario Despedido", value: `<@${targetUserId}>`, inline: true }, { name: "Despedido Por", value: `<@${interaction.user.id}> (@${interaction.user.username})`, inline: true }, { name: "Fecha de Despido", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }, { name: "Roles Revocados", value: removedRoleIds.length > 0 ? removedRoleIds.map(r => `<@&${r}>`).join(", ") : "Ningún rol revocado", inline: false })
                    .setFooter({ text: "Sonora RP Staff Logging" })
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
        catch (logErr) {
            console.error("[DESPEDIR LOG] Error enviando log:", logErr);
        }
    }
}
