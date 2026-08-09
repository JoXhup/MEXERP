import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleRetirar } from "../handlers/economyHandler.js";

const data = new SlashCommandBuilder()
  .setName("retirar")
  .setDescription("Retira dinero de tu banco (Bank Money) a tu efectivo (Money).")
  .addStringOption((opt) =>
    opt
      .setName("cantidad")
      .setDescription("Cantidad a retirar (ej: 5000) o la palabra 'todo'.")
      .setRequired(true)
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleRetirar(interaction);
  },
};

export default command;
