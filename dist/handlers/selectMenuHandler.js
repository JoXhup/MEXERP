import { MessageFlags, InteractionResponseType, Routes } from "discord.js";
import { CATEGORIES } from "../constants/categories.js";
import { buildCategoryModal, buildEmpresaFaccionModal, buildRawReportarModal, buildRawReportarStaffModal, buildRawPeticionRolModal, buildRawComprasRealesModal, buildRawReclamarSorteoModal, } from "../utils/modals.js";
import { buildErrorContainer } from "../utils/components.js";
import { getCooldownRemaining, formatMs } from "../utils/cooldown.js";
import { handleClose, handleTranscript } from "./buttonHandler.js";
// Helper: manda raw modal con FileUpload usando REST directo
// interaction.respond() no existe en discord.js — usamos client.rest.post()
async function showRawModal(interaction, data) {
    await interaction.client.rest.post(Routes.interactionCallback(interaction.id, interaction.token), { body: { type: InteractionResponseType.Modal, data } });
}
// ─── HANDLER: SELECCION DE CATEGORIA ──────────────────────────────────────────
export async function handleSelectCategory(interaction, client) {
    const categoryId = interaction.values[0];
    if (!categoryId)
        return;
    const cat = CATEGORIES[categoryId];
    if (!cat) {
        await interaction.reply({
            components: [buildErrorContainer("Categoría no reconocida.", client)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
    }
    // Verificar cooldown en memoria (súper rápido)
    const remaining = getCooldownRemaining(interaction.user.id, "create_ticket");
    if (remaining > 0) {
        await interaction.reply({
            components: [buildErrorContainer(`Debes esperar **${formatMs(remaining)}** antes de crear otro ticket.`, client)],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
        return;
    }
    // Mostrar modal v2 especifico por categoria inmediatamente
    try {
        switch (categoryId) {
            // Categorías con FileUpload → usar raw modal via REST
            case "reportar":
                await showRawModal(interaction, buildRawReportarModal());
                break;
            case "reportar_staff":
                await showRawModal(interaction, buildRawReportarStaffModal());
                break;
            case "peticion_rol":
                await showRawModal(interaction, buildRawPeticionRolModal());
                break;
            case "compras_reales":
                await showRawModal(interaction, buildRawComprasRealesModal());
                break;
            case "reclamar_sorteos":
                await showRawModal(interaction, buildRawReclamarSorteoModal());
                break;
            // Categorías con StringSelect → usar builder de discord.js
            case "empresas_faccion":
                await interaction.showModal(buildEmpresaFaccionModal());
                break;
            default:
                await interaction.showModal(buildCategoryModal(cat));
        }
    }
    catch (err) {
        console.error("[SELECT_MENU] Error al mostrar modal:", err);
    }
}
// ─── HANDLER: SELECCION DE OPCIONES DE GESTION DE TICKET ─────────────────────
export async function handleTicketManagementSelect(interaction, client) {
    const parts = interaction.customId.split(":"); // ticket:management:<channelId>
    const channelId = parts[2];
    const selectedValue = interaction.values[0];
    if (!channelId || !selectedValue)
        return;
    if (selectedValue === "close") {
        await handleClose(interaction, client, channelId);
    }
    else if (selectedValue === "transcript") {
        await handleTranscript(interaction, client, channelId);
    }
}
