import { SlashCommandBuilder, } from "discord.js";
import { handleDepositar } from "../handlers/economyHandler.js";
const data = new SlashCommandBuilder()
    .setName("depositar")
    .setDescription("Deposita dinero en efectivo (Money) a tu cuenta bancaria (Bank Money).")
    .addStringOption((opt) => opt
    .setName("cantidad")
    .setDescription("Cantidad a depositar (ej: 5000) o la palabra 'todo'.")
    .setRequired(true));
const command = {
    data,
    async execute(interaction) {
        await handleDepositar(interaction);
    },
};
export default command;
