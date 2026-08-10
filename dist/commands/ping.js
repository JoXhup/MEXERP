import { SlashCommandBuilder, EmbedBuilder, } from "discord.js";
function formatUptime(uptimeSeconds) {
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
}
const data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Muestra la latencia y estado actual del bot.");
const command = {
    data,
    adminOnly: false,
    async execute(interaction) {
        const start = Date.now();
        // Generar color aleatorio
        const randomColor = Math.floor(Math.random() * 0xffffff);
        const wsPing = Math.round(interaction.client.ws.ping);
        const uptime = formatUptime(process.uptime());
        const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        // Calcular latencia API con defer
        await interaction.deferReply(); // Respuesta visible para todos
        const apiLatency = Date.now() - start;
        const embed = new EmbedBuilder()
            .setColor(randomColor)
            .setTitle("Estado del BOT")
            .addFields({ name: "Latencia WebSocket", value: `${wsPing} ms`, inline: true }, { name: "Latencia API", value: `${apiLatency} ms`, inline: true }, { name: "Tiempo Activo", value: uptime, inline: true }, { name: "Uso de Memoria", value: `${ramUsage} MB`, inline: true })
            .setFooter({ text: "Sonora System · Estado" })
            .setTimestamp();
        await interaction.editReply({
            embeds: [embed],
        });
    },
};
export default command;
