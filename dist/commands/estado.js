import { SlashCommandBuilder, } from "discord.js";
import { handleEstadoMonetario, handleEstadoIlegal, } from "../handlers/economyHandler.js";
const data = new SlashCommandBuilder()
    .setName("estado")
    .setDescription("Muestra tus estadísticas monetarias o ilegales en Sonora RP.")
    .addSubcommand((sub) => sub
    .setName("monetario")
    .setDescription("Muestra tus estadísticas monetarias, saldos y gráfica de actividad.")
    .addUserOption((opt) => opt
    .setName("usuario")
    .setDescription("Usuario de quien deseas consultar el estado monetario (Opcional).")
    .setRequired(false)))
    .addSubcommand((sub) => sub
    .setName("ilegal")
    .setDescription("Muestra tu saldo de Dinero Negro y operaciones clandestinas.")
    .addUserOption((opt) => opt
    .setName("usuario")
    .setDescription("Usuario de quien deseas consultar el estado ilegal (Opcional).")
    .setRequired(false)));
const command = {
    data,
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        if (sub === "monetario") {
            await handleEstadoMonetario(interaction);
        }
        else if (sub === "ilegal") {
            await handleEstadoIlegal(interaction);
        }
    },
};
export default command;
