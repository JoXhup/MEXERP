import { SlashCommandBuilder, MessageFlags, } from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
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
            // Obtener estadísticas del usuario
            const userStats = await StaffStats.findOne({
                guildId: interaction.guildId,
                userId: targetUser.id,
            });
            const processedCount = userStats?.totalClosed ?? 0;
            const container = buildStaffProfileContainer(targetMember, processedCount, client);
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
