import { SlashCommandBuilder, MessageFlags, PermissionFlagsBits, } from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
import { buildStaffProfileContainer, buildErrorContainer } from "../utils/components.js";
const command = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Muestra las estadísticas del staff de tickets.")
        .addSubcommand(sub => sub
        .setName("revisar")
        .setDescription("Revisa el perfil y estadísticas de un miembro del staff")
        .addUserOption(opt => opt
        .setName("user")
        .setDescription("Usuario del staff a revisar (opcional)")
        .setRequired(false)))
        .toJSON(),
    adminOnly: false,
    async execute(interaction) {
        const client = interaction.client;
        // Responder públicamente (visible para todos, sin flags: 64)
        await interaction.deferReply();
        try {
            const targetUser = interaction.options.getUser("user") ?? interaction.user;
            let targetMember = interaction.guild?.members.cache.get(targetUser.id);
            if (!targetMember && interaction.guild) {
                try {
                    targetMember = await interaction.guild.members.fetch(targetUser.id);
                }
                catch {
                    // No se encontró el miembro en la guild
                }
            }
            if (!targetMember) {
                await interaction.editReply({
                    components: [buildErrorContainer("No se encontró al usuario en este servidor.", client)],
                    flags: MessageFlags.IsComponentsV2,
                });
                return;
            }
            const STAFF_PERM_ROLE = "1531825255889506506";
            // Validar si quien ejecuta tiene permisos (rol staff 1531825255889506506 o Admin)
            const executorMember = interaction.guild?.members.cache.get(interaction.user.id);
            const executorCanView = executorMember?.roles.cache.has(STAFF_PERM_ROLE) ||
                executorMember?.permissions.has(PermissionFlagsBits.Administrator);
            if (!executorCanView) {
                await interaction.editReply({
                    components: [buildErrorContainer("No tienes permisos para revisar el perfil administrativo.", client)],
                    flags: MessageFlags.IsComponentsV2,
                });
                return;
            }
            // Validar si el usuario buscado es staff (tiene rol o es Admin)
            const targetIsStaff = targetMember.roles.cache.has(STAFF_PERM_ROLE) ||
                targetMember.permissions.has(PermissionFlagsBits.Administrator);
            if (!targetIsStaff) {
                await interaction.editReply({
                    components: [buildErrorContainer("El usuario buscado no es staff.", client)],
                    flags: MessageFlags.IsComponentsV2,
                });
                return;
            }
            // Obtener estadísticas del usuario
            const userStats = await StaffStats.findOne({
                guildId: interaction.guildId,
                userId: targetUser.id,
            });
            // Obtener vinculación de Roblox
            const verifiedUser = await VerifiedUser.findOne({
                discordId: targetUser.id,
            });
            const processedCount = userStats?.totalClosed ?? userStats?.totalClaimed ?? 0;
            const robloxName = verifiedUser?.robloxName ?? null;
            const hiredAt = userStats?.hiredAt ?? null;
            const totalShiftTimeMs = userStats?.totalShiftTimeMs ?? 0;
            const container = buildStaffProfileContainer(targetMember, processedCount, robloxName, hiredAt, client, totalShiftTimeMs);
            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }
        catch (err) {
            console.error("[STATS REVISAR] Error:", err);
            await interaction.editReply({
                components: [buildErrorContainer("Error al obtener las estadísticas del perfil.", client)],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    },
};
export default command;
