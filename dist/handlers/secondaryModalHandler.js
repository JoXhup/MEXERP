import { MessageFlags, ChannelType } from "discord.js";
import { Ticket } from "../models/Ticket.js";
import { incrementStat } from "../models/StaffStats.js";
import { CATEGORIES } from "../constants/categories.js";
import { buildErrorContainer, buildSuccessContainer } from "../utils/components.js";
import { generateTranscript } from "../utils/transcript.js";
import { sendLog } from "../utils/logger.js";
import { getDuration } from "./buttonHandler.js";
// ─── HANDLER DE MODALES SECUNDARIOS ───────────────────────────────────────────
export async function handleSecondaryModals(interaction, client) {
    const parts = interaction.customId.split(":");
    if (parts[0] !== "ticket")
        return;
    if (parts[1] === "renamemodal") {
        const channelId = parts[2];
        await handleRenameModal(interaction, client, channelId);
    }
    else if (parts[1] === "closemodal") {
        const channelId = parts[2];
        await handleCloseModal(interaction, client, channelId);
    }
}
async function handleCloseModal(interaction, client, channelId) {
    const motivo = interaction.fields.getTextInputValue("motivo").trim();
    const ticket = await Ticket.findOne({ channelId });
    if (!ticket) {
        await interaction.reply({
            components: [buildErrorContainer("Ticket no encontrado.", client)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
    }
    if (ticket.status === "closed") {
        await interaction.reply({
            components: [buildErrorContainer("Este ticket ya esta cerrado.", client)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Generar transcripcion automatica
    try {
        if (interaction.channel?.type === ChannelType.GuildText) {
            const filepath = await generateTranscript(ticket, interaction.channel, client);
            ticket.transcriptPath = filepath;
        }
    }
    catch (err) {
        console.error("[CLOSE] Error generando transcripcion:", err);
    }
    // Actualizar DB
    ticket.status = "closed";
    ticket.closedAt = new Date();
    ticket.closedBy = interaction.user.id;
    ticket.closedByTag = interaction.user.tag;
    ticket.closeReason = motivo;
    await ticket.save();
    await incrementStat(interaction.guild.id, interaction.user.id, interaction.user.tag, "totalClosed");
    await interaction.editReply({
        components: [buildSuccessContainer("Ticket cerrado", "El canal se eliminara en 5 segundos.", client)],
        flags: MessageFlags.IsComponentsV2,
    });
    // Enviar LOG de cierre en Embed Rojo con inline fields (columnas al lado)
    const cat = CATEGORIES[ticket.category];
    const catLabel = cat?.label ?? ticket.category;
    await sendLog(client, "Ticket Cerrado", `Ticket **${ticket.ticketId.toUpperCase()}** cerrado por <@${interaction.user.id}>`, [
        { name: "Ticket / ID", value: ticket.ticketId.toUpperCase() },
        { name: "Creado por", value: `<@${ticket.ownerId}>` },
        { name: "Categoria", value: catLabel },
        { name: "Reclamado por", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Sin reclamar" },
        { name: "Cerrado por", value: `<@${interaction.user.id}>` },
        { name: "Motivo Cierre", value: motivo || "No especificado" },
        { name: "Duracion", value: getDuration(ticket.openedAt) },
    ]);
    // Eliminar canal despues de 5 segundos
    setTimeout(async () => {
        try {
            await interaction.channel?.delete(`Ticket ${ticket.ticketId} cerrado: ${motivo}`);
        }
        catch {
            // Canal ya eliminado
        }
    }, 5000);
}
async function handleRenameModal(interaction, client, channelId) {
    const newName = interaction.fields.getTextInputValue("new_name").trim();
    if (!newName)
        return;
    const ticket = await Ticket.findOne({ channelId });
    if (!ticket) {
        await interaction.reply({
            components: [buildErrorContainer("Ticket no encontrado.", client)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
    }
    const oldName = ticket.renamedTitle ?? ticket.ticketId;
    ticket.renamedTitle = newName;
    await ticket.save();
    // Renombrar canal de Discord
    try {
        const channel = interaction.guild?.channels.cache.get(channelId);
        if (channel) {
            await channel.setName(newName.toLowerCase().replace(/\s+/g, "-").slice(0, 80), `Renombrado por ${interaction.user.tag}`);
        }
    }
    catch (err) {
        console.error("[RENAME] Error renombrando canal:", err);
    }
    await interaction.reply({
        components: [buildSuccessContainer("Ticket renombrado", `Nombre actualizado de **${oldName}** a **${newName}**.`, client)],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    await sendLog(client, "Ticket Renombrado", `Por ${interaction.user.tag}`, [
        { name: "Ticket", value: ticket.ticketId },
        { name: "Nombre anterior", value: oldName },
        { name: "Nombre nuevo", value: newName },
        { name: "Staff", value: `<@${interaction.user.id}>` },
    ]);
}
