import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleCobrar } from "../handlers/economyHandler.js";

const data = new SlashCommandBuilder()
  .setName("cobrar")
  .setDescription("Cobra tu sueldo o salario según tu rol o cargo en el servidor.");

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleCobrar(interaction);
  },
};

export default command;
