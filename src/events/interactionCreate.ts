import type { Client, Interaction } from "discord.js";
import { InteractionType } from "discord.js";
import { handleAperturaButton } from "../handlers/aperturasHandler.js";
import { handleButton } from "../handlers/buttonHandler.js";
import { handleDespedirButton } from "../handlers/despedirHandler.js";
import { handleJornadaButton } from "../handlers/jornadaHandler.js";
import { handleModalSubmit } from "../handlers/modalHandler.js";
import { handleSecondaryModals } from "../handlers/secondaryModalHandler.js";
import { handleSelectCategory, handleTicketManagementSelect } from "../handlers/selectMenuHandler.js";
import {
  handleVerificationStart,
  handleVerificationRetry,
  handleVerificationConfirm,
  handleVerificationModal,
} from "../handlers/verificationHandler.js";
import { handleIneModalSubmit } from "../handlers/ineHandler.js";

export const name = "interactionCreate";
export const once = false;

export async function execute(interaction: Interaction, client: Client): Promise<void> {
  try {
    // ─── COMANDOS SLASH ─────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[INTERACTION] Comando no encontrado: ${interaction.commandName}`);
        return;
      }
      await command.execute(interaction, client);
      return;
    }

    // ─── BOTONES ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Aperturas de servidor
      if (id.startsWith("apertura:")) {
        await handleAperturaButton(interaction, client);
        return;
      }

      // Jornadas staff
      if (id.startsWith("jornada:")) {
        await handleJornadaButton(interaction, client);
        return;
      }

      // Despido de staff
      if (id.startsWith("despedir:")) {
        await handleDespedirButton(interaction, client);
        return;
      }

      // Verificacion
      if (id === "verification:start") {
        await handleVerificationStart(interaction);
        return;
      }
      if (id === "verification:retry") {
        await handleVerificationRetry(interaction);
        return;
      }
      if (id.startsWith("verification:confirm:")) {
        await handleVerificationConfirm(interaction, client);
        return;
      }

      // Tickets
      await handleButton(interaction, client);
      return;
    }

    // ─── MODALES ────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // Modal de INE
      if (id === "ine:modal") {
        await handleIneModalSubmit(interaction, client);
        return;
      }

      // Modal de verificacion
      if (id === "verification:modal") {
        await handleVerificationModal(interaction, client);
        return;
      }

      // Modal de categoria (creacion de ticket)
      if (id.startsWith("ticket:modal:")) {
        await handleModalSubmit(interaction, client);
        return;
      }

      // Modales secundarios (rename, close, etc.)
      if (id.startsWith("ticket:renamemodal:") || id.startsWith("ticket:closemodal:")) {
        await handleSecondaryModals(interaction, client);
        return;
      }
      return;
    }

    // ─── SELECT MENUS ───────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;

      if (id === "ticket:select_category") {
        await handleSelectCategory(interaction, client);
        return;
      }

      if (id.startsWith("ticket:management:")) {
        await handleTicketManagementSelect(interaction, client);
        return;
      }
    }

  } catch (err: any) {
    // 10062 = Unknown Interaction — ocurre cuando alguien pulsa un boton de
    // un mensaje de una sesion anterior del bot (token expirado). Es inofensivo.
    if (err?.code === 10062) return;

    console.error("[INTERACTION] Error no manejado:", err);

    // Intentar responder con error si no se ha respondido aun
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Ocurrio un error procesando tu solicitud.",
          flags: 64, // Ephemeral
        });
      }
    } catch {
      // Silenciar error de respuesta
    }
  }
}
