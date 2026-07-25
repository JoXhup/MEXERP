import type { ButtonInteraction, Client, TextChannel } from "discord.js";
import {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
  AttachmentBuilder,
} from "discord.js";
import { Ticket } from "../models/Ticket.js";
import { StaffStats, incrementStat } from "../models/StaffStats.js";
import {
  buildErrorContainer,
  buildSuccessContainer,
  buildTicketContainer,
  buildPrioritySelectContainer,
  buildLogContainer,
} from "../utils/components.js";
import { generateTranscript } from "../utils/transcript.js";
import { sendLog } from "../utils/logger.js";
import { config } from "../config.js";
import { isAdmin } from "../utils/permissions.js";
import type { TicketPriority } from "../types/index.js";

// ─── HANDLER PRINCIPAL DE BOTONES ─────────────────────────────────────────────
export async function handleButton(
  interaction: ButtonInteraction,
  client: Client,
): Promise<void> {
  const [ns, action, channelId, extra] = interaction.customId.split(":");
  if (ns !== "ticket") return;

  switch (action) {
    case "claim":      return handleClaim(interaction, client, channelId!);
    case "close":      return handleClose(interaction, client, channelId!);
    case "transcript": return handleTranscript(interaction, client, channelId!);
    case "rename":     return handleRename(interaction, client, channelId!);
    case "priority":   return handlePriorityMenu(interaction, client, channelId!);
    case "setpriority":return handleSetPriority(interaction, client, channelId!, extra as TicketPriority);
  }
}

