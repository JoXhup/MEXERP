import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import { handleHistorial } from "../handlers/economyHandler.js";

const data = new SlashCommandBuilder()
  .setName("historial")
  .setDescription("Muestra el historial de transacciones financieras recientes.")
  .addUserOption((opt) =>
    opt
      .setName("usuario")
      .setDescription("Usuario de quien consultar el historial (Opcional).")
      .setRequired(false)
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await handleHistorial(interaction);
  },
};

export default command;
