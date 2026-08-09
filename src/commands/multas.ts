import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import type { Command } from "../types/index.js";
import {
  handleMultarCommand,
  handleHistorialMultasCommand,
  handleCancelarMultaCommand,
} from "../handlers/fineHandler.js";

const data = new SlashCommandBuilder()
  .setName("multas")
  .setDescription("Sistema de gestión, emisión e historial de multas de Sonora RP.")
  .addSubcommand((sub) =>
    sub
      .setName("emitir")
      .setDescription("Abre el formulario Modal V2 para expedir una multa oficial.")
  )
  .addSubcommand((sub) =>
    sub
      .setName("historial")
      .setDescription("Muestra el historial de multas registradas (Disponible para todo el servidor).")
      .addUserOption((opt) =>
        opt.setName("usuario").setDescription("Usuario de quien deseas consultar las multas (Opcional).").setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("cancelar")
      .setDescription("Cancela una multa existente mediante su ID (Requiere rol autorizado).")
      .addStringOption((opt) =>
        opt.setName("id").setDescription("ID de la multa a cancelar (ej: MLT-000152).").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("motivo").setDescription("Motivo de la cancelación de la multa.").setRequired(true)
      )
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction, client?: Client): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === "emitir" && client) {
      await handleMultarCommand(interaction, client);
    } else if (sub === "historial") {
      await handleHistorialMultasCommand(interaction);
    } else if (sub === "cancelar" && client) {
      await handleCancelarMultaCommand(interaction, client);
    }
  },
};

export default command;
