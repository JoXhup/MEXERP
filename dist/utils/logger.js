import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { getFooterTimestamp } from "./components.js";
/**
 * Envia un log al canal de logs configurado.
 * SOLO envia a Discord cuando se cierra un ticket.
 */
export async function sendLog(client, action, description, fields) {
    // Siempre registrar en consola
    console.log(`[LOG] ${action} — ${description}`);
    // SOLO enviar log a Discord cuando se CIERRA un ticket
    if (action !== "Ticket Cerrado")
        return;
    if (!config.logChannelId)
        return;
    try {
        const channel = await client.channels.fetch(config.logChannelId);
        if (!channel || !channel.isTextBased())
            return;
        const botAvatar = client.user?.displayAvatarURL({ size: 256 }) ?? undefined;
        const embed = new EmbedBuilder()
            .setColor(0xef4444) // Rojo
            .setTitle("🔒 Ticket Cerrado")
            .setDescription(description)
            .setThumbnail(botAvatar ?? null)
            .addFields(fields.map(f => ({
            name: f.name,
            value: f.value,
            inline: true, // Columnas al lado de cada uno
        })))
            .setFooter({
            text: `MEXERP System · ${getFooterTimestamp()}`,
            iconURL: botAvatar,
        });
        await channel.send({
            embeds: [embed],
        });
    }
    catch (err) {
        console.error("[LOG] Error al enviar log:", err);
    }
}
