import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleTramitarCommand } from "../handlers/ineHandler.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ine")
    .setDescription("Tramita tu credencial para votar (INE) de Tamaulipas RP.")
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleTramitarCommand(interaction);
  },
};

export default command;
