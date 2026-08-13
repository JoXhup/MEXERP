import {
  ModalBuilder,
  LabelBuilder,
  UserSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type ButtonInteraction,
  type Client,
  type Guild,
  type User,
  type GuildMemberRoleManager,
} from "discord.js";
import { Lockup, type ILockup } from "../models/Lockup.js";
import { getNextLockupId } from "../models/Counter.js";
import { getFooterTimestamp } from "../utils/components.js";

// ─── CONSTANTES DE CONFIGURACIÓN ──────────────────────────────────────────────
export const LOCKUP_ROLE_ID = "1537338860529393714";        // Rol que se le otorga al sancionado
export const LOCKUP_OFFICER_ROLE_ID = "1531426497942781972"; // Rol necesario para ejecutar comandos de gestión
export const LOCKUP_LOG_CHANNEL_ID = "1536545539267764265";  // Foro / Canal de logs de Lockup

// ─── HELPER: PERMISOS ──────────────────────────────────────────────────────────
export function checkLockupPermission(
  interaction: ChatInputCommandInteraction | ButtonInteraction
): boolean {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }
  const roles = interaction.member?.roles;
  if (roles && "cache" in roles) {
    return (roles as GuildMemberRoleManager).cache.has(LOCKUP_OFFICER_ROLE_ID);
  }
  return false;
}

export function buildNoPermissionContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0xef4444)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("## Permisos Insuficientes")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "No cuentas con la autorización necesaria para ejecutar este comando. Se requiere el rol autorizado."
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );
}

// ─── PARSER DE TIEMPO FLEXIBLE ─────────────────────────────────────────────────
/**
 * Soporta s (segundos), m (minutos), h (horas), d (días), m/mes/meses (meses), a/año/años (años)
 */
export function parseLockupDuration(input: string): number | null {
  const normalized = input.trim().toLowerCase();
  let totalMs = 0;
  let matchesCount = 0;

  const regex = /(\d+)\s*(a|y|año|años|mes|meses|mo|d|día|dias|h|hora|horas|m|min|minuto|minutos|s|seg|segundo|segundos)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    matchesCount++;
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (["a", "y", "año", "años"].includes(unit)) {
      totalMs += val * 365 * 24 * 60 * 60 * 1000;
    } else if (["mes", "meses", "mo"].includes(unit)) {
      totalMs += val * 30 * 24 * 60 * 60 * 1000;
    } else if (["d", "día", "dias"].includes(unit)) {
      totalMs += val * 24 * 60 * 60 * 1000;
    } else if (["h", "hora", "horas"].includes(unit)) {
      totalMs += val * 60 * 60 * 1000;
    } else if (["m", "min", "minuto", "minutos"].includes(unit)) {
      totalMs += val * 60 * 1000;
    } else if (["s", "seg", "segundo", "segundos"].includes(unit)) {
      totalMs += val * 1000;
    }
  }

  if (matchesCount === 0 && /^\d+$/.test(normalized)) {
    totalMs = parseInt(normalized, 10) * 60 * 1000;
  }

  return totalMs > 0 ? totalMs : null;
}

/** Formatea una duración en milisegundos a texto legible */
export function formatDuration(ms: number): string {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor((ms / (1000 * 60 * 60 * 24)) % 30);
  const months = Math.floor((ms / (1000 * 60 * 60 * 24 * 30)) % 12);
  const years = Math.floor(ms / (1000 * 60 * 60 * 24 * 365));

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} año(s)`);
  if (months > 0) parts.push(`${months} mes(es)`);
  if (days > 0) parts.push(`${days} día(s)`);
  if (hours > 0) parts.push(`${hours} hora(s)`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds} seg`);

  return parts.join(" ") || "0 seg";
}

