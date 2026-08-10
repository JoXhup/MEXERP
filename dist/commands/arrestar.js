import { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, } from "discord.js";
import { buildArrestarModal, ARREST_OFFICER_ROLE_ID } from "../handlers/arrestHandler.js";
const command = {
    data: new SlashCommandBuilder()
        .setName("arrestar")
        .setDescription("Abre el modal para registrar el arresto de un ciudadano (Exclusivo Staff Autorizado).")
        .toJSON(),
    async execute(interaction, _client) {
        // Verificar si el usuario tiene el rol exclusivo 1532588594659594241
        const roles = interaction.member?.roles;
        const hasRole = roles && "cache" in roles && roles.cache.has(ARREST_OFFICER_ROLE_ID);
        if (!hasRole) {
            const errContainer = new ContainerBuilder()
                .setAccentColor(0xe74c3c)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Permisos Insuficientes"))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`No tienes el rol autorizado (<@&${ARREST_OFFICER_ROLE_ID}>) para ejecutar este comando.`))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
            await interaction.reply({
                components: [errContainer],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
            return;
        }
        // Abrir Modal V2
        await interaction.showModal(buildArrestarModal());
    },
};
export default command;
