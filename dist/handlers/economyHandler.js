import { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, AttachmentBuilder, MessageFlags, PermissionFlagsBits, } from "discord.js";
import { Economy } from "../models/Economy.js";
import { Transaction } from "../models/Transaction.js";
import { renderEconomyCard, formatCurrency } from "../utils/economyCanvas.js";
import { getFooterTimestamp } from "../utils/components.js";
// Roles de Sueldo Diario para /cobrar (ID -> Monto)
export const SALARY_ROLES = [
    { id: "1529599914005237962", amount: 25000, name: "Sueldo $25,000 MXN" },
    { id: "1529599873337262142", amount: 15000, name: "Sueldo $15,000 MXN" },
    { id: "1529599829393801237", amount: 12000, name: "Sueldo $12,000 MXN" },
    { id: "1529599777686425752", amount: 7000, name: "Sueldo $7,000 MXN" },
    { id: "1529599716902572132", amount: 5000, name: "Sueldo $5,000 MXN" },
];
// Roles de Bono Especial cada 4 días (ID -> Monto)
export const BONUS_ROLES_4DAYS = [
    { id: "1529598709653049385", amount: 80000, name: "Bono $80,000 MXN" },
    { id: "1530686768586821842", amount: 60000, name: "Bono $60,000 MXN" },
    { id: "1529585650070851737", amount: 45000, name: "Bono $45,000 MXN" },
    { id: "1534943449307021383", amount: 30000, name: "Bono $30,000 MXN" },
];
// Rol Administrador de Economía (o Permiso Administrador)
export const ECO_ADMIN_ROLE_ID = "1535360623544639508";
// Cooldown de Sueldo Diario (24 Horas)
export const COBRAR_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Cooldown de Bono Especial (4 Días / 96 Horas)
export const BONUS_COOLDOWN_MS = 4 * 24 * 60 * 60 * 1000;
// Porcentaje de comisión por lavar dinero (20%)
export const LAUNDERING_FEE_PERCENT = 0.20;
/** Genera un ID único de transacción corto (ej: TX-7A9B2C) */
export function generateTxId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "TX-";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/** Obtiene o crea el registro de economía de un usuario */
export async function getOrCreateEconomy(discordId) {
    let doc = await Economy.findOne({ discordId });
    if (!doc) {
        doc = await Economy.create({ discordId, money: 0, bank: 0, blackMoney: 0 });
    }
    return doc;
}
/** Verifica si una interacción proviene de un administrador de economía */
export function isEcoAdmin(interaction) {
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return true;
    }
    const roles = interaction.member?.roles;
    if (roles && "cache" in roles) {
        return roles.cache.has(ECO_ADMIN_ROLE_ID);
    }
    return false;
}
// ─── 1. /ESTADO MONETARIO ───────────────────────────────────────────────────
export async function handleEstadoMonetario(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
    const eco = await getOrCreateEconomy(targetUser.id);
    if (eco.isBlocked) {
        const errContainer = new ContainerBuilder()
            .setAccentColor(0xe74c3c)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Cuenta Bloqueada"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`La cuenta económica de <@${targetUser.id}> se encuentra bloqueada por administración.\n**Motivo:** ${eco.blockReason || "Sin especificar"}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
        await interaction.editReply({
            components: [errContainer],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }
    // Obtener últimos movimientos
    const recentTx = await Transaction.find({ discordId: targetUser.id })
        .sort({ createdAt: -1 })
        .limit(5);
    // Renderizar infografía canvas con gráfica
    const total = eco.money + eco.bank;
    let attachment;
    try {
        const avatarUrl = targetUser.displayAvatarURL({ extension: "png", size: 256 });
        const buffer = await renderEconomyCard({
            username: targetUser.username,
            avatarUrl,
            money: eco.money,
            bank: eco.bank,
            total,
            blackMoney: eco.blackMoney,
            recentTx: recentTx.map((t) => ({
                type: t.type,
                amount: t.amount,
                createdAt: t.createdAt,
            })),
        });
        attachment = new AttachmentBuilder(buffer, { name: "estado.png" });
    }
    catch (canvasErr) {
        console.error("[ECONOMY] Error generando gráfica canvas:", canvasErr);
        await interaction.editReply({ content: "Error al generar la imagen de estado monetario." });
        return;
    }
    // Formatear lista de movimientos recientes para el container
    const recentTxLines = recentTx.length > 0
        ? recentTx.map((t) => {
            const isIncome = ["cobro", "transferencia_recibida", "admin_add"].includes(t.type);
            const sign = isIncome ? "+" : "-";
            const icon = isIncome ? "🟢" : "🔴";
            return `${icon} \`${sign} $${t.amount.toLocaleString("es-MX")}\` · ${t.description} (\`${t.txId}\`)`;
        }).join("\n")
        : "› *No hay movimientos recientes registrados.*";
    const container = new ContainerBuilder()
        .setAccentColor(0x2ecc71) // Verde
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 💰 ESTADO MONETARIO\nEstado financiero oficial de <@${targetUser.id}>`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ extension: "png", size: 256 }))))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**SALDOS DEL USUARIO**`,
        `› 💵 **Money (Efectivo):** \`${formatCurrency(eco.money)}\``,
        `› 🏦 **Bank Money (Banco):** \`${formatCurrency(eco.bank)}\``,
        `› 💰 **Money Total:** \`${formatCurrency(total)}\``,
        `› 🕶️ **Black Money:** \`${formatCurrency(eco.blackMoney)}\``,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**📊 MOVIMIENTOS RECIENTES**\n${recentTxLines}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL("attachment://estado.png")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`));
    await interaction.editReply({
        components: [container],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 2. /ESTADO ILEGAL ─────────────────────────────────────────────────────
export async function handleEstadoIlegal(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
    const eco = await getOrCreateEconomy(targetUser.id);
    const blackTx = await Transaction.find({
        discordId: targetUser.id,
        type: { $in: ["lavado", "admin_blackmoney"] },
    })
        .sort({ createdAt: -1 })
        .limit(5);
    const txLines = blackTx.length > 0
        ? blackTx.map((t) => `› \`$${t.amount.toLocaleString("es-MX")}\` · ${t.description} (\`${t.txId}\`)`).join("\n")
        : "› *No hay movimientos ilegales registrados.*";
    const container = new ContainerBuilder()
        .setAccentColor(0x9b59b6) // Morado ilegal
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🕶️ ESTADO ILEGAL DE CUENTA\nRegistro de fondos no regulados para <@${targetUser.id}>`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ extension: "png", size: 256 }))))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**SALDO DE DINERO NEGRO**`,
        `› 🕶️ **Black Money Actual:** \`${formatCurrency(eco.blackMoney)}\``,
        `› *Nota:* Este dinero no puede depositarse directamente. Usa el comando **/lavar** para blanquearlo.`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**📜 ÚLTIMAS OPERACIONES ILEGALES**\n${txLines}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 3. /DEPOSITAR ─────────────────────────────────────────────────────────
export async function handleDepositar(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const inputVal = interaction.options.getString("cantidad", true).trim().toLowerCase();
    const eco = await getOrCreateEconomy(interaction.user.id);
    if (eco.isBlocked) {
        await sendEcoError(interaction, "Cuenta Bloqueada", `Tu cuenta está bloqueada.\n**Motivo:** ${eco.blockReason || "Sin especificar"}`);
        return;
    }
    let amountToDeposit = 0;
    if (inputVal === "todo" || inputVal === "all") {
        amountToDeposit = eco.money;
    }
    else {
        amountToDeposit = parseInt(inputVal, 10);
    }
    if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
        await sendEcoError(interaction, "Monto Inválido", "Debes ingresar una cantidad numérica positiva mayor a 0 o la palabra `todo`.");
        return;
    }
    // Operación atómica en MongoDB
    const updated = await Economy.findOneAndUpdate({ discordId: interaction.user.id, money: { $gte: amountToDeposit }, isBlocked: false }, { $inc: { money: -amountToDeposit, bank: amountToDeposit } }, { new: true });
    if (!updated) {
        await sendEcoError(interaction, "Fondos Insuficientes", `No tienes suficiente dinero en efectivo (Money) para depositar \`${formatCurrency(amountToDeposit)}\`.\n**Saldo actual en efectivo:** \`${formatCurrency(eco.money)}\``);
        return;
    }
    // Registrar transacción
    const txId = generateTxId();
    await Transaction.create({
        txId,
        discordId: interaction.user.id,
        type: "deposito",
        amount: amountToDeposit,
        balanceMoneyAfter: updated.money,
        balanceBankAfter: updated.bank,
        balanceBlackAfter: updated.blackMoney,
        description: `Depósito bancario de $${amountToDeposit.toLocaleString("es-MX")}`,
    });
    const container = new ContainerBuilder()
        .setAccentColor(0x3498db) // Azul banco
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 🏦 Depósito Bancario Exitoso"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `Has depositado exitosamente **$${amountToDeposit.toLocaleString("es-MX")} MXN** en tu cuenta bancaria.`,
        "",
        `› 💵 **Efectivo restante:** \`${formatCurrency(updated.money)}\``,
        `› 🏦 **Nuevo saldo en Banco:** \`${formatCurrency(updated.bank)}\``,
        `› 🆔 **ID de Transacción:** \`${txId}\``,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Banco de Sonora"));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 4. /RETIRAR ───────────────────────────────────────────────────────────
export async function handleRetirar(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const inputVal = interaction.options.getString("cantidad", true).trim().toLowerCase();
    const eco = await getOrCreateEconomy(interaction.user.id);
    if (eco.isBlocked) {
        await sendEcoError(interaction, "Cuenta Bloqueada", `Tu cuenta está bloqueada.\n**Motivo:** ${eco.blockReason || "Sin especificar"}`);
        return;
    }
    let amountToWithdraw = 0;
    if (inputVal === "todo" || inputVal === "all") {
        amountToWithdraw = eco.bank;
    }
    else {
        amountToWithdraw = parseInt(inputVal, 10);
    }
    if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
        await sendEcoError(interaction, "Monto Inválido", "Debes ingresar una cantidad numérica positiva mayor a 0 o la palabra `todo`.");
        return;
    }
    // Operación atómica en MongoDB
    const updated = await Economy.findOneAndUpdate({ discordId: interaction.user.id, bank: { $gte: amountToWithdraw }, isBlocked: false }, { $inc: { bank: -amountToWithdraw, money: amountToWithdraw } }, { new: true });
    if (!updated) {
        await sendEcoError(interaction, "Fondos Insuficientes", `No tienes suficiente dinero en el banco (Bank Money) para retirar \`${formatCurrency(amountToWithdraw)}\`.\n**Saldo actual en Banco:** \`${formatCurrency(eco.bank)}\``);
        return;
    }
    // Registrar transacción
    const txId = generateTxId();
    await Transaction.create({
        txId,
        discordId: interaction.user.id,
        type: "retiro",
        amount: amountToWithdraw,
        balanceMoneyAfter: updated.money,
        balanceBankAfter: updated.bank,
        balanceBlackAfter: updated.blackMoney,
        description: `Retiro bancario de $${amountToWithdraw.toLocaleString("es-MX")}`,
    });
    const container = new ContainerBuilder()
        .setAccentColor(0x3498db)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 💵 Retiro Bancario Exitoso"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `Has retirado exitosamente **$${amountToWithdraw.toLocaleString("es-MX")} MXN** de tu banco a efectivo.`,
        "",
        `› 💵 **Nuevo Saldo Efectivo:** \`${formatCurrency(updated.money)}\``,
        `› 🏦 **Banco restante:** \`${formatCurrency(updated.bank)}\``,
        `› 🆔 **ID de Transacción:** \`${txId}\``,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Banco de Sonora"));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 5. /TRANSFERIR ────────────────────────────────────────────────────────
export async function handleTransferir(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario", true);
    const amount = interaction.options.getInteger("cantidad", true);
    // Validaciones estrictas
    if (targetUser.id === interaction.user.id) {
        await sendEcoError(interaction, "Transferencia Denegada", "No puedes realizar transferencias de dinero a ti mismo.");
        return;
    }
    if (targetUser.bot) {
        await sendEcoError(interaction, "Transferencia Denegada", "No puedes realizar transferencias de dinero a bots.");
        return;
    }
    if (amount <= 0) {
        await sendEcoError(interaction, "Monto Inválido", "La cantidad a transferir debe ser mayor a $0 MXN.");
        return;
    }
    const senderEco = await getOrCreateEconomy(interaction.user.id);
    const targetEco = await getOrCreateEconomy(targetUser.id);
    if (senderEco.isBlocked) {
        await sendEcoError(interaction, "Cuenta Bloqueada", "Tu cuenta económica está bloqueada y no puedes emitir transferencias.");
        return;
    }
    if (targetEco.isBlocked) {
        await sendEcoError(interaction, "Destinatario Bloqueado", "La cuenta económica del destinatario se encuentra bloqueada por administración.");
        return;
    }
    // Descontar atómicamente al emisor
    const updatedSender = await Economy.findOneAndUpdate({ discordId: interaction.user.id, money: { $gte: amount }, isBlocked: false }, { $inc: { money: -amount } }, { new: true });
    if (!updatedSender) {
        await sendEcoError(interaction, "Fondos Insuficientes", `No tienes suficiente dinero en efectivo (Money) para transferir \`${formatCurrency(amount)}\`.\n**Efectivo disponible:** \`${formatCurrency(senderEco.money)}\``);
        return;
    }
    // Acreditar atómicamente al receptor
    const updatedTarget = await Economy.findOneAndUpdate({ discordId: targetUser.id }, { $inc: { money: amount } }, { new: true, upsert: true });
    // Registrar las 2 transacciones con un mismo ID
    const txId = generateTxId();
    await Transaction.create({
        txId,
        discordId: interaction.user.id,
        targetId: targetUser.id,
        type: "transferencia_enviada",
        amount,
        balanceMoneyAfter: updatedSender.money,
        balanceBankAfter: updatedSender.bank,
        balanceBlackAfter: updatedSender.blackMoney,
        description: `Transferencia enviada a @${targetUser.username}`,
    });
    await Transaction.create({
        txId,
        discordId: targetUser.id,
        targetId: interaction.user.id,
        type: "transferencia_recibida",
        amount,
        balanceMoneyAfter: updatedTarget.money,
        balanceBankAfter: updatedTarget.bank,
        balanceBlackAfter: updatedTarget.blackMoney,
        description: `Transferencia recibida de @${interaction.user.username}`,
    });
    const container = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 💸 Transferencia Exitosa"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `Has transferido exitosamente **$${amount.toLocaleString("es-MX")} MXN** a <@${targetUser.id}>.`,
        "",
        `› 👤 **Destinatario:** <@${targetUser.id}> (${targetUser.username})`,
        `› 💵 **Tu saldo en efectivo:** \`${formatCurrency(updatedSender.money)}\``,
        `› 🆔 **ID de Transacción:** \`${txId}\``,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Sistema de Pagos"));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
    // Notificar al receptor por DM si es posible
    try {
        const dmContainer = new ContainerBuilder()
            .setAccentColor(0x2ecc71)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 💸 Transferencia Recibida"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `Has recibido **$${amount.toLocaleString("es-MX")} MXN** de <@${interaction.user.id}> en Sonora RP.`,
            "",
            `› 💵 **Tu nuevo saldo en efectivo:** \`${formatCurrency(updatedTarget.money)}\``,
            `› 🆔 **Transacción:** \`${txId}\``,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
        await targetUser.send({
            components: [dmContainer],
            // @ts-ignore
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);
    }
    catch {
        /* ok si DM cerrado */
    }
}
// ─── 6. /COBRAR ────────────────────────────────────────────────────────────
export async function handleCobrar(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = interaction.guild?.members.cache.get(interaction.user.id)
        ?? (await interaction.guild?.members.fetch(interaction.user.id));
    // 1. Buscar el rol de sueldo diario de MAYOR valor
    let highestSalaryRole = null;
    if (member) {
        for (const roleObj of SALARY_ROLES) {
            if (member.roles.cache.has(roleObj.id)) {
                highestSalaryRole = roleObj;
                break;
            }
        }
    }
    // 2. Buscar el rol de bono de 4 días de MAYOR valor
    let highestBonusRole = null;
    if (member) {
        for (const roleObj of BONUS_ROLES_4DAYS) {
            if (member.roles.cache.has(roleObj.id)) {
                highestBonusRole = roleObj;
                break;
            }
        }
    }
    // Si no tiene NINGÚN rol de sueldo ni bono -> MENSAJE EXACTO
    if (!highestSalaryRole && !highestBonusRole) {
        const noJobContainer = new ContainerBuilder()
            .setAccentColor(0xe74c3c)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Sin Empleo Registrado"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            "**Sección legal**",
            "Para generar dinero legalmente, dirígete al apartado de [Empleos](https://discord.com/channels/1528571127352262866/1528875517430857829), donde podrás encontrar diferentes trabajos y actividades para generar ingresos.",
            "",
            "**Sección ilegal**",
            "Para generar ingresos de manera ilegal, puedes realizar robos, crímenes y contrabandos, o trabajar para alguna mafia, cártel o banda criminal en [Actividades Ilegales](https://discord.com/channels/1528571127352262866/1528875559461978283).",
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
        await interaction.editReply({
            components: [noJobContainer],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }
    const eco = await getOrCreateEconomy(interaction.user.id);
    if (eco.isBlocked) {
        await sendEcoError(interaction, "Cuenta Bloqueada", `Tu cuenta está bloqueada.\n**Motivo:** ${eco.blockReason || "Sin especificar"}`);
        return;
    }
    const now = Date.now();
    // Evaluar disponibilidad de Sueldo Diario (24h)
    const isDailyReady = highestSalaryRole ? (!eco.lastCobrar || (now - eco.lastCobrar.getTime() >= COBRAR_COOLDOWN_MS)) : false;
    // Evaluar disponibilidad de Bono de 4 Días (96h)
    const isBonusReady = highestBonusRole ? (!eco.lastCobrarBonus || (now - eco.lastCobrarBonus.getTime() >= BONUS_COOLDOWN_MS)) : false;
    // Si NINGUNO de los cobros a los que tiene derecho está disponible -> Cooldown Activo
    if (!isDailyReady && !isBonusReady) {
        const cdLines = ["Ambos cobros se encuentran en periodo de espera actualmente.", ""];
        if (highestSalaryRole && eco.lastCobrar) {
            const nextDailyUnix = Math.floor((eco.lastCobrar.getTime() + COBRAR_COOLDOWN_MS) / 1000);
            cdLines.push(`› **Próximo sueldo diario ($${highestSalaryRole.amount.toLocaleString()}):** <t:${nextDailyUnix}:R> (<t:${nextDailyUnix}:f>)`);
        }
        if (highestBonusRole && eco.lastCobrarBonus) {
            const nextBonusUnix = Math.floor((eco.lastCobrarBonus.getTime() + BONUS_COOLDOWN_MS) / 1000);
            cdLines.push(`› **Próximo bono de 4 días ($${highestBonusRole.amount.toLocaleString()}):** <t:${nextBonusUnix}:R> (<t:${nextBonusUnix}:f>)`);
        }
        const cdContainer = new ContainerBuilder()
            .setAccentColor(0xe67e22)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Cooldown Activo"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(cdLines.join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
        await interaction.editReply({
            components: [cdContainer],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }
    // Calcular montos a pagar en esta ejecución
    const salaryPayout = (isDailyReady && highestSalaryRole) ? highestSalaryRole.amount : 0;
    const bonusPayout = (isBonusReady && highestBonusRole) ? highestBonusRole.amount : 0;
    const totalPayout = salaryPayout + bonusPayout;
    // Construir consulta de actualización en MongoDB
    const updateFields = {
        $inc: { money: totalPayout },
    };
    if (isDailyReady) {
        updateFields.$set = updateFields.$set || {};
        updateFields.$set.lastCobrar = new Date();
    }
    if (isBonusReady) {
        updateFields.$set = updateFields.$set || {};
        updateFields.$set.lastCobrarBonus = new Date();
    }
    const updated = await Economy.findOneAndUpdate({ discordId: interaction.user.id, isBlocked: false }, updateFields, { new: true });
    if (!updated) {
        await sendEcoError(interaction, "Error de Cobro", "Ocurrió un error al procesar el saldo.");
        return;
    }
    // Registrar transacción
    const txId = generateTxId();
    const descParts = [];
    if (salaryPayout > 0 && highestSalaryRole)
        descParts.push(`Sueldo ${highestSalaryRole.name}`);
    if (bonusPayout > 0 && highestBonusRole)
        descParts.push(`${highestBonusRole.name} (4 Días)`);
    await Transaction.create({
        txId,
        discordId: interaction.user.id,
        type: "cobro",
        amount: totalPayout,
        balanceMoneyAfter: updated.money,
        balanceBankAfter: updated.bank,
        balanceBlackAfter: updated.blackMoney,
        description: `Cobro: ${descParts.join(" + ")}`,
    });
    // Timestamps para próximos cobros
    const nextDailyUnix = Math.floor((Date.now() + COBRAR_COOLDOWN_MS) / 1000);
    const nextBonusUnix = Math.floor((Date.now() + BONUS_COOLDOWN_MS) / 1000);
    const payoutLines = ["Has cobrado tu salario exitosamente.", ""];
    if (salaryPayout > 0 && highestSalaryRole) {
        payoutLines.push(`› 👔 **Sueldo diario (24h):** \`${formatCurrency(salaryPayout)}\` (<@&${highestSalaryRole.id}>)`);
    }
    else if (highestSalaryRole && eco.lastCobrar) {
        const nextSal = Math.floor((eco.lastCobrar.getTime() + COBRAR_COOLDOWN_MS) / 1000);
        payoutLines.push(`› 👔 **Sueldo diario (24h):** Cooldown (Disponible <t:${nextSal}:R>)`);
    }
    if (bonusPayout > 0 && highestBonusRole) {
        payoutLines.push(`› 🎁 **Bono Adicional (4 días):** \`${formatCurrency(bonusPayout)}\` (<@&${highestBonusRole.id}>) 🎉`);
    }
    else if (highestBonusRole && eco.lastCobrarBonus) {
        const nextBon = Math.floor((eco.lastCobrarBonus.getTime() + BONUS_COOLDOWN_MS) / 1000);
        payoutLines.push(`› 🎁 **Bono Adicional (4 días):** Cooldown (Disponible <t:${nextBon}:R>)`);
    }
    payoutLines.push("", `› 💰 **Monto Total Cobrado Ahora:** \`${formatCurrency(totalPayout)}\``, `› 💵 **Nuevo Saldo en Efectivo:** \`${formatCurrency(updated.money)}\``, `› 🆔 **ID Transacción:** \`${txId}\``);
    const container = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 💵 Sueldo Cobrado Exitosamente"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(payoutLines.join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Nómina de Trabajo"));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 7. /LAVAR ─────────────────────────────────────────────────────────────
export async function handleLavar(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const amount = interaction.options.getInteger("cantidad", true);
    if (amount <= 0) {
        await sendEcoError(interaction, "Monto Inválido", "La cantidad a lavar debe ser mayor a $0 MXN.");
        return;
    }
    const eco = await getOrCreateEconomy(interaction.user.id);
    if (eco.isBlocked) {
        await sendEcoError(interaction, "Cuenta Bloqueada", "Tu cuenta económica está bloqueada.");
        return;
    }
    const fee = Math.round(amount * LAUNDERING_FEE_PERCENT); // 20%
    const netAmount = amount - fee; // 80%
    // Operación atómica
    const updated = await Economy.findOneAndUpdate({ discordId: interaction.user.id, blackMoney: { $gte: amount }, isBlocked: false }, { $inc: { blackMoney: -amount, money: netAmount } }, { new: true });
    if (!updated) {
        await sendEcoError(interaction, "Dinero Negro Insuficiente", `No tienes suficiente Black Money para lavar \`${formatCurrency(amount)}\`.\n**Saldo actual en Dinero Negro:** \`${formatCurrency(eco.blackMoney)}\``);
        return;
    }
    const txId = generateTxId();
    await Transaction.create({
        txId,
        discordId: interaction.user.id,
        type: "lavado",
        amount: netAmount,
        fee,
        balanceMoneyAfter: updated.money,
        balanceBankAfter: updated.bank,
        balanceBlackAfter: updated.blackMoney,
        description: `Lavado de dinero negro ($${amount.toLocaleString("es-MX")} -> $${netAmount.toLocaleString("es-MX")})`,
    });
    const container = new ContainerBuilder()
        .setAccentColor(0x9b59b6)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 🧼 Lavado de Dinero Completado"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `Has blanqueado exitosamente **$${amount.toLocaleString("es-MX")} MXN** de Black Money.`,
        "",
        `› 🕶️ **Monto sucio procesado:** \`${formatCurrency(amount)}\``,
        `› 💸 **Comisión de lavado (20%):** \`-$${fee.toLocaleString("es-MX")} MXN\``,
        `› 💵 **Efectivo limpio recibido:** \`+$${netAmount.toLocaleString("es-MX")} MXN\``,
        `› 🕶️ **Black Money restante:** \`${formatCurrency(updated.blackMoney)}\``,
        `› 🆔 **ID Transacción:** \`${txId}\``,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Operación Clandestina"));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 8. /HISTORIAL ─────────────────────────────────────────────────────────
export async function handleHistorial(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
    const history = await Transaction.find({ discordId: targetUser.id })
        .sort({ createdAt: -1 })
        .limit(10);
    if (history.length === 0) {
        const emptyContainer = new ContainerBuilder()
            .setAccentColor(0x34495e)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Historial Vacío — <@${targetUser.id}>`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("No se encontraron transacciones en el historial de este usuario."))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
        await interaction.editReply({
            components: [emptyContainer],
            flags: MessageFlags.IsComponentsV2,
        });
        return;
    }
    const lines = history.map((t) => {
        const unix = Math.floor(t.createdAt.getTime() / 1000);
        const isIncome = ["cobro", "transferencia_recibida", "admin_add"].includes(t.type);
        const sign = isIncome ? "+" : "-";
        const colorSign = isIncome ? "🟢" : "🔴";
        return `${colorSign} <t:${unix}:d> <t:${unix}:t> · **${t.description}**\n   └ \`${sign} $${t.amount.toLocaleString("es-MX")}\` | Balance post: Efec \`$${t.balanceMoneyAfter.toLocaleString()}\` | Banco \`$${t.balanceBankAfter.toLocaleString()}\` (\`${t.txId}\`)`;
    }).join("\n\n");
    const container = new ContainerBuilder()
        .setAccentColor(0x34495e)
        .addSectionComponents(new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📜 HISTORIAL FINANCIERO\nÚltimas 10 transacciones de <@${targetUser.id}>`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ extension: "png", size: 256 }))))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · Registros Contables`));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 9. /ECONOMIA GENERAL Y RANKING ────────────────────────────────────────
export async function handleEconomiaGeneral(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const stats = await Economy.aggregate([
        {
            $group: {
                _id: null,
                totalMoney: { $sum: "$money" },
                totalBank: { $sum: "$bank" },
                totalBlack: { $sum: "$blackMoney" },
                count: { $sum: 1 },
            },
        },
    ]);
    const txCount = await Transaction.countDocuments({});
    const s = stats[0] || { totalMoney: 0, totalBank: 0, totalBlack: 0, count: 0 };
    const grandTotal = s.totalMoney + s.totalBank + s.totalBlack;
    const container = new ContainerBuilder()
        .setAccentColor(0xf1c40f) // Dorado
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# 📊 ESTADÍSTICAS GLOBALES DE ECONOMÍA\nSonora RP"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**MÉTRICAS DEL SERVIDOR**`,
        `› 💵 **Dinero en Efectivo Circulando:** \`${formatCurrency(s.totalMoney)}\``,
        `› 🏦 **Dinero en Bancos:** \`${formatCurrency(s.totalBank)}\``,
        `› 🕶️ **Black Money Existente:** \`${formatCurrency(s.totalBlack)}\``,
        `› 💰 **PIB Total del Servidor:** \`${formatCurrency(grandTotal)}\``,
        "",
        `› 👥 **Cuentas Económicas Activas:** \`${s.count.toLocaleString("es-MX")}\``,
        `› 💸 **Transacciones Registradas:** \`${txCount.toLocaleString("es-MX")}\``,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · Control de Inflación · ${getFooterTimestamp()}`));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
export async function handleRanking(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const topUsers = await Economy.aggregate([
        {
            $project: {
                discordId: 1,
                money: 1,
                bank: 1,
                totalNet: { $add: ["$money", "$bank"] },
            },
        },
        { $sort: { totalNet: -1 } },
        { $limit: 10 },
    ]);
    if (topUsers.length === 0) {
        await interaction.editReply({ content: "No hay registros de economía aún." });
        return;
    }
    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    const lines = topUsers.map((u, i) => {
        const medal = medals[i] || `\`#${i + 1}\``;
        return `${medal} <@${u.discordId}> — **$${u.totalNet.toLocaleString("es-MX")} MXN** (Efec: \`$${u.money.toLocaleString()}\` | Banco: \`$${u.bank.toLocaleString()}\`)`;
    }).join("\n");
    const container = new ContainerBuilder()
        .setAccentColor(0xf1c40f)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# 🏆 RANKING DE MILLONARIOS — SONORA RP"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora System · Top 10 Fortuna`));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
// ─── 10. /ECO-ADMIN ────────────────────────────────────────────────────────
export async function handleEcoAdmin(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!isEcoAdmin(interaction)) {
        await sendEcoError(interaction, "Permisos Insuficientes", "No tienes permisos de administración económica para ejecutar este comando.");
        return;
    }
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser("usuario", true);
    const eco = await getOrCreateEconomy(targetUser.id);
    if (subcommand === "agregar" || subcommand === "retirar" || subcommand === "establecer") {
        const field = interaction.options.getString("tipo", true); // "dinero" | "banco" | "ilegal"
        const amount = interaction.options.getInteger("cantidad", true);
        let incMoney = 0;
        let incBank = 0;
        let incBlack = 0;
        let setMoney;
        let setBank;
        let setBlack;
        if (subcommand === "agregar") {
            if (field === "dinero")
                incMoney = amount;
            if (field === "banco")
                incBank = amount;
            if (field === "ilegal")
                incBlack = amount;
        }
        else if (subcommand === "retirar") {
            if (field === "dinero")
                incMoney = -amount;
            if (field === "banco")
                incBank = -amount;
            if (field === "ilegal")
                incBlack = -amount;
        }
        else if (subcommand === "establecer") {
            if (field === "dinero")
                setMoney = amount;
            if (field === "banco")
                setBank = amount;
            if (field === "ilegal")
                setBlack = amount;
        }
        const updateQuery = {};
        if (incMoney || incBank || incBlack) {
            updateQuery.$inc = {};
            if (incMoney)
                updateQuery.$inc.money = incMoney;
            if (incBank)
                updateQuery.$inc.bank = incBank;
            if (incBlack)
                updateQuery.$inc.blackMoney = incBlack;
        }
        if (setMoney !== undefined || setBank !== undefined || setBlack !== undefined) {
            updateQuery.$set = {};
            if (setMoney !== undefined)
                updateQuery.$set.money = setMoney;
            if (setBank !== undefined)
                updateQuery.$set.bank = setBank;
            if (setBlack !== undefined)
                updateQuery.$set.blackMoney = setBlack;
        }
        const updated = await Economy.findOneAndUpdate({ discordId: targetUser.id }, updateQuery, { new: true, upsert: true });
        const txId = generateTxId();
        await Transaction.create({
            txId,
            discordId: targetUser.id,
            targetId: interaction.user.id,
            type: `admin_${subcommand}`,
            amount,
            balanceMoneyAfter: updated.money,
            balanceBankAfter: updated.bank,
            balanceBlackAfter: updated.blackMoney,
            description: `Admin @${interaction.user.username} ejecutó /eco-admin ${subcommand} (${field}: ${amount})`,
        });
        const container = new ContainerBuilder()
            .setAccentColor(0x2ecc71)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🛠️ Economía Modificada — @${targetUser.username}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `Acción **${subcommand.toUpperCase()}** ejecutada por <@${interaction.user.id}>.`,
            "",
            `› 👤 **Usuario:** <@${targetUser.id}>`,
            `› 💵 **Nuevo Efectivo:** \`${formatCurrency(updated.money)}\``,
            `› 🏦 **Nuevo Banco:** \`${formatCurrency(updated.bank)}\``,
            `› 🕶️ **Nuevo Black Money:** \`${formatCurrency(updated.blackMoney)}\``,
            `› 🆔 **TX:** \`${txId}\``,
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System · Registro Administrativo"));
        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    }
    else if (subcommand === "bloquear") {
        const reason = interaction.options.getString("motivo") || "Violación de normas económicas";
        eco.isBlocked = true;
        eco.blockReason = reason;
        await eco.save();
        await interaction.editReply({
            content: `🔒 La cuenta económica de <@${targetUser.id}> ha sido **bloqueada**.\n**Motivo:** ${reason}`,
        });
    }
    else if (subcommand === "desbloquear") {
        eco.isBlocked = false;
        eco.blockReason = "";
        await eco.save();
        await interaction.editReply({
            content: `🔓 La cuenta económica de <@${targetUser.id}> ha sido **desbloqueada**.`,
        });
    }
    else if (subcommand === "reset") {
        eco.money = 0;
        eco.bank = 0;
        eco.blackMoney = 0;
        await eco.save();
        await interaction.editReply({
            content: `♻️ Se ha **reiniciado** a $0 MXN toda la economía del usuario <@${targetUser.id}>.`,
        });
    }
}
// ─── HELPER DE ERRORES ─────────────────────────────────────────────────────
async function sendEcoError(interaction, title, desc) {
    const container = new ContainerBuilder()
        .setAccentColor(0xe74c3c)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Sonora System"));
    await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
}
