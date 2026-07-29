import { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits, } from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
const MANAGER_ROLE = "1531426497942781972";
const STAFF_PERM_ROLE = "1531825255889506506";
const ROLES_TO_ADD = [
    "1531855122634772630",
    "1531420532753305853",
    "1531835160222503123",
    "1531825255889506506",
];
const LOG_CHANNEL_ID = "1532138719845421330";
const command = {
    data: new SlashCommandBuilder()
        .setName("contratar")
        .setDescription("Comandos de contratacion de personal.")
        .addSubcommand(sub => sub
        .setName("staff")
        .setDescription("Contrata a un usuario como Trial Mod.")
        .addUserOption(opt => opt
        .setName("usuario")
        .setDescription("Usuario a contratar como staff")
        .setRequired(true)))
        .toJSON(),
    adminOnly: false,
    async execute(interaction) {
        const client = interaction.client;
        // Respuesta en flags: 64 (ephemeral)
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const executorMember = interaction.guild?.members.cache.get(interaction.user.id);
            const isManager = executorMember?.roles.cache.has(MANAGER_ROLE) ||
                executorMember?.permissions.has(PermissionFlagsBits.Administrator);
            if (!isManager) {
                const noPermEmbed = new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("Sin Permisos")
                    .setDescription("No tienes los permisos requeridos para usar este comando.");
                await interaction.editReply({ embeds: [noPermEmbed] });
                return;
            }
            const targetUser = interaction.options.getUser("usuario", true);
            let targetMember = interaction.guild?.members.cache.get(targetUser.id);
            if (!targetMember && interaction.guild) {
                try {
                    targetMember = await interaction.guild.members.fetch(targetUser.id);
                }
                catch {
                    /* ok */
                }
            }
            if (!targetMember) {
                const errorEmbed = new EmbedBuilder()
                    .setColor(0xef4444)
                    .setDescription("No se encontro al usuario en este servidor.");
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }
            // Verificar si ya esta contratado o tiene rol de staff
            const existingStats = await StaffStats.findOne({
                guildId: interaction.guildId,
                userId: targetUser.id,
            });
            const hasStaffRole = targetMember.roles.cache.has(STAFF_PERM_ROLE);
            const isAlreadyHired = Boolean(existingStats?.hiredAt) || hasStaffRole;
            if (isAlreadyHired) {
                const alreadyHiredEmbed = new EmbedBuilder()
                    .setColor(0xef4444)
                    .setDescription("Este usuario ya fue contratado o tiene permisos administrativos.");
                await interaction.editReply({ embeds: [alreadyHiredEmbed] });
                return;
            }
            // 1. Asignar roles
            let rolesOtorgados = 0;
            for (const roleId of ROLES_TO_ADD) {
                try {
                    await targetMember.roles.add(roleId, `Contratado como Trial Mod por ${interaction.user.tag}`);
                    rolesOtorgados++;
                }
                catch (err) {
                    console.error(`[CONTRATAR] Error asignando rol ${roleId}:`, err);
                }
            }
            // 2. Cambiar apodo a (T.M) Nombre
            const currentName = targetMember.nickname || targetUser.displayName || targetUser.username;
            const cleanName = currentName.replace(/^\(T\.M\)\s*/i, "").trim();
            const newNickname = `(T.M) ${cleanName}`;
            try {
                await targetMember.setNickname(newNickname, "Contratado como Trial Mod.");
            }
            catch (err) {
                console.error("[CONTRATAR] Error al cambiar apodo:", err);
            }
            // 3. Registrar fecha de contratacion en MongoDB
            const hiredAt = new Date();
            await StaffStats.findOneAndUpdate({ guildId: interaction.guildId, userId: targetUser.id }, {
                $set: {
                    userTag: targetUser.tag,
                    hiredAt,
                    hiredBy: interaction.user.id,
                },
            }, { upsert: true, new: true });
            // 4. Responder con Embed Normal Azul en flags: 64 (sin thumbnail ni footer)
            const successEmbed = new EmbedBuilder()
                .setColor(0x3b82f6) // Azul
                .setDescription(`El usuario <@${targetUser.id}> fue exitosamente contratado como **Trial Mod.**`);
            await interaction.editReply({
                embeds: [successEmbed],
            });
            // 5. Enviar LOG detallado al canal 1532138719845421330
            try {
                const logChannel = interaction.guild?.channels.cache.get(LOG_CHANNEL_ID)
                    ?? (await interaction.guild?.channels.fetch(LOG_CHANNEL_ID).catch(() => null));
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0x3b82f6)
                        .setTitle("📋 Registro de Contratación de Staff")
                        .setDescription(`Se ha contratado exitosamente a un nuevo miembro del equipo.`)
                        .addFields({ name: "Usuario Contratado", value: `<@${targetUser.id}> (@${targetUser.username})`, inline: true }, { name: "Contratado Por", value: `<@${interaction.user.id}> (@${interaction.user.username})`, inline: true }, { name: "Rango Asignado", value: "**Trial Mod.**", inline: true }, { name: "Fecha de Contratación", value: `<t:${Math.floor(hiredAt.getTime() / 1000)}:F>`, inline: false }, { name: "Roles Otorgados", value: `${ROLES_TO_ADD.map(r => `<@&${r}>`).join(", ")} (${rolesOtorgados}/4 asignados)`, inline: false })
                        .setFooter({ text: "MEXERP Staff Logging" })
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
            catch (logErr) {
                console.error("[CONTRATAR LOG] Error al enviar log:", logErr);
            }
        }
        catch (err) {
            console.error("[CONTRATAR] Error general:", err);
            const errEmbed = new EmbedBuilder()
                .setColor(0xef4444)
                .setDescription("Error al procesar la contratacion del staff.");
            await interaction.editReply({ embeds: [errEmbed] });
        }
    },
};
export default command;
