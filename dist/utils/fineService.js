import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, MessageFlags, } from "discord.js";
import { Fine } from "../models/Fine.js";
import { getFooterTimestamp } from "./components.js";
// ID del canal de logs de multas
export const FINE_LOG_CHANNEL_ID = "1529875924550418614";
// Rol autorizado para expedir multas
export const FINE_OFFICER_ROLE_ID = "1532588631821385768";
// Intervalo de recargos (3 días)
export const PENALTY_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;
// Porcentaje de recargo (5%)
export const PENALTY_RATE = 0.05;
/** Formatea montos en pesos mexicanos */
export function formatMxn(val) {
    return `$${val.toLocaleString("es-MX")} MXN`;
}
/** Formatea fechas en DD/MM/YYYY */
export function formatDateEs(date) {
    return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}
/** Devuelve la insignia y texto según estado de la multa */
export function getStatusBadge(status) {
    switch (status) {
        case "PENDING":
            return { label: "🔴 Pendiente", emoji: "🔴", color: 0xe74c3c };
        case "OVERDUE":
            return { label: "⛔ Vencida", emoji: "⛔", color: 0x992d22 };
        case "PAID":
            return { label: "🟢 Pagada", emoji: "🟢", color: 0x2ecc71 };
        case "CANCELLED":
            return { label: "⚪ Cancelada", emoji: "⚪", color: 0x95a5a6 };
        default:
            return { label: "🔴 Pendiente", emoji: "🔴", color: 0xe74c3c };
    }
}
/** Construye el Container V2 profesional de una multa para el canal de registro */
export function buildFineLogContainer(fine, avatarUrl) {
    const badge = getStatusBadge(fine.status);
    const createdUnix = Math.floor(fine.createdAt.getTime() / 1000);
    const dueUnix = Math.floor(fine.dueAt.getTime() / 1000);
    const container = new ContainerBuilder()
        .setAccentColor(badge.color)
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚖️ REGISTRO OFICIAL DE MULTA\n**ID de Multa:** \`${fine.multaId}\``))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**DATOS DEL INFRACTOR Y OFICIAL**`,
        `› 👤 **Ciudadano:** <@${fine.userId}>`,
        `› 👮 **Oficial emisor:** <@${fine.issuerId}>`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**DESGLOSE FINANCIERO**`,
        `› 💰 **Importe original:** \`${formatMxn(fine.originalAmount)}\``,
        `› 💸 **Importe actual:** \`${formatMxn(fine.currentAmount)}\``,
        `› 📊 **Estado:** ${badge.label}`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**MOTIVO DE LA INFRACCIÓN**`,
        `> ${fine.reason}`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    const timeLines = [
        `**FECHAS Y VENCIMIENTO**`,
        `› 📅 **Emisión:** <t:${createdUnix}:F> (<t:${createdUnix}:R>)`,
        `› ⏰ **Vencimiento:** <t:${dueUnix}:F> (<t:${dueUnix}:R>)`,
    ];
    if (fine.status === "PAID" && fine.paidAt) {
        const paidUnix = Math.floor(fine.paidAt.getTime() / 1000);
        timeLines.push(`› 🟢 **Fecha de pago:** <t:${paidUnix}:F> (<t:${paidUnix}:R>)`);
        if (fine.paymentTransactionId) {
            timeLines.push(`› 🆔 **ID de Transacción:** \`${fine.paymentTransactionId}\``);
        }
    }
    if (fine.status === "CANCELLED") {
        if (fine.cancelledBy) {
            timeLines.push(`› ⚪ **Cancelada por:** <@${fine.cancelledBy}>`);
        }
        if (fine.cancelReason) {
            timeLines.push(`› 📝 **Motivo cancelación:** ${fine.cancelReason}`);
        }
    }
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(timeLines.join("\n")));
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP — Sistema Judicial · ${getFooterTimestamp()}`));
    return container;
}
/**
 * Procesa las multas para actualizar vencimientos (7 días) y recargos (5% cada 3 días).
 */
export async function processFinePenaltiesAndExpirations(client) {
    try {
        const now = new Date();
        // 1. Vencimientos (PENDING -> OVERDUE cuando now >= dueAt)
        const overdueFines = await Fine.find({
            status: "PENDING",
            dueAt: { $lte: now },
        });
        for (const fine of overdueFines) {
            fine.status = "OVERDUE";
            await fine.save();
            console.log(`[FINES] Multa ${fine.multaId} marcada como OVERDUE (Vencida).`);
            if (fine.logMessageId) {
                await updateLogEmbed(client, fine);
            }
        }
        // 2. Recargos automáticos (5% cada 3 días)
        const activeFines = await Fine.find({
            status: { $in: ["PENDING", "OVERDUE"] },
        });
        for (const fine of activeFines) {
            const elapsedMs = now.getTime() - fine.lastPenaltyAt.getTime();
            const intervals = Math.floor(elapsedMs / PENALTY_INTERVAL_MS);
            if (intervals > 0) {
                let newAmount = fine.currentAmount;
                for (let i = 0; i < intervals; i++) {
                    newAmount = Math.round(newAmount * (1 + PENALTY_RATE));
                }
                const newLastPenaltyAt = new Date(fine.lastPenaltyAt.getTime() + intervals * PENALTY_INTERVAL_MS);
                fine.currentAmount = newAmount;
                fine.lastPenaltyAt = newLastPenaltyAt;
                await fine.save();
                console.log(`[FINES] Recargo aplicado a multa ${fine.multaId}: +${intervals * 5}% -> Nuevo monto: $${newAmount}`);
                if (fine.logMessageId) {
                    await updateLogEmbed(client, fine);
                }
            }
        }
    }
    catch (err) {
        console.error("[FINES] Error procesando recargos y vencimientos:", err);
    }
}
/** Actualizar mensaje de log en el canal oficial */
export async function updateLogEmbed(client, fine) {
    if (!fine.logMessageId)
        return;
    try {
        const channel = await client.channels.fetch(FINE_LOG_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            const msg = await channel.messages.fetch(fine.logMessageId).catch(() => null);
            if (msg) {
                const user = await client.users.fetch(fine.userId).catch(() => null);
                const avatarUrl = user?.displayAvatarURL({ extension: "png", size: 256 });
                const container = buildFineLogContainer(fine, avatarUrl);
                await msg.edit({
                    components: [container],
                    // @ts-ignore
                    flags: MessageFlags.IsComponentsV2,
                }).catch(() => null);
            }
        }
    }
    catch (err) {
        console.error(`[FINES] Error actualizando mensaje de log para ${fine.multaId}:`, err);
    }
}
/** Inicializa el servicio en segundo plano de multas */
export function startFineService(client) {
    processFinePenaltiesAndExpirations(client);
    setInterval(() => {
        processFinePenaltiesAndExpirations(client);
    }, 15 * 60 * 1000);
}
