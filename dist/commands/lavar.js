import { SlashCommandBuilder, } from "discord.js";
import { handleLavar } from "../handlers/economyHandler.js";
const data = new SlashCommandBuilder()
    .setName("lavar")
    .setDescription("Lava tu dinero negro (Black Money) para convertirlo en efectivo (comisión 20%).")
    .addIntegerOption((opt) => opt
    .setName("cantidad")
    .setDescription("Monto de dinero negro a blanquear.")
    .setRequired(true)
    .setMinValue(1));
const command = {
    data,
    async execute(interaction) {
        await handleLavar(interaction);
    },
};
export default command;
