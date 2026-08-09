import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleDepositar } from "../handlers/economyHandler.js";

const data = new SlashCommandBuilder()
  .setName("depositar")
  .setDescription("Deposita dinero en efectivo (Money) a tu cuenta bancaria (Bank Money).")
  .addStringOption((opt) =>
    opt
      .setName("cantidad")
      .setDescription("Cantidad a depositar (ej: 5000) o la palabra 'todo'.")
      .setRequired(true)
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleDepositar(interaction);
  },
};

export default command;
