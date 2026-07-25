import type { Guild, TextChannel, Client } from "discord.js";
import {
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  AttachmentBuilder,
} from "discord.js";
import { config } from "../config.js";
import { Ticket, getNextTicketNumber, formatTicketId } from "../models/Ticket.js";
import type { ITicket } from "../models/Ticket.js";
import type { TicketCategory } from "../types/index.js";
import { CATEGORIES } from "../constants/categories.js";
import { buildTicketContainer } from "./components.js";

/**
 * Crea el canal de ticket, guarda en DB y envia el mensaje inicial.
 */
export async function createTicketChannel(
  guild: Guild,
  ownerId: string,
  ownerTag: string,
  category: TicketCategory,
  modalData: Record<string, string>,
  client: Client,
): Promise<TextChannel> {
  const cat = CATEGORIES[category]!;
  const num = await getNextTicketNumber(guild.id);
  const ticketId = formatTicketId(num);
  const channelName = `${cat.channelPrefix}-${String(num).padStart(4, "0")}`;

  // Permisos: Everyone -> Deny, Owner -> Allow, Admins/Staff -> Allow
  const adminRoleIds = config.adminRoleIds ?? [];
  const validAdminOverwrites = adminRoleIds
    .filter(roleId => guild.roles.cache.has(roleId))
    .map(roleId => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    }));

  const permissionOverwrites = [
    {
      id: guild.id, // @everyone -> NO PUEDE VER EL CANAL
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: ownerId, // Usuario creador del ticket -> PUEDE VER
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: client.user!.id, // Bot MEXERP -> PUEDE VER Y GESTIONAR
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    },
    ...validAdminOverwrites,
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.categoryId,
    permissionOverwrites,
    topic: `Ticket ${ticketId} | ${cat.label} | ${ownerTag}`,
    reason: `Ticket de ${ownerTag} — ${cat.label}`,
  }) as TextChannel;

  // Descargar imágenes de modalData (si son URLs efímeras de Discord) y convertirlas a attachments locales
  const attachments: AttachmentBuilder[] = [];
  const updatedModalData: Record<string, string> = { ...modalData };

  for (const [key, value] of Object.entries(modalData)) {
    if (!value) continue;
    const lines = value.split("\n").map(l => l.trim()).filter(Boolean);
    const updatedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("http://") || line.startsWith("https://")) {
        try {
          const res: any = await fetch(line);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const cleanUrl = line.split("?")[0]!;
            const ext = cleanUrl.includes(".") ? cleanUrl.split(".").pop() : "png";
            const filename = `prueba_${i + 1}.${ext || "png"}`;

            attachments.push(new AttachmentBuilder(buffer, { name: filename }));
            updatedLines.push(`attachment://${filename}`);
            console.log(`[TICKET_HELPER] Descargado adjunto efímero -> attachment://${filename}`);
            continue;
          }
        } catch (err) {
          console.error("[TICKET_HELPER] Error descargando adjunto:", err);
        }
      }
      updatedLines.push(line);
    }
    updatedModalData[key] = updatedLines.join("\n");
  }

  // Guardar en DB
  const ticket = await Ticket.create({
    ticketId,
    number: num,
    channelId: channel.id,
    guildId: guild.id,
    ownerId,
    ownerTag,
    category,
    priority: "low",
    status: "open",
    openedAt: new Date(),
    modalData: new Map(Object.entries(updatedModalData)),
    participants: [ownerId],
    messageCount: 0,
  });

  // Enviar mensaje inicial en el canal (con attachments para MediaGallery en components v2)
  const guildIcon = guild.iconURL({ size: 256 }) ?? undefined;
  const container = buildTicketContainer(ticket, client, guildIcon);

  await channel.send({
    components: [container],
    files: attachments,
    flags: MessageFlags.IsComponentsV2,
  });

  return channel;
}

/**
 * Obtiene el ticket por channelId.
 */
export async function getTicketByChannel(channelId: string): Promise<ITicket | null> {
  return Ticket.findOne({ channelId });
}

/**
 * Cuenta los tickets abiertos de un usuario en el servidor.
 */
export async function countOpenTickets(guildId: string, ownerId: string): Promise<number> {
  return Ticket.countDocuments({
    guildId,
    ownerId,
    status: { $in: ["open", "claimed"] },
  });
}
