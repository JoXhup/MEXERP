import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { documentCache } from "../utils/documentCache.js";
import {
  renderTryoutPanel,
  renderDeleteMultiSelect,
  renderInfoView,
} from "../handlers/tryoutHandler.js";

const data = new SlashCommandBuilder()
  .setName("tryout")
  .setDescription("Sistema de conocimiento e IA para Sonora RP (solo admins).")

  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Abre el Panel Interactivo V2 con menú de opciones (solo admins).")
  )

  .addSubcommand((sub) =>
    sub
      .setName("limpiar")
      .setDescription("Abre el Menú de Selección Múltiple para borrar documentos (solo admins).")
  )

  .addSubcommand((sub) =>
    sub
      .setName("info")
      .setDescription("Muestra la lista de documentos y conocimiento almacenado (solo admins).")
  );

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

    const sub = interaction.options.getSubcommand(false) ?? "panel";

    // ─── Subcomando: /tryout panel ───────────────────────────────────────────
    if (sub === "panel") {
      await renderTryoutPanel(interaction);
      return;
    }

    // ─── Subcomando: /tryout limpiar ─────────────────────────────────────────
    if (sub === "limpiar") {
      await renderDeleteMultiSelect(interaction);
      return;
    }

    // ─── Subcomando: /tryout info ─────────────────────────────────────────────
    if (sub === "info") {
      await renderInfoView(interaction);
      return;
    }

    await renderTryoutPanel(interaction);
  },
};

export default command;
