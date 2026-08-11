import { SlashCommandBuilder, type ChatInputCommandInteraction, type Client } from "discord.js";
import { handleSubirCommand } from "../handlers/subirHandler.js";
import type { Command } from "../types/index.js";

export const data = new SlashCommandBuilder()
  .setName("subir")
  .setDescription("Publica una institución (Facción Legal, Facción Ilegal o Empresa)")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("institucion")
      .setDescription("Abre el formulario para publicar una Facción Legal, Ilegal o Empresa")
  );

export async function execute(interaction: ChatInputCommandInteraction, client?: Client): Promise<void> {
  if (client) await handleSubirCommand(interaction, client);
}

const command: Command = {
  data,
  execute,
};

export default command;
