import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleMultarCommand } from "../handlers/fineHandler.js";

const data = new SlashCommandBuilder()
  .setName("multar")
  .setDescription("Abre el formulario Modal V2 para expedir una multa oficial.");

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction, client?: Client): Promise<void> {
    if (client) {
      await handleMultarCommand(interaction, client);
    }
  },
};

export default command;
