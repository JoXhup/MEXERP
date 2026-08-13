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
import { handleIneModalSubmit, handleIneDeleteButton } from "../handlers/ineHandler.js";
import { handleArrestarModalSubmit, handleCpButton } from "../handlers/arrestHandler.js";
import {
  handlePayFineButton,
  handleLookupModalButton,
  handleLookupModalSubmit,
  handleMyActiveFinesButton,
  handleMultarModalSubmit,
} from "../handlers/fineHandler.js";
import {
  handleTryoutMainMenu,
  handleTryoutDeleteSelect,
  handleTryoutModalSubmit,
} from "../handlers/tryoutHandler.js";
import { handleNarcoModalSubmit } from "../handlers/narcoHandler.js";
import {
  handleSubirSelectCategory,
  handleSubirModal1Submit,
  handleSubirModal2Submit,
  handleSubirJefeSelect,
  handleSubirSubjefeSelect,
  handleSubirPublishButton,
} from "../handlers/subirHandler.js";
import {
  handleLockupModalSubmit,
  handleLockupRetirarButton,
} from "../handlers/lockupHandler.js";

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

    // ─── AUTOCOMPLETE ───────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === "function") {
        await command.autocomplete(interaction);
      }
      return;
    }

    // ─── BOTONES ────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Multas
      if (id.startsWith("fine:pay:")) {
        await handlePayFineButton(interaction, client);
        return;
      }
      if (id === "fine:lookup_modal") {
        await handleLookupModalButton(interaction);
        return;
      }
      if (id === "fine:my_active" || id.startsWith("fine:user_active:")) {
        await handleMyActiveFinesButton(interaction);
        return;
      }

      // Eliminación de INE
      if (id.startsWith("ine:delete:")) {
        await handleIneDeleteButton(interaction, client);
        return;
      }

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

      // Cadena perpetua (aceptar/rechazar)
      if (id.startsWith("arrest:cp:")) {
        await handleCpButton(interaction, client);
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

      // Botón Publicar — Subir Institución (fallback)
      if (id.startsWith("subir:publish:")) {
        await handleSubirPublishButton(interaction, client);
        return;
      }

      // Botones de Lockup
      if (id.startsWith("lockup:retirar:")) {
        await handleLockupRetirarButton(interaction, client);
        return;
      }

      // Tickets
      await handleButton(interaction, client);
      return;
    }

    // ─── MODALES ────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // Modal de Lockup Enviar
      if (id === "lockup:modal_enviar") {
        await handleLockupModalSubmit(interaction, client);
        return;
      }

      // Modal de expedición de multa
      if (id === "multar:modal") {
        await handleMultarModalSubmit(interaction, client);
        return;
      }

      // Modal de consulta de multa
      if (id === "fine:modal_lookup") {
        await handleLookupModalSubmit(interaction);
        return;
      }

      // Modal de Arresto
      if (id === "arrestar:modal") {
        await handleArrestarModalSubmit(interaction, client);
        return;
      }

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

      // Modales de Tryout IA
      if (id.startsWith("tryout:modal_")) {
        await handleTryoutModalSubmit(interaction);
        return;
      }

      // Modal Narco Post
      if (id === "narco:modal_submit") {
        await handleNarcoModalSubmit(interaction, client);
        return;
      }

      // Modal Subir Institución — Paso 1 (datos base + abre Modal 2)
      if (id.startsWith("subir:modal1:")) {
        await handleSubirModal1Submit(interaction, client);
        return;
      }

      // Modal Subir Institución — Paso 2 (Jefe / Sub Jefe UserSelects)
      if (id.startsWith("subir:modal2:")) {
        await handleSubirModal2Submit(interaction, client);
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

      // Select Menus de Tryout IA
      if (id === "tryout:main_menu") {
        await handleTryoutMainMenu(interaction);
        return;
      }

      if (id === "tryout:delete_select") {
        await handleTryoutDeleteSelect(interaction);
        return;
      }

      // Select menú Subir Institución — categoría (Legal / Ilegal / Empresa)
      if (id === "subir:select_categoria") {
        await handleSubirSelectCategory(interaction, client);
        return;
      }
    }

    // ─── USER SELECT MENUS ───────────────────────────────────────────────
    if (interaction.isUserSelectMenu()) {
      const id = interaction.customId;

      // Jefe Faccionario / Empresarial (fallback)
      if (id.startsWith("subir:jefe:")) {
        await handleSubirJefeSelect(interaction);
        return;
      }

      // Sub Jefe Faccionario (fallback)
      if (id.startsWith("subir:subjefe:")) {
        await handleSubirSubjefeSelect(interaction);
        return;
      }
    }

  } catch (err: any) {
    if (err?.code === 10062) return;

    console.error("[INTERACTION] Error no manejado:", err);

    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Ocurrio un error procesando tu solicitud.",
          flags: 64,
        });
      }
    } catch {
      // Silenciar
    }
  }
}
