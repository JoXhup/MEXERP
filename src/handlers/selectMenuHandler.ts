import type { StringSelectMenuInteraction, Client } from "discord.js";
import { MessageFlags, InteractionResponseType, Routes } from "discord.js";
import { CATEGORIES } from "../constants/categories.js";
import {
  buildCategoryModal,
  buildCKModal,
  buildAreaRolModal,
  buildControlRolModal,
  buildRetiroRolModal,
  buildSolicitudRPModal,
  buildReportarStaffModal,
  buildReporteDesarrolloModalV2,
  buildRawReportarUsuarioModal,
  buildRawRecompensasModal,
  buildRawRobosICModal,
} from "../utils/modals.js";
import { buildErrorContainer } from "../utils/components.js";
import { getCooldownRemaining, formatMs } from "../utils/cooldown.js";
import { handleClose } from "./buttonHandler.js";
import { showAddRemoveUserMenu } from "./ticketUserHandler.js";

// Helper: manda raw modal con FileUpload usando REST directo
async function showRawModal(interaction: StringSelectMenuInteraction, data: object): Promise<void> {
  await interaction.client.rest.post(
    Routes.interactionCallback(interaction.id, interaction.token),
    { body: { type: InteractionResponseType.Modal, data } },
  );
}

// ─── HANDLER: SELECCION DE CATEGORIA ──────────────────────────────────────────
export async function handleSelectCategory(
  interaction: StringSelectMenuInteraction,
  client: Client,
): Promise<void> {
  const categoryId = interaction.values[0];
  if (!categoryId) return;

  const cat = CATEGORIES[categoryId];
  if (!cat) {
    await interaction.reply({
      components: [buildErrorContainer("Categoría no reconocida.", client)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Verificar cooldown en memoria
  const remaining = getCooldownRemaining(interaction.user.id, "create_ticket");
  if (remaining > 0) {
    await interaction.reply({
      components: [buildErrorContainer(
        `Debes esperar **${formatMs(remaining)}** antes de crear otro ticket.`,
        client,
      )],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Mostrar modal específico por categoría
  try {
    switch (categoryId) {
      case "area_rol":
        await interaction.showModal(buildAreaRolModal());
        break;
      case "control_rol":
        await interaction.showModal(buildControlRolModal());
        break;
      case "retiro_rol":
        await interaction.showModal(buildRetiroRolModal());
        break;
      case "solicitud_rp":
        await interaction.showModal(buildSolicitudRPModal());
        break;
      case "solicitud_ck":
        await interaction.showModal(buildCKModal());
        break;
      case "reportar_usuario":
        await showRawModal(interaction, buildRawReportarUsuarioModal());
        break;
      case "reporte_staff":
        await interaction.showModal(buildReportarStaffModal());
        break;
      case "recompensas":
        await showRawModal(interaction, buildRawRecompensasModal());
        break;
      case "robos_ic":
        await showRawModal(interaction, buildRawRobosICModal());
        break;
      case "reporte_desarrollo":
        await interaction.showModal(buildReporteDesarrolloModalV2());
        break;
      default:
        await interaction.showModal(buildCategoryModal(cat));
    }
  } catch (err) {
    console.error("[SELECT_MENU] Error al mostrar modal:", err);
  }
}

// ─── HANDLER: SELECCION DE OPCIONES DE GESTION DE TICKET ─────────────────────
export async function handleTicketManagementSelect(
  interaction: StringSelectMenuInteraction,
  client: Client,
): Promise<void> {
  const parts = interaction.customId.split(":"); // ticket:management:<channelId>
  const channelId = parts[2];
  const selectedValue = interaction.values[0];

  if (!channelId || !selectedValue) return;

  if (selectedValue === "close") {
    await handleClose(interaction, client, channelId);
  } else if (selectedValue === "add_remove_user") {
    await showAddRemoveUserMenu(interaction, client, channelId);
  }
}
