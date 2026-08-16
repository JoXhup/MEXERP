import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
  Client,
  TextChannel,
} from "discord.js";
import {
  MessageFlags,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import type { ITicket } from "../models/Ticket.js";
import { addStaffRating } from "../models/StaffStats.js";
import { buildErrorContainer, buildSuccessContainer, getFooterTimestamp } from "../utils/components.js";
import { config } from "../config.js";

export const RATING_LOG_CHANNEL_ID = "1528981341461544970";

// Set para evitar calificaciones duplicadas en memoria por ticket
const ratedTicketsSet = new Set<string>();

/**
 * Envía la invitación de calificación de Staff al creador del ticket vía DM (o canal).
 */
export async function sendTicketRatingRequest(
  client: Client,
  ticket: ITicket,
): Promise<void> {
  if (!ticket.claimedBy) return;

  const ownerUser = await client.users.fetch(ticket.ownerId).catch(() => null);
  if (!ownerUser) return;

  const staffUser = await client.users.fetch(ticket.claimedBy).catch(() => null);
  const staffTag = staffUser?.tag ?? "Staff";

  const ratingContainer = new ContainerBuilder()
    .setAccentColor(0xf59e0b) // Color Dorado
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### ⭐ CALIFICA LA ATENCIÓN RECIBIDA\n**Ticket:** \`${ticket.ticketId.toUpperCase()}\``
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(
            staffUser?.displayAvatarURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? ""
          )
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Hola <@${ticket.ownerId}>, tu ticket **${ticket.ticketId.toUpperCase()}** ha sido cerrado.\n` +
        `El miembro del staff <@${ticket.claimedBy}> (\`${staffTag}\`) estuvo a cargo de tu atención.\n\n` +
        `Por favor, presiona el botón a continuación para evaluar la atención del Staff.`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:rate_btn:${ticket.ticketId}:${ticket.claimedBy}`)
          .setLabel("Calificar Staff")
          .setStyle(ButtonStyle.Success)
          .setEmoji("⭐")
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`)
    );

  // Intentar enviar mensaje directo (DM)
  await ownerUser
    .send({
      components: [ratingContainer],
      flags: MessageFlags.IsComponentsV2,
    })
    .catch((err) => {
      console.warn(`[RATING] No se pudo enviar DM a ${ownerUser.id}:`, err);
    });
}

/**
 * Handler cuando se presiona el botón verde "Calificar Staff".
 * Despliega un StringSelectMenu efímero de 1 a 5 estrellas.
 */
export async function handleRatingButtonClick(
  interaction: ButtonInteraction,
  client: Client,
): Promise<void> {
  const parts = interaction.customId.split(":");
  const ticketId = parts[2];
  const staffUserId = parts[3];

  if (!ticketId || !staffUserId) return;

  if (ratedTicketsSet.has(ticketId)) {
    await interaction.reply({
      components: [
        buildErrorContainer("Ya has calificado la atención de este ticket. ¡Gracias!", client),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const staffUser = await client.users.fetch(staffUserId).catch(() => null);
  const staffName = staffUser ? `<@${staffUser.id}> (${staffUser.tag})` : `<@${staffUserId}>`;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket:rate_select:${ticketId}:${staffUserId}`)
    .setPlaceholder("⭐ Selecciona de 1 a 5 estrellas...")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("⭐ 1 Estrella")
        .setDescription("Mal servicio / Atención insatisfactoria")
        .setValue("1"),
      new StringSelectMenuOptionBuilder()
        .setLabel("⭐⭐ 2 Estrellas")
        .setDescription("Servicio regular / Podría mejorar")
        .setValue("2"),
      new StringSelectMenuOptionBuilder()
        .setLabel("⭐⭐⭐ 3 Estrellas")
        .setDescription("Buen servicio / Atención adecuada")
        .setValue("3"),
      new StringSelectMenuOptionBuilder()
        .setLabel("⭐⭐⭐⭐ 4 Estrellas")
        .setDescription("Excelente servicio / Muy buena atención")
        .setValue("4"),
      new StringSelectMenuOptionBuilder()
        .setLabel("⭐⭐⭐⭐⭐ 5 Estrellas")
        .setDescription("Servicio insuperable / Excelente trato")
        .setValue("5"),
    );

  const selectContainer = new ContainerBuilder()
    .setAccentColor(0xf59e0b)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `### ⭐ EVALUACIÓN DE ATENCIÓN STAFF\n` +
            `Estás evaluando a: ${staffName}\n` +
            `Ticket: \`${ticketId.toUpperCase()}\``
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(
            staffUser?.displayAvatarURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? ""
          )
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Selecciona cuántas estrellas merece la atención que recibiste:\n` +
        `-# Sonora RP System · ${getFooterTimestamp()}`
      )
    );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    components: [selectContainer, selectRow],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/**
 * Handler cuando el usuario selecciona la cantidad de estrellas (1-5).
 * Guarda en MongoDB, publica en el canal de logs 1528981341461544970 y confirma.
 */
export async function handleRatingSelectMenu(
  interaction: StringSelectMenuInteraction,
  client: Client,
): Promise<void> {
  const parts = interaction.customId.split(":");
  const ticketId = parts[2];
  const staffUserId = parts[3];

  if (!ticketId || !staffUserId) return;

  const stars = parseInt(interaction.values[0] || "5", 10);
  const starsDisplay = "⭐".repeat(stars);

  await interaction.deferUpdate();

  ratedTicketsSet.add(ticketId);

  const staffUser = await client.users.fetch(staffUserId).catch(() => null);
  const staffTag = staffUser?.tag ?? "Staff";

  // 1. Guardar en MongoDB (StaffStats)
  const guildId = interaction.guildId ?? config.guildId;
  const { newAverage, totalRatings } = await addStaffRating(
    guildId,
    staffUserId,
    staffTag,
    stars,
  );

  // 2. Publicar en Canal de Logs 1528981341461544970
  const logChannel = client.channels.cache.get(RATING_LOG_CHANNEL_ID) as TextChannel | undefined;
  if (logChannel) {
    const logContainer = new ContainerBuilder()
      .setAccentColor(0xf59e0b) // Dorado
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### ⭐ NUEVA CALIFICACIÓN DE STAFF")
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              staffUser?.displayAvatarURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? ""
            )
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `• **Staff Calificado:** <@${staffUserId}> (\`${staffTag}\`)\n` +
          `• **Calificado Por:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n` +
          `• **Ticket ID:** \`${ticketId.toUpperCase()}\`\n` +
          `• **Calificación Otorgada:** ${starsDisplay} (\`${stars}/5\`)\n` +
          `• **Promedio del Staff:** \`⭐ ${newAverage.toFixed(1)} / 5.0\` (\`${totalRatings}\` evaluaciones)\n` +
          `• **Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora RP System · Registro de Calificación Staff`)
      );

    await logChannel
      .send({
        components: [logContainer],
        flags: MessageFlags.IsComponentsV2,
      })
      .catch((err) => console.error(`[RATING LOG] Error enviando a ${RATING_LOG_CHANNEL_ID}:`, err));
  }

  // 3. Responder al usuario
  const successContainer = buildSuccessContainer(
    "¡Gracias por tu evaluación!",
    `Has calificado la atención de <@${staffUserId}> con **${starsDisplay} (${stars}/5)**.\n` +
    `Tu opinión ayuda a mejorar la calidad del servicio del Staff de Sonora RP.`,
    client,
  );

  await interaction.editReply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
