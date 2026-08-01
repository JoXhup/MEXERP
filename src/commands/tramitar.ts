import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleTramitarCommand } from "../handlers/ineHandler.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tramitar")
    .setDescription("Comandos para realizar trámites oficiales.")
    .addSubcommand((sub) =>
      sub
        .setName("ine")
        .setDescription("Tramita tu credencial para votar (INE) de Tamaulipas RP.")
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "ine") {
      await handleTramitarCommand(interaction);
    }
  },
};

export default command;
