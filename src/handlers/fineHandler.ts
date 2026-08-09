import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  UserSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type Client,
  type TextChannel,
  type GuildMemberRoleManager,
  PermissionFlagsBits,
} from "discord.js";
import { Fine, type IFine } from "../models/Fine.js";
import { getNextFineId } from "../models/Counter.js";
import { Economy } from "../models/Economy.js";
import { Transaction } from "../models/Transaction.js";
import {
  FINE_LOG_CHANNEL_ID,
  FINE_OFFICER_ROLE_ID,
  formatMxn,
  formatDateEs,
  getStatusBadge,
  buildFineLogContainer,
  updateLogEmbed,
} from "../utils/fineService.js";
import { generateTxId } from "./economyHandler.js";
import { getFooterTimestamp } from "../utils/components.js";

/** Verifica si el usuario tiene permiso para expedir o cancelar multas */
export function isFineOfficer(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  const roles = interaction.member?.roles;
  if (roles && "cache" in roles) {
    return (roles as GuildMemberRoleManager).cache.has(FINE_OFFICER_ROLE_ID);
  }
  return false;
}

/** Construye el Modal V2 para expedir multas con Select Menu */
export function buildMultarModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("multar:modal")
    .setTitle("Expedición de Multa — Sonora RP");

  const l1 = new LabelBuilder()
    .setLabel("Ciudadano")
    .setDescription("Selecciona el ciudadano a quien se le emitirá la multa")
    .setUserSelectMenuComponent(
      new UserSelectMenuBuilder()
        .setCustomId("ciudadano")
        .setPlaceholder("Selecciona el ciudadano...")
        .setMinValues(1)
        .setMaxValues(1)
    );

  const l2 = new LabelBuilder()
    .setLabel("Cantidad ($ MXN)")
    .setDescription("Monto monetario de la multa (Ej: 5000)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("cantidad")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: 5000")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10)
    );

  const l3 = new LabelBuilder()
    .setLabel("Motivo de la Infracción")
    .setDescription("Describe la razón o cargo de la multa")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Coloca el motivo de la infracción...")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(500)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── 1. /MULTAR (Abre Modal V2) ─────────────────────────────────────────────

