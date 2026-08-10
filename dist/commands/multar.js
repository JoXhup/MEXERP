import { SlashCommandBuilder, } from "discord.js";
import { handleMultarCommand } from "../handlers/fineHandler.js";
const data = new SlashCommandBuilder()
    .setName("multar")
    .setDescription("Abre el formulario Modal V2 para expedir una multa oficial.");
const command = {
    data,
    async execute(interaction, client) {
        if (client) {
            await handleMultarCommand(interaction, client);
        }
    },
};
export default command;
