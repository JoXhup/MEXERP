import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import {
  handleTramitarCommand,
  handleIneRevisarCommand,
} from "../handlers/ineHandler.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tramitar")
    .setDescription("Comandos para realizar trámites oficiales.")
    .addSubcommand((sub) =>
      sub
        .setName("ine")
        .setDescription("Tramita tu credencial para votar (INE) de Tamaulipas RP.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("revisar")
        .setDescription("Revisa tu credencial para votar (INE) tramitada.")
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(false);
    if (subcommand === "revisar") {
      await handleIneRevisarCommand(interaction);
    } else {
      await handleTramitarCommand(interaction);
    }
  },
};

export default command;
