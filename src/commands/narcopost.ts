import { SlashCommandBuilder, type ChatInputCommandInteraction, type Client } from "discord.js";
import { handleNarcoPostCommand } from "../handlers/narcoHandler.js";
import type { Command } from "../types/index.js";

export const data = new SlashCommandBuilder()
  .setName("narcopost")
  .setDescription("Publica un anuncio o reporte criminal en la red Narco Post (Exclusivo Facciones)");

export async function execute(interaction: ChatInputCommandInteraction, client?: Client): Promise<void> {
  if (client) await handleNarcoPostCommand(interaction, client);
}

const command: Command = {
  data,
  execute,
};

export default command;
