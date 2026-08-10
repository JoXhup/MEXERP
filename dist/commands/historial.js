import { SlashCommandBuilder, } from "discord.js";
import { handleHistorial } from "../handlers/economyHandler.js";
const data = new SlashCommandBuilder()
    .setName("historial")
    .setDescription("Muestra el historial de transacciones financieras recientes.")
    .addUserOption((opt) => opt
    .setName("usuario")
    .setDescription("Usuario de quien consultar el historial (Opcional).")
    .setRequired(false));
const command = {
    data,
    async execute(interaction) {
        await handleHistorial(interaction);
    },
};
export default command;
