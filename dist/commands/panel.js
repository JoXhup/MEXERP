import { SlashCommandBuilder, MessageFlags, } from "discord.js";
import { PanelMessage } from "../models/PanelMessage.js";
import { buildPanelContainer, buildErrorContainer } from "../utils/components.js";
import { config } from "../config.js";
import { sendLog } from "../utils/logger.js";
import { isAdmin } from "../utils/permissions.js";
const command = {
    data: new SlashCommandBuilder()
        .setName("panel")
        .setDescription("Envia o actualiza el panel de tickets en el canal configurado.")
        .toJSON(),
    adminOnly: true,
    async execute(interaction) {
        const client = interaction.client;
        // Verificar permisos de admin
        const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;
        if (!isAdmin(member)) {
            await interaction.reply({
                components: [buildErrorContainer("Solo los administradores pueden enviar el panel.", client)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return;
        }
        // Verificar canal correcto
        if (interaction.channelId !== config.panelChannelId) {
            await interaction.reply({
                components: [buildErrorContainer(`El panel solo puede enviarse al canal <#${config.panelChannelId}>.`, client)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const panelChannel = await client.channels.fetch(config.panelChannelId);
            if (!panelChannel?.isTextBased()) {
                await interaction.editReply({
                    components: [buildErrorContainer("Canal del panel no encontrado.", client)],
                    flags: MessageFlags.IsComponentsV2,
                });
                return;
            }
            const guildPanelChannel = panelChannel;
            const guildIcon = interaction.guild?.iconURL({ size: 256 }) ?? undefined;
            const panelContainer = buildPanelContainer(client, guildIcon);
            // Verificar si ya existe un panel previo
            const existing = await PanelMessage.findOne({ guildId: interaction.guildId });
            if (existing) {
                // Eliminar mensaje previo para enviar el nuevo contenedor limpio
                try {
                    const prevMsg = await guildPanelChannel.messages.fetch(existing.messageId);
                    await prevMsg.delete();
                }
                catch { /* ok si ya fue borrado */ }
                await PanelMessage.deleteOne({ guildId: interaction.guildId });
            }
            // Enviar nuevo panel con Components V2
            const sent = await guildPanelChannel.send({
                components: [panelContainer],
                flags: MessageFlags.IsComponentsV2,
            });
            await PanelMessage.create({
                guildId: interaction.guildId,
                channelId: panelChannel.id,
                messageId: sent.id,
            });
            await interaction.editReply({
                components: [buildErrorContainer("Panel enviado correctamente.", client)],
                flags: MessageFlags.IsComponentsV2,
            });
            await sendLog(client, "Panel Enviado", `Nuevo panel por ${interaction.user.tag}`, [
                { name: "Staff", value: `<@${interaction.user.id}>` },
                { name: "Canal", value: `<#${config.panelChannelId}>` },
                { name: "Accion", value: "Nuevo panel" },
            ]);
        }
        catch (err) {
            console.error("[PANEL] Error:", err);
            await interaction.editReply({
                components: [buildErrorContainer("Error al enviar el panel.", client)],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    },
};
export default command;
