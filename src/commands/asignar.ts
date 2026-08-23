import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  type Client,
  PermissionFlagsBits,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
} from "discord.js";
import type { Command } from "../types/index.js";
import { isAdmin } from "../utils/permissions.js";
import { getFooterTimestamp } from "../utils/components.js";
import { Ine } from "../models/Ine.js";
import { VerifiedUser } from "../models/VerifiedUser.js";

const TARGET_ROLE_ID = "1528974924805312562";

const data = new SlashCommandBuilder()
  .setName("asignar")
  .setDescription("Comando administrativo para restablecimiento masivo de miembros.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("all")
      .setDescription(
        "Restablece roles y apodos (excepto Owner) y borra los registros de INE."
      )
  );

const command: Command = {
  data,
  adminOnly: true,
  async execute(interaction: ChatInputCommandInteraction, client?: Client): Promise<void> {
    const cl = client ?? interaction.client;
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const isOwner = interaction.guild?.ownerId === interaction.user.id;

    if (!isOwner && !isAdmin(member)) {
      await interaction.reply({
        content: "❌ No tienes permisos de administrador para ejecutar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "❌ Este comando solo puede ejecutarse en un servidor.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const ownerId = guild.ownerId;
    const targetRole = guild.roles.cache.get(TARGET_ROLE_ID);

    if (!targetRole) {
      await interaction.editReply({
        content: `❌ El rol objetivo (<@&${TARGET_ROLE_ID}>) no existe en este servidor.`,
      });
      return;
    }

    // 1. Obtener todos los miembros del servidor
    const allMembers = await guild.members.fetch();
    let updatedCount = 0;
    let failedCount = 0;
    let skippedBots = 0;

    for (const [, targetMember] of allMembers) {
      // Omitir al Owner del servidor
      if (targetMember.id === ownerId) {
        continue;
      }

      // Omitir bots de integración para evitar errores de roles manejados
      if (targetMember.user.bot) {
        skippedBots++;
        continue;
      }

      try {
        // Quitar todos los roles y asignar únicamente el rol objetivo
        await targetMember.roles.set([TARGET_ROLE_ID]);

        // Restablecer apodo personalizado si tiene uno
        if (targetMember.nickname) {
          await targetMember.setNickname(null);
        }

        updatedCount++;
        // Pequeña pausa para respetar rate limits de Discord
        await new Promise((resolve) => setTimeout(resolve, 60));
      } catch (err) {
        console.error(`[ASIGNAR_ALL] Error con usuario ${targetMember.user.tag} (${targetMember.id}):`, err);
        failedCount++;
      }
    }

    // 2. Eliminar todos los registros de INE y VerifiedUser de la base de datos
    const inesDeleted = await Ine.deleteMany({});
    const verifiedDeleted = await VerifiedUser.deleteMany({});

    // 3. Crear contenedor de resultado
    const guildIcon = guild.iconURL({ size: 256 }) ?? cl.user?.displayAvatarURL({ size: 256 }) ?? "";

    const summaryText = [
      `### ⚡ Restablecimiento Masivo Ejecutado`,
      `El servidor ha sido restablecido a su estado inicial para todos los miembros.`,
      ``,
      `* **Rol Asignado:** <@&${TARGET_ROLE_ID}>`,
      `* **Owner Protegido:** <@${ownerId}> *(Sin modificaciones)*`,
      `* **Miembros Restablecidos:** \`${updatedCount}\``,
      failedCount > 0 ? `* **Errores / Jerarquía:** \`${failedCount}\`` : `* **Errores:** \`0\``,
      `* **Bots Omitidos:** \`${skippedBots}\``,
      ``,
      `### 🗄️ Base de Datos Limpia`,
      `* **Registros de INE Eliminados:** \`${inesDeleted.deletedCount}\``,
      `* **Registros de Verificación Eliminados:** \`${verifiedDeleted.deletedCount}\``,
      `* **Apodos Reiniciados:** A todos los miembros se les removió el apodo personalizado.`,
    ].join("\n");

    const container = new ContainerBuilder()
      .setAccentColor(0x57f287) // Verde Discord
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(summaryText)
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIcon))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`)
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};

export default command;
