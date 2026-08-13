/**
 * warnHandler.ts
 * Maneja:
 *   - /warn administrativo     → Modal V2 (staff, falta, hasta 5 addfiles)
 *   - /sancion administrativa retirar → Modal V2 con select de warns activos
 */

import {
  ModalBuilder,
  LabelBuilder,
  UserSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type ButtonInteraction,
  type Client,
  type GuildMemberRoleManager,
} from "discord.js";
import { AdminWarn } from "../models/AdminWarn.js";
import { StaffStats } from "../models/StaffStats.js";
import { Lockup } from "../models/Lockup.js";
import { getNextWarnId } from "../models/Counter.js";
import { getFooterTimestamp } from "../utils/components.js";

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
export const WARN_OFFICER_ROLE_ID  = "1531426497942781972";
export const STATS_RESET_ROLE_ID   = "1531819188341968906";
export const WARN_LOG_CHANNEL_ID   = "1536545298904518707";
export const SANCION_LOG_CHANNEL_ID = "1537410634876981268";

// ─── PERMISOS ──────────────────────────────────────────────────────────────────
function hasRole(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction, roleId: string): boolean {
  if ((interaction.memberPermissions as any)?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = interaction.member?.roles;
  if (roles && "cache" in roles) return (roles as GuildMemberRoleManager).cache.has(roleId);
  return false;
}

export function buildNoPermContainer(client: Client): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0xef4444)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## ⛔ Permisos Insuficientes"))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("No tienes el rol requerido para ejecutar este comando."))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));
}

// ─── MODAL V2: /warn administrativo ───────────────────────────────────────────
export function buildWarnModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("warn:modal_admin")
    .setTitle("Advertencia Administrativa — Sonora RP");

  const l1 = new LabelBuilder()
    .setLabel("Miembro del Staff")
    .setDescription("Selecciona al miembro del staff que recibirá la advertencia")
    .setUserSelectMenuComponent(
      new UserSelectMenuBuilder()
        .setCustomId("staff")
        .setPlaceholder("Selecciona al miembro...")
        .setMinValues(1)
        .setMaxValues(1)
    );

  const l2 = new LabelBuilder()
    .setLabel("Falta Cometida")
    .setDescription("Describe detalladamente la falta cometida por el miembro")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("falta")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe la infracción cometida...")
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(1000)
    );

  const l3 = new LabelBuilder()
    .setLabel("Evidencias / Addfiles")
    .setDescription("Sube hasta 5 imágenes de prueba (obligatorio)")
    .setFileUploadComponent(
      new FileUploadBuilder()
        .setCustomId("pruebas")
        .setMinValues(1)
        .setMaxValues(5)
        .setRequired(true)
    );

  modal.addLabelComponents(l1, l2, l3);
  return modal;
}

// ─── MODAL SUBMIT: /warn administrativo ───────────────────────────────────────
export async function handleWarnModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!hasRole(interaction as any, WARN_OFFICER_ROLE_ID)) {
    await interaction.editReply({ components: [buildNoPermContainer(client)], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const staffSelected = interaction.fields.getSelectedUsers("staff");
  const staffUser = staffSelected?.first();
  if (!staffUser) {
    await interaction.editReply({ content: "⚠️ No se seleccionó ningún miembro del staff." });
    return;
  }

  const falta = interaction.fields.getTextInputValue("falta").trim();
  const uploadedFiles = interaction.fields.getUploadedFiles("pruebas");
  const pruebasUrls = uploadedFiles ? [...uploadedFiles.values()].map(f => f.url) : [];

  if (pruebasUrls.length === 0) {
    await interaction.editReply({ content: "⚠️ Debes subir al menos una imagen como evidencia." });
    return;
  }

  // ── Validar que el usuario sea staff contratado o tenga rol admin ─────────
  const STAFF_PERM_ROLE = "1531825255889506506";
  const targetMember = interaction.guild?.members.cache.get(staffUser.id)
    ?? await interaction.guild?.members.fetch(staffUser.id).catch(() => undefined);

  const isContratado = !!(await StaffStats.findOne({
    guildId: interaction.guildId!,
    userId: staffUser.id,
    hiredAt: { $exists: true, $ne: null },
  }));

  const isAdmin =
    targetMember?.permissions.has(8n) ||
    targetMember?.roles.cache.has(STAFF_PERM_ROLE);

  if (!isContratado && !isAdmin) {
    const cancelContainer = new ContainerBuilder()
      .setAccentColor(0xf59e0b)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## ⚠️ Usuario No es Staff"))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `<@${staffUser.id}> no está registrado como miembro del staff contratado.`,
        ``,
        `Solo puedes emitir advertencias administrativas a miembros activos del staff.`,
        `Verifica que el usuario haya sido contratado con \`/contratar\`.`,
      ].join("\n")))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

    await interaction.editReply({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  const warnId = await getNextWarnId();
  const now = new Date();

  await AdminWarn.create({
    warnId,
    discordId: staffUser.id,
    moderatorId: interaction.user.id,
    guildId: interaction.guildId ?? "DM",
    falta,
    pruebasUrls,
    active: true,
    createdAt: now,
  });

  const staffAvatar = staffUser.displayAvatarURL({ extension: "png", size: 256 });
  const createdUnix = Math.floor(now.getTime() / 1000);

  // Log en foro de advertencias
  await postWarnLog(client, "EMITIR", warnId, staffUser.id, staffAvatar, interaction.user.id, falta, pruebasUrls, now);

  // Confirmación al moderador
  const gallery = new MediaGalleryBuilder();
  for (const url of pruebasUrls.slice(0, 5)) {
    gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
  }

  const confirmContainer = new ContainerBuilder()
    .setAccentColor(0xef4444)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# Advertencia Administrativa Emitida\nSe ha registrado la falta para <@${staffUser.id}>.`
        ))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(staffAvatar))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `› **ID de Advertencia:** \`${warnId}\``,
      `› **Miembro:** <@${staffUser.id}> (${staffUser.tag})`,
      `› **Emitida por:** <@${interaction.user.id}>`,
      `› **Fecha:** <t:${createdUnix}:F>`,
      `› **Falta:** ${falta}`,
      `› **Evidencias:** ${pruebasUrls.length} archivo(s) adjunto(s)`,
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addMediaGalleryComponents(gallery)
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

  await interaction.editReply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
}

