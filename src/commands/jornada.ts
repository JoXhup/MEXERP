import type { ChatInputCommandInteraction, Client } from "discord.js";
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
import { formatShiftTime } from "../utils/components.js";

const ADMIN_ROLE_ID = "1531426497942781972";

/** Parseador de cadenas de tiempo (ej. 10s, 15m, 2h, 1h 30m) */
export function parseTimeString(input: string): number | null {
  if (!input || typeof input !== "string") return null;
  const clean = input.trim().toLowerCase();

  const regex = /(\d+)\s*([smh])/g;
  let match: RegExpExecArray | null;
  let totalMs = 0;
  let foundMatches = 0;

  while ((match = regex.exec(clean)) !== null) {
    foundMatches++;
    const value = parseInt(match[1]!, 10);
    const unit = match[2];

    if (isNaN(value) || value <= 0) return null;

    if (unit === "s") totalMs += value * 1000;
    else if (unit === "m") totalMs += value * 60 * 1000;
    else if (unit === "h") totalMs += value * 3600 * 1000;
  }

  if (foundMatches === 0 || totalMs <= 0) return null;
  return totalMs;
}

export const data = new SlashCommandBuilder()
  .setName("jornada")
  .setDescription("Comandos administrativos para la gestión de jornadas staff.")
  .setDMPermission(false)
  .addSubcommand(sub =>
    sub
      .setName("aumentar")
      .setDescription("Aumenta el tiempo de jornada acumulado a un miembro del staff.")
      .addUserOption(opt =>
        opt
          .setName("usuario")
          .setDescription("El usuario staff al que se le aumentará el tiempo.")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName("tiempo")
          .setDescription("Cantidad de tiempo (ej. 10s, 15m, 2h, 1h 30m).")
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName("reducir")
      .setDescription("Reduce el tiempo de jornada acumulado a un miembro del staff.")
      .addUserOption(opt =>
        opt
          .setName("usuario")
          .setDescription("El usuario staff al que se le reducirá el tiempo.")
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName("tiempo")
          .setDescription("Cantidad de tiempo (ej. 10s, 15m, 2h, 1h 30m).")
          .setRequired(true)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  const guild = interaction.guild;
  const member = guild?.members.cache.get(interaction.user.id);
  const canUse =
    member?.roles.cache.has(ADMIN_ROLE_ID) ||
    member?.permissions.has(PermissionFlagsBits.Administrator);

  if (!canUse) {
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xef4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# ❌ Sin Permisos")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "No cuentas con el rol necesario (`1531426497942781972`) o permisos administrativos para usar este comando."
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora RP Staff")
      );

    await interaction.reply({
      // @ts-ignore — Components V2
      components: [errorContainer],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser("usuario", true);
  const timeInput = interaction.options.getString("tiempo", true);

  const parsedMs = parseTimeString(timeInput);
  if (!parsedMs) {
    const invalidContainer = new ContainerBuilder()
      .setAccentColor(0xef4444)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# ❌ Formato de Tiempo Inválido")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `El tiempo especificado (\`${timeInput}\`) no es válido.`,
            ``,
            `**Formato correcto:**`,
            `• \`s\` = Segundos (ej. \`30s\`)`,
            `• \`m\` = Minutos (ej. \`15m\`)`,
            `• \`h\` = Horas (ej. \`2h\` o \`1h 30m\`)`,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora RP Staff")
      );

    await interaction.reply({
      // @ts-ignore — Components V2
      components: [invalidContainer],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  const userTag = targetUser.tag;

  // Buscar o inicializar stats del usuario
  let staffStats = await StaffStats.findOne({
    guildId: interaction.guildId!,
    userId: targetUser.id,
  });

  const currentMs = staffStats?.totalShiftTimeMs || 0;

  if (subcommand === "aumentar") {
    const newTotalMs = currentMs + parsedMs;

    if (!staffStats) {
      staffStats = new StaffStats({
        guildId: interaction.guildId!,
        userId: targetUser.id,
        userTag,
        totalShiftTimeMs: newTotalMs,
      });
    } else {
      staffStats.totalShiftTimeMs = newTotalMs;
    }
    await staffStats.save();

    const greenContainer = new ContainerBuilder()
      .setAccentColor(0x10b981) // Verde
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# 🟢 Tiempo de Jornada Aumentado")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**👤 Staff:**  <@${targetUser.id}> (@${targetUser.username})`,
            `**🛡️ Administrador:**  <@${interaction.user.id}> (@${interaction.user.username})`,
            ``,
            `**⏱️ Tiempo Añadido:**  \`+${formatShiftTime(parsedMs)}\``,
            `**📊 Nuevo Total Acumulado:**  \`${formatShiftTime(newTotalMs)}\``,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora RP Staff")
      );

    await interaction.reply({
      // @ts-ignore — Components V2
      components: [greenContainer],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  if (subcommand === "reducir") {
    if (parsedMs > currentMs) {
      const redErrorContainer = new ContainerBuilder()
        .setAccentColor(0xef4444) // Rojo
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# ❌ Error al Reducir Tiempo")
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              `No es posible reducir **${formatShiftTime(parsedMs)}** a <@${targetUser.id}>.`,
              ``,
              `**Tiempo solicitado a reducir:** \`${formatShiftTime(parsedMs)}\``,
              `**Tiempo total que posee el usuario:** \`${formatShiftTime(currentMs)}\``,
              ``,
              `*El valor a reducir supera el tiempo acumulado registrado.*`,
            ].join("\n")
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("-# Sonora RP Staff")
        );

      await interaction.reply({
        // @ts-ignore — Components V2
        components: [redErrorContainer],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      return;
    }

    const newTotalMs = currentMs - parsedMs;
    staffStats!.totalShiftTimeMs = newTotalMs;
    await staffStats!.save();

    const redContainer = new ContainerBuilder()
      .setAccentColor(0xef4444) // Rojo
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# 🔴 Tiempo de Jornada Reducido")
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `**👤 Staff:**  <@${targetUser.id}> (@${targetUser.username})`,
            `**🛡️ Administrador:**  <@${interaction.user.id}> (@${interaction.user.username})`,
            ``,
            `**⏱️ Tiempo Reducido:**  \`-${formatShiftTime(parsedMs)}\``,
            `**📊 Nuevo Total Acumulado:**  \`${formatShiftTime(newTotalMs)}\``,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("-# Sonora RP Staff")
      );

    await interaction.reply({
      // @ts-ignore — Components V2
      components: [redContainer],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }
}
