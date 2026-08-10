import { SlashCommandBuilder, } from "discord.js";
import { handleTransferir } from "../handlers/economyHandler.js";
const data = new SlashCommandBuilder()
    .setName("transferir")
    .setDescription("Transfiere dinero en efectivo a otro ciudadano del servidor.")
    .addUserOption((opt) => opt
    .setName("usuario")
    .setDescription("Ciudadano a quien enviarás el dinero.")
    .setRequired(true))
    .addIntegerOption((opt) => opt
    .setName("cantidad")
    .setDescription("Monto a transferir (mayor a 0).")
    .setRequired(true)
    .setMinValue(1));
const command = {
    data,
    async execute(interaction) {
        await handleTransferir(interaction);
    },
};
export default command;
