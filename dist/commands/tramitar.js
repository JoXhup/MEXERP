import { SlashCommandBuilder, } from "discord.js";
import { handleTramitarCommand, handleIneRevisarCommand, } from "../handlers/ineHandler.js";
const command = {
    data: new SlashCommandBuilder()
        .setName("tramitar")
        .setDescription("Comandos para realizar trámites oficiales.")
        .addSubcommand((sub) => sub
        .setName("ine")
        .setDescription("Tramita tu credencial para votar (INE) de Sonora RP."))
        .addSubcommand((sub) => sub
        .setName("revisar")
        .setDescription("Revisa tu credencial para votar (INE) tramitada."))
        .toJSON(),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand === "revisar") {
            await handleIneRevisarCommand(interaction);
        }
        else {
            await handleTramitarCommand(interaction);
        }
    },
};
export default command;
