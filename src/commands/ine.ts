import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import {
  handleTramitarCommand,
  handleIneRevisarCommand,
  handleIneEliminarCommand,
} from "../handlers/ineHandler.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ine")
    .setDescription("Comandos para la credencial para votar (INE).")
    .addSubcommand((sub) =>
      sub
        .setName("tramitar")
        .setDescription("Tramita tu credencial para votar (INE) de Sonora RP.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("revisar")
        .setDescription("Revisa una credencial de INE tramitada.")
        .addUserOption((opt) =>
          opt
            .setName("usuario")
            .setDescription("Usuario cuya INE quieres revisar. Si no se especifica, se muestra la tuya.")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("eliminar")
        .setDescription("Elimina la credencial INE de un usuario (Solo Administradores / Staff Autorizado).")
        .addUserOption((opt) =>
          opt
            .setName("usuario")
            .setDescription("Usuario al que le eliminarás la INE.")
            .setRequired(true)
        )
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand(false);
    if (subcommand === "revisar") {
      await handleIneRevisarCommand(interaction);
    } else if (subcommand === "eliminar") {
      await handleIneEliminarCommand(interaction);
    } else {
      await handleTramitarCommand(interaction);
    }
  },
};

export default command;