// ─── MODAL V2: /sancion administrativa retirar ────────────────────────────────
export async function handleSancionRetirarCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  if (!hasRole(interaction, WARN_OFFICER_ROLE_ID)) {
    await interaction.reply({ components: [buildNoPermContainer(client)], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    return;
  }

  const targetUser = interaction.options.getUser("usuario");

  // Obtener warns activos
  const query = targetUser
    ? { discordId: targetUser.id, active: true }
    : { active: true };

  const activeWarns = await AdminWarn.find(query).sort({ createdAt: -1 }).limit(25);

  if (activeWarns.length === 0) {
    const emptyContainer = new ContainerBuilder()
      .setAccentColor(0x10b981)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## ✅ Sin Sanciones Activas"))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        targetUser
          ? `El miembro <@${targetUser.id}> no tiene advertencias administrativas activas.`
          : `No existen advertencias administrativas activas en el sistema.`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

    await interaction.reply({ components: [emptyContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    return;
  }

  // Construir modal con select menu de warns activos
  const options = await Promise.all(
    activeWarns.map(async (w) => {
      let username = w.discordId;
      try {
        const u = await client.users.fetch(w.discordId);
        username = u.username;
      } catch { /* ok */ }

      const faltaLabel = w.falta.slice(0, 45) + (w.falta.length > 45 ? "…" : "");
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${w.warnId} — ${username}`)
        .setDescription(faltaLabel)
        .setValue(w.warnId);
    })
  );

  const modal = new ModalBuilder()
    .setCustomId("sancion:retirar:modal")
    .setTitle("Retirar Sanción Administrativa");

  const l1 = new LabelBuilder()
    .setLabel("Sanción a Retirar")
    .setDescription("Selecciona la advertencia administrativa que deseas retirar")
    .setStringSelectMenuComponent(
      new StringSelectMenuBuilder()
        .setCustomId("warn_id")
        .setPlaceholder("Selecciona la sanción...")
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(...options)
    );

  modal.addLabelComponents(l1);
  await interaction.showModal(modal);
}

// ─── MODAL SUBMIT: sancion:retirar:modal ──────────────────────────────────────
export async function handleSancionRetirarModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!hasRole(interaction as any, WARN_OFFICER_ROLE_ID)) {
    await interaction.editReply({ components: [buildNoPermContainer(client)], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // Obtener el warn seleccionado (StringSelect en modal V2)
  let selectedWarnId: string | null = null;
  try {
    const selectedValues = interaction.fields.getStringSelectValues("warn_id");
    selectedWarnId = selectedValues?.[0] ?? null;
  } catch {
    const rawComponents = (interaction as any).data?.components ?? (interaction as any).components ?? [];
    for (const row of rawComponents) {
      const inner = row?.components?.[0] ?? row;
      if (inner?.values?.length) {
        selectedWarnId = inner.values[0];
        break;
      }
    }
  }

  if (!selectedWarnId) {
    await interaction.editReply({ content: "⚠️ No se pudo obtener la sanción seleccionada." });
    return;
  }

  const warn = await AdminWarn.findOne({ warnId: selectedWarnId, active: true });
  if (!warn) {
    await interaction.editReply({ content: `⚠️ La sanción \`${selectedWarnId}\` ya no está activa o no existe.` });
    return;
  }

  let staffUser = null;
  try { staffUser = await client.users.fetch(warn.discordId); } catch { /* ok */ }
  const staffAvatar = staffUser?.displayAvatarURL({ extension: "png", size: 256 }) ?? "";
  const createdUnix = Math.floor(warn.createdAt.getTime() / 1000);

  // Mostrar confirmación con botones
  const confirmContainer = new ContainerBuilder()
    .setAccentColor(0xf59e0b)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# Confirmar Retiro de Sanción\n¿Estás seguro de que deseas retirar esta advertencia?`
        ))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(staffAvatar))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `› **ID:** \`${warn.warnId}\``,
      `› **Miembro:** ${staffUser ? `<@${staffUser.id}> (${staffUser.tag})` : `ID: ${warn.discordId}`}`,
      `› **Emitida por:** <@${warn.moderatorId}>`,
      `› **Fecha:** <t:${createdUnix}:F>`,
      `› **Falta:** ${warn.falta}`,
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`sancion:retirar:confirm:${warn.warnId}`)
          .setLabel("Confirmar Retiro")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("✅"),
        new ButtonBuilder()
          .setCustomId(`sancion:retirar:cancel`)
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✖️")
      )
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

  await interaction.editReply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
}

