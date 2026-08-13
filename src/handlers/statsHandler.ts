/**
 * statsHandler.ts
 * Maneja el select menu del /stats revisar para navegar entre:
 *   - Perfil Revisar
 *   - Estadísticas Generales
 *   - Sanciones Administrativas
 */

import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
  type StringSelectMenuInteraction,
  type Client,
} from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
import { Lockup } from "../models/Lockup.js";
import { AdminWarn } from "../models/AdminWarn.js";
import {
  buildStaffProfileContainer,
  getFooterTimestamp,
  getRandomColor,
} from "../utils/components.js";
import { formatDuration } from "./lockupHandler.js";

// ─── Importar formatShiftTime del components ──────────────────────────────────
function formatShiftTime(ms?: number): string {
  if (!ms || ms <= 0) return "0h 0m";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// ─── Calificación automática ──────────────────────────────────────────────────
function calcularCalificacion(
  tickets: number,
  shiftMs: number,
  sanciones: number
): { stars: string; label: string; score: number } {
  // Score basado en tickets (máx 50 pts), horas (máx 30 pts), sin penalizaciones por sanciones
  const ticketScore = Math.min(tickets / 2, 50);
  const horasScore = Math.min((shiftMs / (1000 * 60 * 60)) * 3, 30);
  const sancionPenalty = Math.min(sanciones * 10, 30);

  const total = Math.max(0, Math.round(ticketScore + horasScore - sancionPenalty));

  let stars: string;
  let label: string;

  if (total >= 80) { stars = "⭐⭐⭐⭐⭐"; label = "Excelente"; }
  else if (total >= 60) { stars = "⭐⭐⭐⭐"; label = "Muy Bueno"; }
  else if (total >= 40) { stars = "⭐⭐⭐"; label = "Regular"; }
  else if (total >= 20) { stars = "⭐⭐"; label = "Deficiente"; }
  else { stars = "⭐"; label = "Crítico"; }

  return { stars, label, score: total };
}

// ─── SELECT MENU HANDLER ──────────────────────────────────────────────────────
export async function handleStatsSelectMenu(
  interaction: StringSelectMenuInteraction,
  client: Client
): Promise<void> {
  // customId format: stats:menu:<targetUserId>
  const parts = interaction.customId.split(":");
  const targetUserId = parts[2];

  if (!targetUserId) {
    await interaction.update({ content: "⚠️ Error: ID de usuario no encontrado." });
    return;
  }

  const selected = interaction.values[0];

  // Validar permisos: solo staff con rol STAFF_PERM_ROLE o Admin pueden ver
  const STAFF_PERM_ROLE = "1531825255889506506";
  const executorMember = interaction.guild?.members.cache.get(interaction.user.id);
  const canView =
    executorMember?.roles.cache.has(STAFF_PERM_ROLE) ||
    executorMember?.permissions.has(PermissionFlagsBits.Administrator);

  if (!canView) {
    await interaction.reply({
      content: "⚠️ No tienes permisos para navegar este panel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Fetch datos del target
  const guild = interaction.guild;
  let targetMember = guild?.members.cache.get(targetUserId);
  if (!targetMember && guild) {
    targetMember = await guild.members.fetch(targetUserId).catch(() => undefined);
  }

  if (!targetMember) {
    await interaction.reply({
      content: "⚠️ No se pudo encontrar al usuario en este servidor.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = targetMember.user;
  const userStats = await StaffStats.findOne({
    guildId: interaction.guildId!,
    userId: targetUserId,
  });
  const verifiedUser = await VerifiedUser.findOne({ discordId: targetUserId });
  const lockups = await Lockup.find({ discordId: targetUserId }).sort({ createdAt: -1 });
  const activeLockup = lockups.find((l) => l.active);
  const adminWarns = await AdminWarn.find({ discordId: targetUserId }).sort({ createdAt: -1 });
  const activeWarns = adminWarns.filter(w => w.active);

  const processedCount = userStats?.totalClosed ?? userStats?.totalClaimed ?? 0;
  const totalShiftTimeMs = userStats?.totalShiftTimeMs ?? 0;
  const robloxName = verifiedUser?.robloxName ?? null;
  const hiredAt = userStats?.hiredAt ?? null;
  const userAvatar = targetUser.displayAvatarURL({ size: 256 });

  // ─── Construir el select menu para reusar en cada view ─────────────────────
  function buildNav(): ActionRowBuilder<StringSelectMenuBuilder> {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`stats:menu:${targetUserId}`)
      .setPlaceholder("📋 Navegar a...")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Perfil Revisar")
          .setDescription("Muestra el perfil completo del miembro del staff")
          .setValue("perfil_revisar")
          .setEmoji("👤"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Estadísticas Generales")
          .setDescription("Muestra las estadísticas y calificación del miembro")
          .setValue("estadisticas_generales")
          .setEmoji("📊"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Sanciones Administrativas")
          .setDescription("Muestra el historial de sanciones del miembro")
          .setValue("sanciones_administrativas")
          .setEmoji("⚠️")
      );
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  }

  // ─── OPCIÓN: Perfil Revisar ─────────────────────────────────────────────────
  if (selected === "perfil_revisar") {
    const container = buildStaffProfileContainer(
      targetMember,
      processedCount,
      robloxName,
      hiredAt,
      client,
      totalShiftTimeMs
    );

    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // ─── OPCIÓN: Estadísticas Generales ────────────────────────────────────────
  if (selected === "estadisticas_generales") {
    const horasDisplay = formatShiftTime(totalShiftTimeMs);
    const { stars, label, score } = calcularCalificacion(
      processedCount,
      totalShiftTimeMs,
      lockups.length
    );

    const statsContent = [
      `# Estadísticas Generales`,
      `> Datos de actividad de <@${targetUserId}>`,
    ].join("\n");

    const statsFieldsContent = [
      `**Actividad:**`,
      `› 🎫 **Tickets Atendidos:** ${processedCount}`,
      `› ⏱️ **Horas en Turno:** ${horasDisplay}`,
      `› 📅 **Ingresó al Staff:** ${hiredAt ? `<t:${Math.floor(hiredAt.getTime() / 1000)}:D>` : "*Sin registro*"}`,
      ``,
      `**Calificación de Desempeño:**`,
      `› ${stars} — **${label}**`,
      `› 🔢 Puntaje: \`${score} / 100 pts\``,
      ``,
      `-# El puntaje se calcula en base a tickets atendidos, horas de turno y sanciones activas.`,
    ].join("\n");

    const container = new ContainerBuilder()
      .setAccentColor(0x3b82f6)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(statsContent)
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatar))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(statsFieldsContent)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addActionRowComponents(buildNav())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`)
      );

    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // ─── OPCIÓN: Sanciones Administrativas ─────────────────────────────
  if (selected === "sanciones_administrativas") {
    const totalSanciones = lockups.length + adminWarns.length;
    const hasAnySancion = totalSanciones > 0;
    let sancionesContent: string;

    if (!hasAnySancion) {
      sancionesContent = [
        `**Sin Faltas Administrativas**`,
        ``,
        `✅ El miembro <@${targetUserId}> no tiene ninguna sanción administrativa registrada en el sistema.`,
      ].join("\n");
    } else {
      const lines: string[] = [
        `**Resumen de Sanciones:**`,
        `› 📋 **Total general:** ${totalSanciones}`,
        `› 🔒 **Lockups:** ${lockups.length} (${activeLockup ? "🔴 1 activo" : "🟢 ninguno activo"})`,
        `› ⚠️ **Advertencias (ADW):** ${adminWarns.length} (${activeWarns.length} activas)`,
        ``,
      ];

      // ─ Lockups recientes ─────────────────────────────────────────────────
      if (lockups.length > 0) {
        lines.push(`**🔒 Lockups:**`);
        for (const lkp of lockups.slice(0, 3)) {
          const createdUnix = Math.floor(lkp.createdAt.getTime() / 1000);
          const endUnix = Math.floor(lkp.endTime.getTime() / 1000);
          const status = lkp.active ? "🔴 **ACTIVO**" : "🟢 **FINALIZADO**";
          lines.push([
            `• \`${lkp.lockupId}\` — ${status}`,
            `  › Duración: ${formatDuration(lkp.durationMs)}`,
            `  › Fecha: <t:${createdUnix}:d> — Vence: <t:${endUnix}:F>`,
            `  › Mod: <@${lkp.moderatorId}> — Motivo: ${lkp.motivo}`,
          ].join("\n"));
        }
        if (lockups.length > 3) lines.push(`*...y ${lockups.length - 3} lockup(s) más.*`);
        lines.push("");
      }

      // ─ Advertencias ADW recientes ─────────────────────────────────────
      if (adminWarns.length > 0) {
        lines.push(`**⚠️ Advertencias Administrativas:**`);
        for (const w of adminWarns.slice(0, 3)) {
          const createdUnix = Math.floor(w.createdAt.getTime() / 1000);
          const status = w.active ? "🔴 **ACTIVA**" : "🟢 **RETIRADA**";
          lines.push([
            `• \`${w.warnId}\` — ${status}`,
            `  › Fecha: <t:${createdUnix}:F>`,
            `  › Mod: <@${w.moderatorId}>`,
            `  › Falta: ${w.falta.slice(0, 80)}${w.falta.length > 80 ? "…" : ""}`,
          ].join("\n"));
        }
        if (adminWarns.length > 3) lines.push(`*...y ${adminWarns.length - 3} advertencia(s) más.*`);
      }

      sancionesContent = lines.join("\n");
    }

    const titleContent = [
      `# Sanciones Administrativas`,
      `> Registro de faltas de <@${targetUserId}>`,
    ].join("\n");

    const container = new ContainerBuilder()
      .setAccentColor(hasAnySancion ? 0xef4444 : 0x10b981)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(titleContent)
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatar))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(sancionesContent)
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addActionRowComponents(buildNav())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`)
      );

    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }
}
