import { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SeparatorSpacingSize, } from "discord.js";
import { config } from "../config.js";
import { getFooterTimestamp } from "../utils/components.js";
import { isAdmin } from "../utils/permissions.js";
export const data = new SlashCommandBuilder()
    .setName("verificar")
    .setDescription("Envia el panel de verificacion al canal correspondiente")
    .setDefaultMemberPermissions(0); // Solo admins
export async function execute(interaction, client) {
    // Solo rol admin
    const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;
    if (!isAdmin(member)) {
        await interaction.reply({
            content: "No tienes permisos para usar este comando.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const channel = await client.channels.fetch(config.verificationChannelId);
        if (!channel?.isTextBased()) {
            await interaction.editReply({ content: "Canal de verificacion no encontrado." });
            return;
        }
        const guildIcon = interaction.guild?.iconURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
        // ─── PANEL CONTAINER (acento verde) ─────────────────────────────────────
        const panel = new ContainerBuilder()
            .setAccentColor(0x57f287) // Verde Discord
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("# Pasos de Verificacion <a:verify:1530639821683556563>"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `Bienvenid@ al apartado **Whitelist** para realizar tu proceso, realiza las siguientes instrucciones para realizarlo correctamente.`,
            ``,
            `- Pulsa en el boton **"Iniciar"** para abrir el proceso.`,
            `- Coloca tu usuario de roblox y responde la pregunta mencionada.`,
        ].join("\n")))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIcon)))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("<a:pins:1530640122633257041> *Listo, disfruta de Sonora RP, tu mejor opcion.*"))
            .addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder()
            .setCustomId("verification:start")
            .setLabel("Iniciar")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅")))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`));
        await channel.send({
            components: [panel],
            flags: MessageFlags.IsComponentsV2,
        });
        await interaction.editReply({ content: "Panel de verificacion enviado correctamente." });
    }
    catch (err) {
        console.error("[VERIFICAR] Error:", err);
        await interaction.editReply({ content: "Error al enviar el panel de verificacion." });
    }
}
