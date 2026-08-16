import type { Collection } from "discord.js";

// ─── CATEGORIAS DE TICKETS ─────────────────────────────────────────────────────
export type TicketCategory =
  | "reportar_usuario"
  | "solicitud_ck"
  | "solicitud_rp"
  | "retiro_rol"
  | "reporte_staff"
  | "retiro_sanciones"
  | "soporte"
  | "recompensas"
  | "area_rol"
  | "robos_ic"
  | "tienda"
  | "beneficios"
  | "solicitud_promo"
  | "alianza"
  | "propuesta_evento"
  | "otros"
  | "reporte_desarrollo";

// ─── PRIORIDADES ───────────────────────────────────────────────────────────────
export type TicketPriority = "low" | "medium" | "high" | "critical";

// ─── ESTADO DE TICKETS ─────────────────────────────────────────────────────────
export type TicketStatus = "open" | "claimed" | "closed";

// ─── INTERFAZ CATEGORIA ────────────────────────────────────────────────────────
export interface CategoryMeta {
  id: TicketCategory;
  label: string;
  description: string;
  emoji: string;
  modalTitle: string;
  fields: ModalField[];
  channelPrefix: string;
  pingRoleIds: string[];
}

export interface ModalField {
  customId: string;
  label: string;
  description?: string;       // Aparece bajo el label en el modal v2
  style: "short" | "paragraph";
  placeholder?: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
}

// ─── DATOS DEL TICKET ──────────────────────────────────────────────────────────
export interface TicketData {
  ticketId: string;
  channelId: string;
  guildId: string;
  ownerId: string;
  ownerTag: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  claimedBy?: string;
  claimedAt?: Date;
  openedAt: Date;
  closedAt?: Date;
  modalData: Record<string, string>;
  number: number;
  renamedTitle?: string;
  participants: string[];
  messageCount: number;
}

// ─── EXTENSION DEL CLIENTE ─────────────────────────────────────────────────────
declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
  }
}

export interface Command {
  data:
    | import("discord.js").SlashCommandBuilder
    | import("discord.js").SlashCommandOptionsOnlyBuilder
    | import("discord.js").SlashCommandSubcommandsOnlyBuilder
    | import("discord.js").RESTPostAPIChatInputApplicationCommandsJSONBody
    | any;
  execute: (interaction: import("discord.js").ChatInputCommandInteraction, client?: import("discord.js").Client) => Promise<void>;
  autocomplete?: (interaction: import("discord.js").AutocompleteInteraction) => Promise<void>;
  adminOnly?: boolean;
}
