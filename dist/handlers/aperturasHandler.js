import { EmbedBuilder, MessageFlags, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, } from "discord.js";
const APERTURAS_NOTIF_CHANNEL_ID = "1529455296832082124";
const STAFF_SHIFT_ROLE = "1531855122634772630";
const ADMIN_ROLE_ID = "1531426497942781972";
export async function handleAperturaButton(interaction, client) {
    const parts = interaction.customId.split(":");
    const action = parts[1]; // abrir, mantenimiento, cierre
    const guild = interaction.guild;
    const member = guild?.members.cache.get(interaction.user.id);
    const canUse = member?.roles.cache.has(STAFF_SHIFT_ROLE) ||
        member?.roles.cache.has(ADMIN_ROLE_ID) ||
        member?.permissions.has(PermissionFlagsBits.Administrator);
    if (!canUse) {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("❌ Sin Permisos")
                    .setDescription("No cuentas con el rol o permisos requeridos para gestionar las aperturas del servidor.")
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const notifChannel = guild?.channels.cache.get(APERTURAS_NOTIF_CHANNEL_ID)
        ?? (await guild?.channels.fetch(APERTURAS_NOTIF_CHANNEL_ID).catch(() => null));
    if (!notifChannel || !notifChannel.isTextBased()) {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("❌ Canal no Encontrado")
                    .setDescription(`No se pudo encontrar el canal de notificaciones (\`${APERTURAS_NOTIF_CHANNEL_ID}\`).`)
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    let statusTitle = "";
    let container;
    if (action === "abrir") {
        statusTitle = "Abierto";
        container = new ContainerBuilder()
            .setAccentColor(0x10b981) // Verde
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("@everyone\n# SERVIDOR ABIERTO"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `> El servidor se encuentra actualmente abierto. Puedes entrar buscándonos en la lista como **Sonora RP | ERLC** o por el código **SNRPA**`,
            ``,
            `<u>Si has votado, tienes 15 minutos para unirte o serás sancionado.</u>`,
            ``,
            `**Disfruta de los mejores roles en nuestro servidor, y llévate una experiencia INCREIBLE**`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP | ERLC · Notificación de Apertura`));
    }
    else if (action === "mantenimiento") {
        statusTitle = "Mantenimiento";
        container = new ContainerBuilder()
            .setAccentColor(0xf59e0b) // Amarillo/Naranja
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("@everyone\n# SERVIDOR EN MANTENIMIENTO"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `> El servidor se encuentra actualmente en mantenimiento para aplicar mejoras y optimizaciones.`,
            ``,
            `<u>Por favor mantente atento a los anuncios. Notificaremos cuando el servidor vuelva a estar disponible.</u>`,
            ``,
            `**Agradecemos tu paciencia y comprensión para brindarte una mejor experiencia de rol.**`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP | ERLC · Estado del Servidor`));
    }
    else {
        statusTitle = "Cerrado";
        container = new ContainerBuilder()
            .setAccentColor(0xef4444) // Rojo
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("@everyone\n# SERVIDOR CERRADO"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `> El servidor ha finalizado su sesión de rol por el día de hoy y se encuentra oficialmente cerrado.`,
            ``,
            `<u>Agradecemos a todos los ciudadanos y servicios de emergencia por participar.</u>`,
            ``,
            `**¡Los esperamos en la próxima sesión de rol en Sonora RP!**`,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP | ERLC · Cierre de Servidor`));
    }
    // Enviar mensaje en el canal de notificaciones 1529455296832082124 (Components V2 container incluye @everyone dentro del TextDisplay)
    await notifChannel.send({
        // @ts-ignore — Components V2
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
    // Confirmar eférmeramente al staff
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x10b981)
                .setTitle("✅ Notificación Enviada")
                .setDescription(`Has actualizado el estado del servidor a **${statusTitle}** y se ha publicado la notificación en <#${APERTURAS_NOTIF_CHANNEL_ID}>.`)
        ],
        flags: MessageFlags.Ephemeral,
    });
}