// ─── MODAL V2 PARA /lockup enviar ─────────────────────────────────────────────
export function buildLockupModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("lockup:modal_enviar")
    .setTitle("Sancionar con Lockup — Sonora RP");

  // 1. Usuario (UserSelectMenu)
  const l1 = new LabelBuilder()
    .setLabel("Usuario Sancionado")
    .setDescription("Selecciona al usuario que recibirá el Lockup")
    .setUserSelectMenuComponent(
      new UserSelectMenuBuilder()
        .setCustomId("usuario")
        .setPlaceholder("Selecciona el usuario a sancionar...")
        .setMinValues(1)
        .setMaxValues(1)
    );

  // 2. Tiempo (TextInput)
  const l2 = new LabelBuilder()
    .setLabel("Tiempo de Lockup")
    .setDescription("Unidades: s (seg), m (min), h (horas), d (días), mes (meses), a (años)")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("tiempo")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: 30m, 2h, 1d, 2meses, 1a")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(30)
    );

  // 3. Motivo (TextInput Paragraph)
  const l3 = new LabelBuilder()
    .setLabel("Motivo de la Sanción")
    .setDescription("Coloca el motivo detallado de la sanción")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId("motivo")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe la razón de la sanción...")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(1000)
    );

  // 4. Addfiles / Pruebas (FileUpload)
  const l4 = new LabelBuilder()
    .setLabel("Pruebas / Evidencia (Addfiles)")
    .setDescription("Adjunta una imagen o archivo de prueba (opcional)")
    .setFileUploadComponent(
      new FileUploadBuilder()
        .setCustomId("pruebas")
        .setMinValues(0)
        .setMaxValues(1)
        .setRequired(false)
    );

  modal.addLabelComponents(l1, l2, l3, l4);
  return modal;
}

