import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { renderTryoutPanel } from "../handlers/tryoutHandler.js";

// Slash command limpio sin opciones/parámetros. Al ejecutarse abre el Panel Interactivo V2 con Modals V2
const data = new SlashCommandBuilder()
  .setName("tryout")
  .setDescription("Sistema de conocimiento e IA para Sonora RP (solo admins).")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const command: Command = {
  data,
  adminOnly: false,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ Solo los administradores pueden usar este comando.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Abre el Panel Interactivo Modals V2 directamente
    await renderTryoutPanel(interaction);
  },
};

export default command;
