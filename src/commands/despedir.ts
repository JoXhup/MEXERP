import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";
import { StaffStats } from "../models/StaffStats.js";
import type { Command } from "../types/index.js";

const MANAGER_ROLE = "1531426497942781972";
const STAFF_PERM_ROLE = "1531825255889506506";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("despedir")
    .setDescription("Comandos de despido de personal administrativo.")
    .addSubcommand(sub =>
      sub
        .setName("staff")
        .setDescription("Despide a un miembro del equipo staff.")
        .addUserOption(opt =>
          opt
            .setName("usuario")
            .setDescription("Usuario del staff a despedir")
            .setRequired(true)
        )
    )
    .toJSON(),

  adminOnly: false,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const executorMember = interaction.guild?.members.cache.get(interaction.user.id);
      const isManager = executorMember?.roles.cache.has(MANAGER_ROLE) ||
        executorMember?.permissions.has(PermissionFlagsBits.Administrator);

      if (!isManager) {
        const noPermEmbed = new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle("Sin Permisos")
          .setDescription("No tienes los permisos requeridos para usar este comando.");

        await interaction.editReply({ embeds: [noPermEmbed] });
        return;
      }

      const targetUser = interaction.options.getUser("usuario", true);
      let targetMember = interaction.guild?.members.cache.get(targetUser.id);

      if (!targetMember && interaction.guild) {
        try {
          targetMember = await interaction.guild.members.fetch(targetUser.id);
        } catch {
          /* ok */
        }
      }

      if (!targetMember) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xef4444)
          .setDescription("No se encontro al usuario en este servidor.");

        await interaction.editReply({ embeds: [errorEmbed] });
        return;
      }

      // Verificar si es staff o tiene contratacion
      const staffStats = await StaffStats.findOne({
        guildId: interaction.guildId!,
        userId: targetUser.id,
      });

      const hasStaffRole = targetMember.roles.cache.has(STAFF_PERM_ROLE);
      const isStaffMember = Boolean(staffStats?.hiredAt) || hasStaffRole;

      if (!isStaffMember) {
        const notStaffEmbed = new EmbedBuilder()
          .setColor(0xef4444)
          .setDescription("Este usuario ya fue despedido o no tiene roles admin.");

        await interaction.editReply({ embeds: [notStaffEmbed] });
        return;
      }

      // Rango mas alto display
      const highestRole = targetMember.roles.highest.id !== interaction.guildId
        ? `<@&${targetMember.roles.highest.id}>`
        : "Sin rol";

      const confirmEmbed = new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle("⚠️ Confirmación de Despido")
        .setDescription(
          [
            `¿Estás seguro de realizar esta acción?`,
            ``,
            `**Staff:** <@${targetUser.id}> **(@${targetUser.username})**`,
            `**Rango actual:** ${highestRole}`,
            ``,
            `*Al confirmar se eliminará su perfil administrativo, incluyendo sanciones, horas y fecha de contratación, y se revocarán todos sus roles de staff.*`,
          ].join("\n")
        );

      const confirmBtn = new ButtonBuilder()
        .setCustomId(`despedir:confirm:${targetUser.id}:${interaction.user.id}`)
        .setLabel("Confirmar Despido")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("⚠️");

      const cancelBtn = new ButtonBuilder()
        .setCustomId(`despedir:cancel:${targetUser.id}:${interaction.user.id}`)
        .setLabel("Cancelar")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("✖️");

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row],
      });
    } catch (err) {
      console.error("[DESPEDIR] Error general:", err);
      const errEmbed = new EmbedBuilder()
        .setColor(0xef4444)
        .setDescription("Error al procesar la solicitud de despido.");

      await interaction.editReply({ embeds: [errEmbed] });
    }
  },
};

export default command;