// ─── CLAIM ────────────────────────────────────────────────────────────────────
async function handleClaim(
  interaction: ButtonInteraction,
  client: Client,
  channelId: string,
): Promise<void> {
  // Solo staff puede reclamar
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isStaff = isAdmin(member ?? null);

  if (!isStaff) {
    await interaction.reply({
      components: [buildErrorContainer("No tienes permisos de Staff para reclamar tickets.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    await interaction.reply({
      components: [buildErrorContainer("Ticket no encontrado.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (ticket.status === "closed") {
    await interaction.reply({
      components: [buildErrorContainer("Este ticket ya esta cerrado.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) {
    await interaction.reply({
      components: [buildErrorContainer(
        `Este ticket ya fue reclamado por <@${ticket.claimedBy}>.`,
        client
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Actualizar DB
  ticket.status = "claimed";
  ticket.claimedBy = interaction.user.id;
  ticket.claimedByTag = interaction.user.tag;
  ticket.claimedAt = new Date();
  await ticket.save();

  // Stats
  await incrementStat(
    interaction.guild!.id,
    interaction.user.id,
    interaction.user.tag,
    "totalClaimed",
    ticket.category,
  );

  // Actualizar mensaje del ticket
  const guildIcon = interaction.guild?.iconURL({ size: 256 }) ?? undefined;
  await interaction.update({
    components: [buildTicketContainer(ticket, client, guildIcon)],
    flags: MessageFlags.IsComponentsV2,
  });

  // Notificar en el canal
  if (interaction.channel?.isTextBased()) {
    await (interaction.channel as TextChannel).send({
      components: [
        buildSuccessContainer(
          "Ticket reclamado",
          `<@${ticket.ownerId}> — Tu ticket ha sido reclamado por <@${interaction.user.id}>. Te atendere en breve.`,
          client,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }

  await sendLog(client, "Ticket Reclamado", `Reclamado por ${interaction.user.tag}`, [
    { name: "Ticket", value: ticket.ticketId },
    { name: "Staff", value: `<@${interaction.user.id}>` },
    { name: "Usuario", value: `<@${ticket.ownerId}>` },
  ]);
}

import { buildCloseTicketModal } from "../utils/modals.js";

// ─── CLOSE ────────────────────────────────────────────────────────────────────
export async function handleClose(
  interaction: any,
  client: Client,
  channelId: string,
): Promise<void> {
  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    await interaction.reply({
      components: [buildErrorContainer("Ticket no encontrado.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  if (ticket.status === "closed") {
    await interaction.reply({
      components: [buildErrorContainer("Este ticket ya esta cerrado.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Solo staff puede cerrar
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isStaff = isAdmin(member ?? null);

  if (!isStaff) {
    await interaction.reply({
      components: [buildErrorContainer("No tienes permisos de Staff para cerrar este ticket.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Abrir modal de motivo de cierre
  await interaction.showModal(buildCloseTicketModal(channelId));
}

// ─── TRANSCRIPT ───────────────────────────────────────────────────────────────
export async function handleTranscript(
  interaction: any,
  client: Client,
  channelId: string,
): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isStaff = isAdmin(member ?? null);

  if (!isStaff) {
    await interaction.reply({
      components: [buildErrorContainer("No tienes permisos de Staff para generar la transcripción de este ticket.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket || interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.reply({
      components: [buildErrorContainer("No se pudo generar la transcripcion.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const filepath = await generateTranscript(ticket, interaction.channel, client);
    ticket.transcriptPath = filepath;
    await ticket.save();

    await incrementStat(
      interaction.guild!.id,
      interaction.user.id,
      interaction.user.tag,
      "totalTranscripts",
    );

    const attachment = new AttachmentBuilder(filepath, {
      name: `transcript-${ticket.ticketId}.html`,
    });

    await interaction.editReply({
      files: [attachment],
    });

    // Enviar al canal de transcripciones si existe
    if (config.transcriptChannelId) {
      const tchan = await client.channels.fetch(config.transcriptChannelId);
      if (tchan?.isTextBased()) {
        const att2 = new AttachmentBuilder(filepath, {
          name: `transcript-${ticket.ticketId}.html`,
        });
        await (tchan as TextChannel).send({
          content: `Transcripcion de **${ticket.ticketId}** — ${ticket.category} | <@${ticket.ownerId}>`,
          files: [att2],
        });
      }
    }

    await sendLog(client, "Transcripcion Generada", `Por ${interaction.user.tag}`, [
      { name: "Ticket", value: ticket.ticketId },
      { name: "Staff", value: `<@${interaction.user.id}>` },
    ]);
  } catch (err) {
    console.error("[TRANSCRIPT] Error:", err);
    await interaction.editReply({
      components: [buildErrorContainer("Error al generar la transcripcion.", client)],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

// ─── RENAME ───────────────────────────────────────────────────────────────────
async function handleRename(
  interaction: ButtonInteraction,
  client: Client,
  channelId: string,
): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isStaff = isAdmin(member ?? null);

  if (!isStaff) {
    await interaction.reply({
      components: [buildErrorContainer("Solo el staff puede renombrar tickets.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const renameInput = new TextInputBuilder()
    .setCustomId("new_name")
    .setLabel("Nuevo nombre del ticket")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Escribe el nuevo titulo...")
    .setMinLength(3)
    .setMaxLength(80)
    .setRequired(true);

  const renameRow = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(renameInput);

  const modal = new ModalBuilder()
    .setCustomId(`ticket:renamemodal:${channelId}`)
    .setTitle("Renombrar Ticket");

  modal.addActionRowComponents(renameRow);

  await interaction.showModal(modal);
}

// ─── PRIORITY MENU ────────────────────────────────────────────────────────────
async function handlePriorityMenu(
  interaction: ButtonInteraction,
  client: Client,
  channelId: string,
): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isStaff = isAdmin(member ?? null);

  if (!isStaff) {
    await interaction.reply({
      components: [buildErrorContainer("Solo el staff puede cambiar la prioridad.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    components: [buildPrioritySelectContainer(channelId, client)],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

// ─── SET PRIORITY ─────────────────────────────────────────────────────────────
async function handleSetPriority(
  interaction: ButtonInteraction,
  client: Client,
  channelId: string,
  priority: TicketPriority,
): Promise<void> {
  const validPriorities: TicketPriority[] = ["low", "medium", "high", "critical"];
  if (!validPriorities.includes(priority)) return;

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    await interaction.update({
      components: [buildErrorContainer("Ticket no encontrado.", client)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  ticket.priority = priority;
  await ticket.save();

  await interaction.update({
    components: [buildSuccessContainer(
      "Prioridad actualizada",
      `La prioridad del ticket ahora es **${priority}**.`,
      client
    )],
    flags: MessageFlags.IsComponentsV2,
  });

  await sendLog(client, "Prioridad Cambiada", `Por ${interaction.user.tag}`, [
    { name: "Ticket", value: ticket.ticketId },
    { name: "Nueva prioridad", value: priority },
    { name: "Staff", value: `<@${interaction.user.id}>` },
  ]);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export function getDuration(from: Date): string {
  const ms = Date.now() - from.getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