// ─── ENVÍO DEL MODAL /lockup enviar ───────────────────────────────────────────
export async function handleLockupModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!checkLockupPermission(interaction as any)) {
    await interaction.editReply({
      components: [buildNoPermissionContainer()],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const selectedUsers = interaction.fields.getSelectedUsers("usuario");
  const targetUser = selectedUsers?.first();

  if (!targetUser) {
    await interaction.editReply({
      content: "⚠️ Debes seleccionar un usuario para aplicar la sanción de Lockup.",
    });
    return;
  }

  // Comprobar si ya tiene Lockup activo
  const existingActive = await Lockup.findOne({
    discordId: targetUser.id,
    active: true,
  });

  if (existingActive) {
    const errContainer = new ContainerBuilder()
      .setAccentColor(0xef4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Lockup Activo Encontrado")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `El usuario <@${targetUser.id}> ya tiene un Lockup activo actualmente (\`${existingActive.lockupId}\`).\nUsa \`/lockup agregar\` para extender el tiempo o \`/lockup acortar\` para reducirlo.`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [errContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const tiempoInput = interaction.fields.getTextInputValue("tiempo").trim();
  const motivoInput = interaction.fields.getTextInputValue("motivo").trim();
  const uploadedFiles = interaction.fields.getUploadedFiles("pruebas");
  const pruebaFile = uploadedFiles?.first();

  const durationMs = parseLockupDuration(tiempoInput);
  if (!durationMs) {
    await interaction.editReply({
      content: "⚠️ **Formato de tiempo inválido.** Usa combinaciones válidas como `30m`, `2h`, `1d`, `2meses`, `1a`.",
    });
    return;
  }

  const lockupId = await getNextLockupId();
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationMs);
  const pruebasUrl = pruebaFile?.url;

  // Asignar el rol de Lockup al usuario
  const guild = interaction.guild;
  let roleAssigned = false;
  if (guild) {
    try {
      const member =
        guild.members.cache.get(targetUser.id) ??
        (await guild.members.fetch(targetUser.id).catch(() => null));
      if (member) {
        await member.roles.add(LOCKUP_ROLE_ID, `Sanción de Lockup aplicada por ${interaction.user.tag}`);
        roleAssigned = true;
      }
    } catch (err) {
      console.error("[LOCKUP] Error asignando rol:", err);
    }
  }

  // Guardar registro en MongoDB
  const lockupRecord = await Lockup.create({
    lockupId,
    discordId: targetUser.id,
    moderatorId: interaction.user.id,
    guildId: interaction.guildId ?? "DM",
    motivo: motivoInput,
    durationMs,
    startTime,
    endTime,
    active: true,
    pruebasUrl,
    history: [
      {
        action: "ENVIAR",
        moderatorId: interaction.user.id,
        tiempoMs: durationMs,
        motivo: motivoInput,
        timestamp: startTime,
      },
    ],
  });

  const startUnix = Math.floor(startTime.getTime() / 1000);
  const endUnix = Math.floor(endTime.getTime() / 1000);
  const userAvatarUrl = targetUser.displayAvatarURL({ extension: "png", size: 256 });

  // 1. Enviar LOG al foro/canal de logs
  await postLockupLog(
    client,
    "ENVIAR",
    lockupRecord,
    targetUser,
    interaction.user,
    roleAssigned
  );

  // 2. Respuesta de confirmación al moderador
  const confirmContainer = new ContainerBuilder()
    .setAccentColor(0xef4444) // Rojo Sanción
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Sanción de Lockup Aplicada\nSe ha enviado exitosamente a <@${targetUser.id}> a Lockup.`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `› **ID de Sanción:** \`${lockupId}\``,
          `› **Usuario:** <@${targetUser.id}> (${targetUser.tag})`,
          `› **Moderador:** <@${interaction.user.id}>`,
          `› **Duración:** ${formatDuration(durationMs)}`,
          `› **Inicio:** <t:${startUnix}:F>`,
          `› **Término:** <t:${endUnix}:F> (<t:${endUnix}:R>)`,
          `› **Motivo:** ${motivoInput}`,
          roleAssigned
            ? `› **Rol de Lockup:** Asignado automáticamente`
            : `⚠️ **Advertencia:** No se pudo asignar el rol en el servidor.`,
        ].join("\n")
      )
    );

  if (pruebasUrl) {
    confirmContainer
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(pruebasUrl)
        )
      );
  }

  confirmContainer
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );

  await interaction.editReply({
    components: [confirmContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── SUBCOMANDO /lockup agregar ───────────────────────────────────────────────
export async function handleLockupAgregarCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkLockupPermission(interaction)) {
    await interaction.reply({
      components: [buildNoPermissionContainer()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser("usuario", true);
  const tiempoInput = interaction.options.getString("tiempo", true).trim();
  const motivoInput = interaction.options.getString("motivo", true).trim();

  const addMs = parseLockupDuration(tiempoInput);
  if (!addMs) {
    await interaction.editReply({
      content: "⚠️ **Formato de tiempo inválido.** Usa formatos como `30m`, `2h`, `1d`, `2meses`.",
    });
    return;
  }

  const lockup = await Lockup.findOne({ discordId: targetUser.id, active: true });
  if (!lockup) {
    await interaction.editReply({
      content: `⚠️ El usuario <@${targetUser.id}> no tiene ningún Lockup activo en este momento.`,
    });
    return;
  }

  // Actualizar lockup
  lockup.durationMs += addMs;
  lockup.endTime = new Date(lockup.endTime.getTime() + addMs);
  lockup.history.push({
    action: "AGREGAR",
    moderatorId: interaction.user.id,
    tiempoMs: addMs,
    motivo: motivoInput,
    timestamp: new Date(),
  });
  await lockup.save();

  const endUnix = Math.floor(lockup.endTime.getTime() / 1000);
  const userAvatarUrl = targetUser.displayAvatarURL({ extension: "png", size: 256 });

  // Log en foro
  await postLockupLog(interaction.client, "AGREGAR", lockup, targetUser, interaction.user, true, addMs, motivoInput);

  const container = new ContainerBuilder()
    .setAccentColor(0xf59e0b) // Ámbar / Extensión
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Tiempo de Lockup Extendido\nSe ha agregado tiempo al Lockup de <@${targetUser.id}>.`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `› **ID de Sanción:** \`${lockup.lockupId}\``,
          `› **Usuario:** <@${targetUser.id}>`,
          `› **Moderador:** <@${interaction.user.id}>`,
          `› **Tiempo Agregado:** +${formatDuration(addMs)}`,
          `› **Duración Total:** ${formatDuration(lockup.durationMs)}`,
          `› **Nuevo Término:** <t:${endUnix}:F> (<t:${endUnix}:R>)`,
          `› **Motivo de la Extensión:** ${motivoInput}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );

  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── SUBCOMANDO /lockup acortar ───────────────────────────────────────────────
export async function handleLockupAcortarCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkLockupPermission(interaction)) {
    await interaction.reply({
      components: [buildNoPermissionContainer()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser("usuario", true);
  const tiempoInput = interaction.options.getString("tiempo", true).trim();
  const motivoInput = interaction.options.getString("motivo", true).trim();

  const subMs = parseLockupDuration(tiempoInput);
  if (!subMs) {
    await interaction.editReply({
      content: "⚠️ **Formato de tiempo inválido.** Usa formatos como `30m`, `2h`, `1d`.",
    });
    return;
  }

  const lockup = await Lockup.findOne({ discordId: targetUser.id, active: true });
  if (!lockup) {
    await interaction.editReply({
      content: `⚠️ El usuario <@${targetUser.id}> no tiene ningún Lockup activo en este momento.`,
    });
    return;
  }

  // Restar tiempo
  lockup.endTime = new Date(lockup.endTime.getTime() - subMs);
  const now = new Date();
  let finalizado = false;

  if (lockup.endTime <= now) {
    lockup.active = false;
    lockup.endTime = now;
    finalizado = true;

    // Quitar rol de Lockup
    try {
      const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
      if (member) {
        await member.roles.remove(LOCKUP_ROLE_ID, "Lockup finalizado por reducción de tiempo");
      }
    } catch (err) {
      console.error("[LOCKUP] Error quitando rol:", err);
    }
  }

  lockup.history.push({
    action: "ACORTAR",
    moderatorId: interaction.user.id,
    tiempoMs: subMs,
    motivo: motivoInput,
    timestamp: now,
  });
  await lockup.save();

  const endUnix = Math.floor(lockup.endTime.getTime() / 1000);
  const userAvatarUrl = targetUser.displayAvatarURL({ extension: "png", size: 256 });

  // Log en foro
  await postLockupLog(interaction.client, "ACORTAR", lockup, targetUser, interaction.user, true, subMs, motivoInput);

  const container = new ContainerBuilder()
    .setAccentColor(0x10b981) // Verde esmeralda / Reducción
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Tiempo de Lockup Reducido\nSe ha reducido tiempo del Lockup de <@${targetUser.id}>.`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `› **ID de Sanción:** \`${lockup.lockupId}\``,
          `› **Usuario:** <@${targetUser.id}>`,
          `› **Moderador:** <@${interaction.user.id}>`,
          `› **Tiempo Reducido:** -${formatDuration(subMs)}`,
          finalizado
            ? `› **Estado:** 🟢 **Sanción Finalizada** (El rol de Lockup ha sido retirado)`
            : `› **Nuevo Término:** <t:${endUnix}:F> (<t:${endUnix}:R>)`,
          `› **Motivo de la Reducción:** ${motivoInput}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );

  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── SUBCOMANDO /lockup retirar ───────────────────────────────────────────────
export async function handleLockupRetirarCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkLockupPermission(interaction)) {
    await interaction.reply({
      components: [buildNoPermissionContainer()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser("usuario", true);
  const lockup = await Lockup.findOne({ discordId: targetUser.id, active: true });

  if (!lockup) {
    const errContainer = new ContainerBuilder()
      .setAccentColor(0xef4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Sin Lockup Activo")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `El usuario <@${targetUser.id}> no tiene ninguna sanción de Lockup activa actualmente.`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [errContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const startUnix = Math.floor(lockup.startTime.getTime() / 1000);
  const endUnix = Math.floor(lockup.endTime.getTime() / 1000);
  const userAvatarUrl = targetUser.displayAvatarURL({ extension: "png", size: 256 });

  // Construir mensaje de estadísticas con botones de confirmación
  const container = new ContainerBuilder()
    .setAccentColor(0xef4444)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Confirmación de Retiro de Lockup\n¿Estás seguro de que deseas retirar la sanción de <@${targetUser.id}>?`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Estadísticas de la Sanción:**`,
          `› **ID de Lockup:** \`${lockup.lockupId}\``,
          `› **Sancionado:** <@${targetUser.id}>`,
          `› **Moderador Inicial:** <@${lockup.moderatorId}>`,
          `› **Duración Asignada:** ${formatDuration(lockup.durationMs)}`,
          `› **Fecha Inicio:** <t:${startUnix}:F>`,
          `› **Vencimiento Estimado:** <t:${endUnix}:R>`,
          `› **Motivo Original:** ${lockup.motivo}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`lockup:retirar:confirm:${lockup._id}`)
          .setLabel("Confirmar Retiro")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("✅"),
        new ButtonBuilder()
          .setCustomId(`lockup:retirar:cancel:${lockup._id}`)
          .setLabel("Cancelar")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("✖️")
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );

  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── BOTONES DE CONFIRMACIÓN DE RETIRO ─────────────────────────────────────────
export async function handleLockupRetirarButton(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  if (!checkLockupPermission(interaction)) {
    await interaction.reply({
      components: [buildNoPermissionContainer()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  const parts = interaction.customId.split(":");
  const action = parts[2]; // "confirm" o "cancel"
  const mongoId = parts[3];

  const lockup = await Lockup.findById(mongoId);
  if (!lockup || !lockup.active) {
    await interaction.update({
      content: "⚠️ Este Lockup ya no se encuentra activo o no fue encontrado.",
      components: [],
    });
    return;
  }

  if (action === "confirm") {
    lockup.active = false;
    lockup.retiredBy = interaction.user.id;
    lockup.retiredAt = new Date();
    lockup.history.push({
      action: "RETIRAR",
      moderatorId: interaction.user.id,
      timestamp: new Date(),
    });
    await lockup.save();

    // Quitar rol de Lockup
    try {
      const member = await interaction.guild?.members.fetch(lockup.discordId).catch(() => null);
      if (member) {
        await member.roles.remove(LOCKUP_ROLE_ID, `Lockup retirado por ${interaction.user.tag}`);
      }
    } catch (err) {
      console.error("[LOCKUP] Error quitando rol al retirar:", err);
    }

    const targetUser = await client.users.fetch(lockup.discordId).catch(() => null);

    // Log en foro
    if (targetUser) {
      await postLockupLog(client, "RETIRAR", lockup, targetUser, interaction.user, true);
    }

    const successContainer = new ContainerBuilder()
      .setAccentColor(0x10b981)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Lockup Retirado Exitosamente")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `La sanción de Lockup (\`${lockup.lockupId}\`) para <@${lockup.discordId}> ha sido retirada correctamente y el rol ha sido removido.`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
      );

    await interaction.update({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  } else {
    // Cancelar
    const cancelContainer = new ContainerBuilder()
      .setAccentColor(0x6b7280)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("## Acción Cancelada")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Se ha cancelado el retiro de la sanción de Lockup.")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
      );

    await interaction.update({
      components: [cancelContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

// ─── SUBCOMANDO /lockup historial ─────────────────────────────────────────────
export async function handleLockupHistorialCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  // CUALQUIERA PUEDE USAR ESTE SUBCOMANDO
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
  const records = await Lockup.find({ discordId: targetUser.id }).sort({ createdAt: -1 });

  const userAvatarUrl = targetUser.displayAvatarURL({ extension: "png", size: 256 });
  const activeRecord = records.find((r) => r.active);

  if (records.length === 0) {
    const emptyContainer = new ContainerBuilder()
      .setAccentColor(0x3b82f6)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `# Historial de Lockup — ${targetUser.username}\nNo existen registros de sanciones de Lockup para <@${targetUser.id}>.`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [emptyContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const historyLines: string[] = [];
  const topRecords = records.slice(0, 5); // Mostrar los 5 más recientes

  for (const r of topRecords) {
    const createdUnix = Math.floor(r.createdAt.getTime() / 1000);
    const endUnix = Math.floor(r.endTime.getTime() / 1000);
    const statusText = r.active ? "🔴 **ACTIVO**" : "🟢 **FINALIZADO**";

    historyLines.push(
      [
        `• **\`${r.lockupId}\`** — Status: ${statusText}`,
        `  › **Duración:** ${formatDuration(r.durationMs)}`,
        `  › **Fecha Registro:** <t:${createdUnix}:d>`,
        `  › **Vencimiento:** <t:${endUnix}:F>`,
        `  › **Moderador:** <@${r.moderatorId}>`,
        `  › **Motivo:** ${r.motivo}`,
      ].join("\n")
    );
  }

  const container = new ContainerBuilder()
    .setAccentColor(0x3b82f6)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# Historial de Lockup\nExpediente sancionatorio de <@${targetUser.id}>`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Estadísticas Generales:**`,
          `› **Total Sanciones:** ${records.length}`,
          `› **Estado Actual:** ${activeRecord ? `🔴 Sancionado activo (\`${activeRecord.lockupId}\`)` : "🟢 Sin Lockup activo"}`,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Historial Reciente:**\n\n` + historyLines.join("\n\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );

  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

// ─── PUBLICAR LOG EN EL FORO / CANAL DE LOGS ─────────────────────────────────
export async function postLockupLog(
  client: Client,
  actionType: "ENVIAR" | "AGREGAR" | "ACORTAR" | "RETIRAR" | "EXPIRAR",
  lockup: ILockup,
  sancionado: User,
  moderador: User,
  roleAssigned: boolean = true,
  deltaMs?: number,
  deltaMotivo?: string
): Promise<void> {
  const targetChannel = await client.channels.fetch(LOCKUP_LOG_CHANNEL_ID).catch(() => null);
  if (!targetChannel) {
    console.error(`[LOCKUP_LOG] No se pudo encontrar el canal de logs (${LOCKUP_LOG_CHANNEL_ID}).`);
    return;
  }

  const startUnix = Math.floor(lockup.startTime.getTime() / 1000);
  const endUnix = Math.floor(lockup.endTime.getTime() / 1000);
  const userAvatarUrl = sancionado.displayAvatarURL({ extension: "png", size: 256 });

  let actionTitle = "Sanción de Lockup Registrada";
  let accentColor = 0xef4444; // Rojo

  if (actionType === "AGREGAR") {
    actionTitle = "Tiempo de Lockup Extendido";
    accentColor = 0xf59e0b; // Ámbar
  } else if (actionType === "ACORTAR") {
    actionTitle = "Tiempo de Lockup Reducido";
    accentColor = 0x10b981; // Verde
  } else if (actionType === "RETIRAR") {
    actionTitle = "Sanción de Lockup Retirada";
    accentColor = 0x3b82f6; // Azul
  } else if (actionType === "EXPIRAR") {
    actionTitle = "Sanción de Lockup Expirada Automáticamente";
    accentColor = 0x10b981; // Verde
  }

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# ${actionTitle}\nSanción **\`${lockup.lockupId}\`**`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `› **ID de Lockup:** \`${lockup.lockupId}\``,
          `› **Sancionado:** <@${sancionado.id}> (${sancionado.tag})`,
          `› **Moderador:** <@${moderador.id}>`,
          `› **Acción:** \`${actionType}\``,
          deltaMs ? `› **Variación de Tiempo:** ${actionType === "AGREGAR" ? "+" : "-"}${formatDuration(deltaMs)}` : "",
          `› **Duración Acumulada:** ${formatDuration(lockup.durationMs)}`,
          `› **Fecha Inicio:** <t:${startUnix}:F>`,
          `› **Vencimiento:** <t:${endUnix}:F> (<t:${endUnix}:R>)`,
          `› **Motivo:** ${deltaMotivo ?? lockup.motivo}`,
        ]
          .filter(Boolean)
          .join("\n")
      )
    );

  if (lockup.pruebasUrl) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(lockup.pruebasUrl)
        )
      );
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora System · ${getFooterTimestamp()}`)
    );

  try {
    if ((targetChannel as any).isThreadOnly?.() || (targetChannel as any).type === 15) {
      const forumChannel = targetChannel as import("discord.js").ForumChannel;
      await forumChannel.threads.create({
        name: `[LOCKUP] ${sancionado.username} - ${lockup.lockupId}`,
        message: { components: [container], flags: MessageFlags.IsComponentsV2 as any },
      });
    } else if ((targetChannel as any).isTextBased?.()) {
      const textChannel = targetChannel as import("discord.js").TextChannel;
      await textChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2 as any,
      });
    }
  } catch (err) {
    console.error("[LOCKUP_LOG] Error enviando registro al canal:", err);
  }
}

// ─── COMPROBADOR DE EXPIRACIÓN AUTOMÁTICA EN SEGUNDO PLANO ─────────────────────
export function initLockupExpirationChecker(client: Client): void {
  console.log("[LOCKUP] Iniciando comprobador de expiración automática cada 60 segundos...");

  setInterval(async () => {
    try {
      const now = new Date();
      const expiredLockups = await Lockup.find({
        active: true,
        endTime: { $lte: now },
      });

      for (const lockup of expiredLockups) {
        lockup.active = false;
        lockup.history.push({
          action: "EXPIRAR",
          moderatorId: client.user?.id ?? "SYSTEM",
          timestamp: now,
        });
        await lockup.save();

        const guild = client.guilds.cache.get(lockup.guildId) ?? client.guilds.cache.first();
        if (guild) {
          const member = await guild.members.fetch(lockup.discordId).catch(() => null);
          if (member) {
            await member.roles.remove(LOCKUP_ROLE_ID, "Lockup expirado automáticamente por tiempo cumplido");
          }
        }

        const sancionado = await client.users.fetch(lockup.discordId).catch(() => null);
        const systemUser = client.user ?? sancionado;

        if (sancionado && systemUser) {
          await postLockupLog(client, "EXPIRAR", lockup, sancionado, systemUser, true);
        }

        console.log(`[LOCKUP] Sanción ${lockup.lockupId} de ${lockup.discordId} ha expirado y el rol fue removido.`);
      }
    } catch (err) {
      console.error("[LOCKUP] Error en comprobador de expiración:", err);
    }
  }, 60000); // Revisar cada 1 minuto
}
