import type { StringSelectMenuInteraction, UserSelectMenuInteraction, ButtonInteraction, Client, TextChannel } from "discord.js";
import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  SeparatorSpacingSize,
} from "discord.js";
import { buildErrorContainer, buildSuccessContainer } from "../utils/components.js";
import { config } from "../config.js";

// Mostrar menú para agregar/retirar usuario de un ticket
export async function showAddRemoveUserMenu(
  interaction: StringSelectMenuInteraction,
  client: Client,
  channelId: string
): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const isStaff = member?.roles.cache.has(config.staffRoleId) || member?.permissions.has("Administrator");

  if (!isStaff) {
    await interaction.reply({
      components: [buildErrorContainer("No tienes permisos de Staff para gestionar miembros en este ticket.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const userSelect = new UserSelectMenuBuilder()
    .setCustomId(`ticket:select_user_target:${channelId}`)
    .setPlaceholder("Selecciona el usuario de Discord...")
    .setMinValues(1)
    .setMaxValues(1);

  const rowSelect = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);

  const container = new ContainerBuilder()
    .setAccentColor(0x3b82f6)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# 👤 Gestión de Usuarios en Ticket\nSelecciona el usuario de Discord abajo y luego elige si deseas agregarlo o retirarlo del ticket.")
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(rowSelect);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

// Al seleccionar el usuario en UserSelectMenu
export async function handleUserSelectTarget(
  interaction: UserSelectMenuInteraction,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(":"); // ticket:select_user_target:<channelId>
  const channelId = parts[2];
  const targetUserId = interaction.values[0];

  if (!channelId || !targetUserId) return;

  const addBtn = new ButtonBuilder()
    .setCustomId(`ticket:do_add_user:${channelId}:${targetUserId}`)
    .setLabel("Agregar al Ticket")
    .setEmoji("🟢")
    .setStyle(ButtonStyle.Success);

  const removeBtn = new ButtonBuilder()
    .setCustomId(`ticket:do_remove_user:${channelId}:${targetUserId}`)
    .setLabel("Retirar del Ticket")
    .setEmoji("🔴")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(addBtn, removeBtn);

  const container = new ContainerBuilder()
    .setAccentColor(0x7c3aed)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 👤 Usuario Seleccionado: <@${targetUserId}>\n¿Qué acción deseas realizar con <@${targetUserId}> en este ticket?`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(row);

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

// Confirmar agregar usuario
export async function handleDoAddUser(
  interaction: ButtonInteraction,
  client: Client,
  channelId: string,
  targetUserId: string
): Promise<void> {
  const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  if (!channel || !channel.isTextBased()) {
    await interaction.update({
      components: [buildErrorContainer("No se encontró el canal del ticket.", client)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  await channel.permissionOverwrites.edit(targetUserId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  });

  await channel.send({
    components: [
      buildSuccessContainer(
        "Usuario Agregado",
        `<@${interaction.user.id}> ha agregado a <@${targetUserId}> a este ticket.`,
        client
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  await interaction.update({
    components: [
      buildSuccessContainer(
        "Acción Completada",
        `<@${targetUserId}> ha sido agregado exitosamente al ticket.`,
        client
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}

// Confirmar retirar usuario
export async function handleDoRemoveUser(
  interaction: ButtonInteraction,
  client: Client,
  channelId: string,
  targetUserId: string
): Promise<void> {
  const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
  if (!channel || !channel.isTextBased()) {
    await interaction.update({
      components: [buildErrorContainer("No se encontró el canal del ticket.", client)],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  await channel.permissionOverwrites.delete(targetUserId).catch(() => null);

  await channel.send({
    components: [
      buildSuccessContainer(
        "Usuario Retirado",
        `<@${interaction.user.id}> ha retirado a <@${targetUserId}> de este ticket.`,
        client
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  await interaction.update({
    components: [
      buildSuccessContainer(
        "Acción Completada",
        `<@${targetUserId}> ha sido retirado exitosamente del ticket.`,
        client
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });
}
