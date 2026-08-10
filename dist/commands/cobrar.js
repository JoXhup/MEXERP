import { SlashCommandBuilder, } from "discord.js";
import { handleCobrar } from "../handlers/economyHandler.js";
const data = new SlashCommandBuilder()
    .setName("cobrar")
    .setDescription("Cobra tu sueldo o salario según tu rol o cargo en el servidor.");
const command = {
    data,
    async execute(interaction) {
        await handleCobrar(interaction);
    },
};
export default command;