// ─── BOTONES: confirm/cancel de sancion retirar ───────────────────────────────
export async function handleSancionRetirarButton(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  if (!hasRole(interaction, WARN_OFFICER_ROLE_ID)) {
    await interaction.reply({ components: [buildNoPermContainer(client)], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    return;
  }

  const parts = interaction.customId.split(":");
  const action = parts[2];

  if (action === "cancel") {
    const cancelContainer = new ContainerBuilder()
      .setAccentColor(0x6b7280)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Acción Cancelada"))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("Se canceló el retiro de la sanción. No se realizaron cambios."))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

    await interaction.update({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (action === "confirm") {
    const warnId = parts[3];
    const warn = await AdminWarn.findOne({ warnId, active: true });

    if (!warn) {
      await interaction.update({ content: "⚠️ Esta sanción ya no está activa o no existe.", components: [] });
      return;
    }

    warn.active = false;
    warn.retiredBy = interaction.user.id;
    warn.retiredAt = new Date();
    await warn.save();

    let staffUser = null;
    try { staffUser = await client.users.fetch(warn.discordId); } catch { /* ok */ }
    const staffAvatar = staffUser?.displayAvatarURL({ extension: "png", size: 256 }) ?? "";

    // Enviar log
    await postSancionLog(client, "RETIRAR", warn.warnId, warn.discordId, staffAvatar, interaction.user.id, warn.falta);

    const successContainer = new ContainerBuilder()
      .setAccentColor(0x10b981)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# Sanción Retirada Exitosamente\nLa advertencia \`${warn.warnId}\` fue removida.`
          ))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(staffAvatar))
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `› **ID:** \`${warn.warnId}\``,
        `› **Miembro:** ${staffUser ? `<@${staffUser.id}>` : `ID: ${warn.discordId}`}`,
        `› **Retirada por:** <@${interaction.user.id}>`,
        `› **Falta original:** ${warn.falta}`,
      ].join("\n")))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

    await interaction.update({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
    return;
  }
}

// ─── /stats reiniciar ─────────────────────────────────────────────────────────
export async function handleStatsReiniciarCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  if (!hasRole(interaction, STATS_RESET_ROLE_ID)) {
    await interaction.reply({ components: [buildNoPermContainer(client)], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Obtener conteo antes de reiniciar
  const total = await StaffStats.countDocuments({ guildId: interaction.guildId! });

  // Reiniciar todos los campos estadísticos
  await StaffStats.updateMany(
    { guildId: interaction.guildId! },
    {
      $set: {
        totalClaimed: 0,
        totalClosed: 0,
        totalTranscripts: 0,
        totalShiftTimeMs: 0,
        categoryCounts: {},
        lastActiveAt: new Date(),
      }
    }
  );

  const now = new Date();
  const nowUnix = Math.floor(now.getTime() / 1000);

  // Enviar log al canal de sanciones
  const logChannel = await client.channels.fetch(SANCION_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel && (logChannel as any).isTextBased?.()) {
    const logContainer = new ContainerBuilder()
      .setAccentColor(0x7c3aed)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# Reinicio de Estadísticas — Perfiles Administrativos`
          ))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(
            client.user?.displayAvatarURL({ size: 256 }) ?? ""
          ))
      )
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `› **Acción:** Reinicio masivo de estadísticas`,
        `› **Ejecutado por:** <@${interaction.user.id}>`,
        `› **Fecha:** <t:${nowUnix}:F>`,
        `› **Perfiles reiniciados:** ${total}`,
        `› **Campos reseteados:** Tickets, Horas de Turno, Categorías`,
        ``,
        `-# Las calificaciones son recalculadas automáticamente desde 0.`,
      ].join("\n")))
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

    await (logChannel as any).send({ components: [logContainer], flags: MessageFlags.IsComponentsV2 });
  }

  // Confirmación al ejecutor
  const confirmContainer = new ContainerBuilder()
    .setAccentColor(0x7c3aed)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# Reinicio Completado\nTodos los perfiles administrativos han sido reiniciados.`
        ))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(
          client.user?.displayAvatarURL({ size: 256 }) ?? ""
        ))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `› **Perfiles afectados:** ${total}`,
      `› **Fecha:** <t:${nowUnix}:F>`,
      `› **Campos reiniciados:**`,
      `  — Tickets atendidos → 0`,
      `  — Horas de turno → 0`,
      `  — Categorías → 0`,
      ``,
      `✅ Las estadísticas han sido enviadas al canal de registro.`,
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

  await interaction.editReply({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
}

// ─── LOG: Warn emitido ─────────────────────────────────────────────────────────
async function postWarnLog(
  client: Client,
  action: "EMITIR" | "RETIRAR",
  warnId: string,
  staffId: string,
  staffAvatar: string,
  modId: string,
  falta: string,
  pruebasUrls: string[],
  fecha: Date
): Promise<void> {
  const channel = await client.channels.fetch(WARN_LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const unix = Math.floor(fecha.getTime() / 1000);

  const gallery = new MediaGalleryBuilder();
  for (const url of pruebasUrls.slice(0, 5)) {
    gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
  }

  const container = new ContainerBuilder()
    .setAccentColor(action === "EMITIR" ? 0xef4444 : 0x10b981)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# ${action === "EMITIR" ? "Advertencia Administrativa Emitida" : "Advertencia Administrativa Retirada"}\nRegistro \`${warnId}\``
        ))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(staffAvatar))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `› **ID:** \`${warnId}\``,
      `› **Miembro:** <@${staffId}>`,
      `› **Moderador:** <@${modId}>`,
      `› **Acción:** \`${action}\``,
      `› **Fecha:** <t:${unix}:F>`,
      `› **Falta:** ${falta}`,
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addMediaGalleryComponents(gallery)
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

  try {
    if ((channel as any).isThreadOnly?.() || (channel as any).type === 15) {
      await (channel as import("discord.js").ForumChannel).threads.create({
        name: `[ADW] ${warnId} — Staff ${staffId}`,
        message: { components: [container], flags: MessageFlags.IsComponentsV2 as any },
      });
    } else if ((channel as any).isTextBased?.()) {
      await (channel as import("discord.js").TextChannel).send({ components: [container], flags: MessageFlags.IsComponentsV2 as any });
    }
  } catch (err) {
    console.error("[WARN_LOG] Error enviando log:", err);
  }
}

// ─── LOG: Sancion retirada ─────────────────────────────────────────────────────
async function postSancionLog(
  client: Client,
  action: "RETIRAR",
  warnId: string,
  staffId: string,
  staffAvatar: string,
  modId: string,
  falta: string
): Promise<void> {
  const channel = await client.channels.fetch(SANCION_LOG_CHANNEL_ID).catch(() => null);
  if (!channel || !(channel as any).isTextBased?.()) return;

  const now = new Date();
  const unix = Math.floor(now.getTime() / 1000);

  const container = new ContainerBuilder()
    .setAccentColor(0x10b981)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# Sanción Administrativa Retirada\nRegistro \`${warnId}\``
        ))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(staffAvatar))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `› **ID:** \`${warnId}\``,
      `› **Miembro:** <@${staffId}>`,
      `› **Retirada por:** <@${modId}>`,
      `› **Fecha de Retiro:** <t:${unix}:F>`,
      `› **Falta Original:** ${falta}`,
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

  await (channel as import("discord.js").TextChannel).send({ components: [container], flags: MessageFlags.IsComponentsV2 as any });
}