export async function handleMultarCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  // 1. Verificar Permisos
  if (!isFineOfficer(interaction)) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const errContainer = new ContainerBuilder()
      .setAccentColor(0xe74c3c)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Permisos Insuficientes")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "Solo los oficiales autorizados pueden emitir multas en el servidor."
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System")
      );

    await interaction.editReply({
      components: [errContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Desplegar Modal V2
  const modal = buildMultarModal();
  await interaction.showModal(modal);
}

// ─── 1B. PROCESAR MODAL V2 DE MULTAR ────────────────────────────────────────

export async function handleMultarModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // 1. Extraer campos del Modal V2
  const selectedUsers = interaction.fields.getSelectedUsers("ciudadano");
  const targetUser = selectedUsers?.first();
  const cantidadInput = interaction.fields.getTextInputValue("cantidad").trim();
  const reason = interaction.fields.getTextInputValue("motivo").trim();

  if (!targetUser) {
    await sendErrorContainer(interaction, "Ciudadano No Seleccionado", "Debes seleccionar un ciudadano para expedir la multa.");
    return;
  }

  if (targetUser.bot) {
    await sendErrorContainer(interaction, "Usuario Inválido", "No puedes multar a un bot de Discord.");
    return;
  }

  const amount = parseInt(cantidadInput, 10);
  if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
    await sendErrorContainer(
      interaction,
      "Cantidad Inválida",
      `La cantidad ingresada (\`${cantidadInput}\`) no es válida. Debe ser un número entero positivo mayor a $0 MXN.`
    );
    return;
  }

  // 2. Generar ID permanente (MLT-000001) y fechas
  const multaId = await getNextFineId();
  const createdAt = new Date();
  const dueAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días

  // 3. Crear documento en MongoDB
  const fine = new Fine({
    multaId,
    userId: targetUser.id,
    issuerId: interaction.user.id,
    originalAmount: amount,
    currentAmount: amount,
    reason,
    status: "PENDING",
    createdAt,
    dueAt,
    lastPenaltyAt: createdAt,
  });

  await fine.save();

  // 4. Enviar Container V2 al canal oficial 1529875924550418614
  try {
    const logChannel = await client.channels.fetch(FINE_LOG_CHANNEL_ID).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const citizenAvatar = targetUser.displayAvatarURL({ extension: "png", size: 256 });
      const logContainer = buildFineLogContainer(fine, citizenAvatar);

      const logMsg = await (logChannel as TextChannel).send({
        components: [logContainer],
        // @ts-ignore
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => null);

      if (logMsg) {
        fine.logMessageId = logMsg.id;
        await fine.save();
      }
    }
  } catch (logErr) {
    console.error("[FINES] Error enviando registro Container V2 al canal:", logErr);
  }

  // 5. Enviar DM al ciudadano en Container V2 con botón de pago verde
  try {
    const officerAvatar = interaction.user.displayAvatarURL({ extension: "png", size: 256 });
    const createdUnix = Math.floor(createdAt.getTime() / 1000);
    const dueUnix = Math.floor(dueAt.getTime() / 1000);

    const dmContainer = new ContainerBuilder()
      .setAccentColor(0xe74c3c)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# ⚖️ HAS RECIBIDO UNA MULTA\nSe ha registrado una sanción oficial a tu nombre.`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(officerAvatar)
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**DETALLES DE LA MULTA**`,
            `› **ID de Multa:** \`${fine.multaId}\``,
            `› **Oficial al mando:** <@${interaction.user.id}>`,
            `› **Importe a pagar:** \`${formatMxn(fine.currentAmount)}\``,
            `› **Estado:** 🔴 Pendiente`,
            `› **Emisión:** <t:${createdUnix}:F> (<t:${createdUnix}:R>)`,
            `› **Fecha límite:** <t:${dueUnix}:F> (<t:${dueUnix}:R>)`,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**MOTIVO DE LA SANCIÓN**`,
            `> ${fine.reason}`,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System · Puedes realizar el pago con el botón inferior")
      );

    const payButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`fine:pay:${fine.multaId}`)
        .setLabel("💳 PAGAR MULTA")
        .setStyle(ButtonStyle.Success)
    );

    const dmMsg = await targetUser.send({
      components: [dmContainer, payButton],
      // @ts-ignore
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => null);

    if (dmMsg) {
      fine.dmMessageId = dmMsg.id;
      await fine.save();
    }
  } catch (dmErr) {
    console.error("[FINES] Error enviando DM al usuario multado:", dmErr);
  }

  // 6. Respuesta efímera de confirmación al oficial
  const confirmContainer = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## ⚖️ Multa Expedida Exitosamente")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `La multa **\`${multaId}\`** ha sido registrada y notificada correctamente.`,
          "",
          `› 👤 **Ciudadano:** <@${targetUser.id}> (${targetUser.username})`,
          `› 💰 **Monto:** \`${formatMxn(amount)}\``,
          `› 📋 **Motivo:** ${reason}`,
          `› ⏰ **Vencimiento:** <t:${Math.floor(dueAt.getTime() / 1000)}:R>`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System")
    );

  await interaction.editReply({
    components: [confirmContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── 2. BOTÓN: PAGAR MULTA ──────────────────────────────────────────────────

export async function handlePayFineButton(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const parts = interaction.customId.split(":");
  const multaId = parts[2];

  if (!multaId) {
    await interaction.editReply({ content: "❌ ID de multa inválido." });
    return;
  }

  // 1. Buscar multa en MongoDB
  const fine = await Fine.findOne({ multaId });
  if (!fine) {
    await sendErrorContainer(interaction, "Multa No Encontrada", `El ID \`${multaId}\` no corresponde a ninguna multa registrada.`);
    return;
  }

  // 2. Comprobar que pertenece al usuario
  if (fine.userId !== interaction.user.id) {
    await sendErrorContainer(interaction, "Acceso Denegado", "🔒 **Esta multa pertenece a otro usuario.** No realizarás ninguna operación sobre ella.");
    return;
  }

  // 3. Comprobar que no esté pagada o cancelada
  if (fine.status === "PAID") {
    await sendErrorContainer(interaction, "Multa Ya Pagada", `🟢 La multa \`${fine.multaId}\` ya ha sido PAGADA previamente.`);
    return;
  }

  if (fine.status === "CANCELLED") {
    await sendErrorContainer(interaction, "Multa Cancelada", `⚪ La multa \`${fine.multaId}\` ha sido cancelada por administración.`);
    return;
  }

  // 4. Comprobar saldo disponible en efectivo (Money)
  const eco = await Economy.findOne({ discordId: interaction.user.id });
  const userMoney = eco ? eco.money : 0;

  if (userMoney < fine.currentAmount) {
    const missing = fine.currentAmount - userMoney;
    const errContainer = new ContainerBuilder()
      .setAccentColor(0xe74c3c)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## ❌ Fondos Insuficientes")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `No tienes suficiente dinero en efectivo (Money) para pagar esta multa.`,
            "",
            `› 💰 **Disponible en efectivo:** \`${formatMxn(userMoney)}\``,
            `› ⚖️ **Deuda a pagar:** \`${formatMxn(fine.currentAmount)}\``,
            `› 💸 **Faltante:** \`${formatMxn(missing)}\``,
            "",
            `*La multa continúa pendiente. Puedes laborar o retirar dinero del banco para saldar la deuda.*`,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System")
      );

    await interaction.editReply({
      components: [errContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // 5. OPERACIÓN ATÓMICA DE PAGO (Protección contra doble clic / Race Conditions)
  const updatedFine = await Fine.findOneAndUpdate(
    { multaId: fine.multaId, status: { $in: ["PENDING", "OVERDUE"] }, userId: interaction.user.id },
    { status: "PAID", paidAt: new Date() },
    { new: true }
  );

  if (!updatedFine) {
    await interaction.editReply({ content: `🟢 La multa \`${fine.multaId}\` ya fue pagada o procesada por otro evento.` });
    return;
  }

  // Descontar atómicamente dinero en efectivo
  const updatedEco = await Economy.findOneAndUpdate(
    { discordId: interaction.user.id, money: { $gte: fine.currentAmount } },
    { $inc: { money: -fine.currentAmount } },
    { new: true }
  );

  if (!updatedEco) {
    // Revertir estado si falló el cobro por dinero insuficiente simultáneo
    updatedFine.status = fine.status;
    updatedFine.paidAt = null;
    await updatedFine.save();

    await sendErrorContainer(interaction, "Error de Cobro", "Error procesando el saldo en efectivo.");
    return;
  }

  // 6. Registrar transacción
  const txId = generateTxId();
  await Transaction.create({
    txId,
    discordId: interaction.user.id,
    type: "admin_remove",
    amount: fine.currentAmount,
    balanceMoneyAfter: updatedEco.money,
    balanceBankAfter: updatedEco.bank,
    balanceBlackAfter: updatedEco.blackMoney,
    description: `Pago de multa ${fine.multaId} (${fine.reason})`,
  });

  updatedFine.paymentTransactionId = txId;
  await updatedFine.save();

  // 7. Enviar Container V2 de Pago Exitoso
  const paidUnix = Math.floor((updatedFine.paidAt || new Date()).getTime() / 1000);
  const paidContainer = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## 🟢 MULTA PAGADA EXITOSAMENTE")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `El pago de la multa **\`${updatedFine.multaId}\`** ha sido procesado correctamente.`,
          "",
          `› 🆔 **Multa ID:** \`${updatedFine.multaId}\``,
          `› 💰 **Cantidad pagada:** \`${formatMxn(updatedFine.currentAmount)}\``,
          `› 🟢 **Estado:** ✅ PAGADA`,
          `› 📅 **Fecha de pago:** <t:${paidUnix}:F> (<t:${paidUnix}:R>)`,
          `› 🆔 **ID Transacción:** \`${txId}\``,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System · Transacción Finalizada")
    );

  await interaction.editReply({
    components: [paidContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  // 8. Actualizar el registro en el canal oficial 1529875924550418614
  await updateLogEmbed(client, updatedFine);
}

// ─── 3. /MULTAS HISTORIAL ──────────────────────────────────────────────────

export async function handleHistorialMultasCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser("usuario") ?? interaction.user;

  // 1. Permiso: Si intenta ver las multas de ALGUIEN MÁS, debe ser oficial o admin
  if (targetUser.id !== interaction.user.id && !isFineOfficer(interaction)) {
    const permErrContainer = new ContainerBuilder()
      .setAccentColor(0xe74c3c)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Permisos Insuficientes")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "Solo el personal autorizado del departamento de tránsito puede consultar el historial de multas de otros ciudadanos."
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System")
      );

    await interaction.editReply({
      components: [permErrContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Server icon como thumbnail (sin avatar ni emojis raros en el título)
  const guildIcon = interaction.guild?.iconURL({ extension: "png", size: 256 })
    ?? targetUser.displayAvatarURL({ extension: "png", size: 256 });

  const isSelf = targetUser.id === interaction.user.id;
  const actionRow = buildFineHistoryButtons(targetUser.id, targetUser.username, isSelf);

  const fines = await Fine.find({ userId: targetUser.id })
    .sort({ createdAt: -1 })
    .limit(10);

  if (fines.length === 0) {
    const emptyContainer = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# HISTORIAL DE MULTAS\nConsulta oficial de infracciones para <@${targetUser.id}>`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(guildIcon)
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("🟢 No se encontraron multas registradas en el historial de este usuario.")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System · Registro Judicial")
      )
      .addActionRowComponents(actionRow);

    await interaction.editReply({
      components: [emptyContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const lines = fines.map((f) => {
    const badge = getStatusBadge(f.status);
    const createdUnix = Math.floor(f.createdAt.getTime() / 1000);
    return `\`${f.multaId}\` · **${formatMxn(f.currentAmount)}** (${badge.label})\n› **Motivo:** ${f.reason} · <t:${createdUnix}:d>`;
  }).join("\n\n");

  const container = new ContainerBuilder()
    .setAccentColor(0x34495e)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# HISTORIAL DE MULTAS\nÚltimas infracciones registradas para <@${targetUser.id}>`
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(guildIcon)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · Registro Judicial`)
    )
    .addActionRowComponents(actionRow);

  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

function buildFineHistoryButtons(targetUserId: string, targetUsername: string, isSelf: boolean): ActionRowBuilder<ButtonBuilder> {
  const activeLabel = isSelf
    ? "📋 Mis multas activas"
    : `📋 Multas activas de ${targetUsername}`;

  const activeCustomId = isSelf
    ? "fine:my_active"
    : `fine:user_active:${targetUserId}`;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("fine:lookup_modal")
      .setLabel("🔎 Consultar multa")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(activeCustomId)
      .setLabel(activeLabel)
      .setStyle(ButtonStyle.Secondary)
  );
}

// ─── 4. CONSULTAR MULTA (MODAL) ────────────────────────────────────────────

export async function handleLookupModalButton(
  interaction: ButtonInteraction
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId("fine:modal_lookup")
    .setTitle("Consultar multa — Sonora RP");

  const l1 = new LabelBuilder()
    .setLabel("ID de la multa")
    .setDescription("Introduce el ID permanente de la multa (ej: MLT-000152)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("multa_id")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("MLT-000152")
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(20)
    );

  modal.addLabelComponents(l1);
  await interaction.showModal(modal);
}

export async function handleLookupModalSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const inputId = interaction.fields.getTextInputValue("multa_id").trim().toUpperCase();
  const fine = await Fine.findOne({ multaId: inputId });

  if (!fine) {
    await sendErrorContainer(
      interaction,
      "❌ MULTA NO ENCONTRADA",
      `El ID introducido (\`${inputId}\`) no corresponde a ninguna multa registrada en el sistema.`
    );
    return;
  }

  const badge = getStatusBadge(fine.status);
  const createdUnix = Math.floor(fine.createdAt.getTime() / 1000);
  const dueUnix = Math.floor(fine.dueAt.getTime() / 1000);

  const container = new ContainerBuilder()
    .setAccentColor(badge.color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ⚖️ MULTA #${fine.multaId}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `👤 **Usuario:** <@${fine.userId}>`,
          `👮 **Emitida por:** <@${fine.issuerId}>`,
          `💰 **Importe original:** \`${formatMxn(fine.originalAmount)}\``,
          `💸 **Importe actual:** \`${formatMxn(fine.currentAmount)}\``,
          `📋 **Motivo:** ${fine.reason}`,
          `📅 **Fecha de emisión:** <t:${createdUnix}:F> (<t:${createdUnix}:R>)`,
          `⏰ **Fecha límite:** <t:${dueUnix}:F> (<t:${dueUnix}:R>)`,
          `**Estado:** ${badge.label}`,
          fine.paidAt ? `🟢 **Fecha de pago:** <t:${Math.floor(fine.paidAt.getTime() / 1000)}:F>` : "",
          fine.cancelReason ? `⚪ **Motivo de cancelación:** ${fine.cancelReason}` : "",
        ].filter(Boolean).join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System · Registro Permanente")
    );

  if ((fine.status === "PENDING" || fine.status === "OVERDUE") && fine.userId === interaction.user.id) {
    const payRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`fine:pay:${fine.multaId}`)
        .setLabel("💳 PAGAR MULTA")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      components: [container, payRow],
      flags: MessageFlags.IsComponentsV2,
    });
  } else {
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

// ─── 5. BOTÓN: MIS MULTAS ACTIVAS / MULTAS ACTIVAS DE USUARIO ───────────────

export async function handleMyActiveFinesButton(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let targetUserId = interaction.user.id;
  if (interaction.customId.startsWith("fine:user_active:")) {
    targetUserId = interaction.customId.split(":")[2];
  }

  // Si consulta las multas activas de otra persona, verificar permiso de oficial
  if (targetUserId !== interaction.user.id && !isFineOfficer(interaction)) {
    const permErrContainer = new ContainerBuilder()
      .setAccentColor(0xe74c3c)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Permisos Insuficientes")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Solo el personal autorizado puede consultar multas de otros usuarios.")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System")
      );

    await interaction.editReply({
      components: [permErrContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const isSelf = targetUserId === interaction.user.id;
  const guildIcon = interaction.guild?.iconURL({ extension: "png", size: 256 })
    ?? interaction.user.displayAvatarURL({ extension: "png", size: 256 });

  const fines = await Fine.find({
    userId: targetUserId,
    status: { $in: ["PENDING", "OVERDUE"] },
  }).sort({ createdAt: -1 });

  if (fines.length === 0) {
    const emptyContainer = new ContainerBuilder()
      .setAccentColor(0x2ecc71)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              isSelf
                ? "## 🟢 No tienes multas activas"
                : `## 🟢 Sin multas activas — <@${targetUserId}>`
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(guildIcon)
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          isSelf
            ? "Actualmente no tienes ninguna deuda pendiente en el servidor."
            : "Este ciudadano no tiene ninguna deuda pendiente actualmente."
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora System · Registro Judicial")
      );

    await interaction.editReply({
      components: [emptyContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  let totalDebt = 0;
  const lines = fines.map((f) => {
    totalDebt += f.currentAmount;
    const badge = getStatusBadge(f.status);
    const dueUnix = Math.floor(f.dueAt.getTime() / 1000);
    return `\`${f.multaId}\` · **${formatMxn(f.currentAmount)}** (${badge.label})\n› **Motivo:** ${f.reason} (Vence <t:${dueUnix}:R>)`;
  }).join("\n\n");

  const titleText = isSelf
    ? `# MIS MULTAS ACTIVAS\nTienes **${fines.length}** multas pendientes.`
    : `# MULTAS ACTIVAS DE <@${targetUserId}>\nTiene **${fines.length}** multas pendientes.`;

  const container = new ContainerBuilder()
    .setAccentColor(0xe74c3c)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(titleText)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(guildIcon)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`💸 **Total adeudado:** \`${formatMxn(totalDebt)}\``)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System · Registro Judicial")
    );

  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── 6. /MULTAS CANCELAR ──────────────────────────────────────────────────

export async function handleCancelarMultaCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isFineOfficer(interaction)) {
    await sendErrorContainer(interaction, "Permisos Insuficientes", "No tienes permisos autorizados para cancelar multas.");
    return;
  }

  const inputId = interaction.options.getString("id", true).trim().toUpperCase();
  const reason = interaction.options.getString("motivo", true).trim();

  const fine = await Fine.findOne({ multaId: inputId });
  if (!fine) {
    await sendErrorContainer(interaction, "Multa No Encontrada", `No existe ninguna multa registrada con el ID \`${inputId}\`.`);
    return;
  }

  if (fine.status === "CANCELLED") {
    await sendErrorContainer(interaction, "Multa Ya Cancelada", `La multa \`${fine.multaId}\` ya se encuentra cancelada en el sistema.`);
    return;
  }

  const wasPaid = fine.status === "PAID";
  let refundMsg = "";

  // Si la multa ya fue pagada, reembolsar automáticamente el dinero al efectivo del ciudadano
  if (wasPaid) {
    const updatedEco = await Economy.findOneAndUpdate(
      { discordId: fine.userId },
      { $inc: { money: fine.currentAmount } },
      { new: true, upsert: true }
    );

    const txId = generateTxId();
    await Transaction.create({
      txId,
      discordId: fine.userId,
      targetId: interaction.user.id,
      type: "admin_add",
      amount: fine.currentAmount,
      balanceMoneyAfter: updatedEco.money,
      balanceBankAfter: updatedEco.bank,
      balanceBlackAfter: updatedEco.blackMoney,
      description: `Reembolso por cancelación de multa ${fine.multaId}`,
    });

    refundMsg = `\n💰 **Reembolso procesado:** Se han devuelto **${formatMxn(fine.currentAmount)}** al efectivo de <@${fine.userId}>.`;
  }

  fine.status = "CANCELLED";
  fine.cancelledAt = new Date();
  fine.cancelledBy = interaction.user.id;
  fine.cancelReason = reason;
  await fine.save();

  // Actualizar mensaje de registro en canal 1529875924550418614
  await updateLogEmbed(client, fine);

  const confirmContainer = new ContainerBuilder()
    .setAccentColor(0x95a5a6)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## ⚪ Multa Cancelada Exitosamente")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `La multa **\`${fine.multaId}\`** ha sido cancelada.`,
          "",
          `› 👤 **Usuario afectado:** <@${fine.userId}>`,
          `› 👮 **Cancelada por:** <@${interaction.user.id}>`,
          `› 📋 **Motivo de cancelación:** ${reason}`,
          wasPaid ? `› 💸 **Estado previo:** Estaba Pagada (${formatMxn(fine.currentAmount)})` : "",
          refundMsg,
        ].filter(Boolean).join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System")
    );

  await interaction.editReply({
    components: [confirmContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── HELPER ERRORES ────────────────────────────────────────────────────────

async function sendErrorContainer(
  interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
  title: string,
  desc: string
): Promise<void> {
  const container = new ContainerBuilder()
    .setAccentColor(0xe74c3c)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(desc)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System")
    );

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } else {
    await interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  }
}
