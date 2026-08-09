import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types/index.js";
import {
  handleEconomiaGeneral,
  handleRanking,
  handleEcoAdmin,
} from "../handlers/economyHandler.js";

const data = new SlashCommandBuilder()
  .setName("economia")
  .setDescription("Sistema de estadísticas, ranking y administración de economía.")
  .addSubcommand((sub) =>
    sub
      .setName("general")
      .setDescription("Muestra la masa monetaria en circulación, bancos y estadísticas globales.")
  )
  .addSubcommand((sub) =>
    sub
      .setName("ranking")
      .setDescription("Muestra la tabla de clasificación de los usuarios más ricos del servidor.")
  )
  .addSubcommandGroup((group) =>
    group
      .setName("admin")
      .setDescription("Comandos administrativos para gestión de economía.")
      .addSubcommand((sub) =>
        sub
          .setName("agregar")
          .setDescription("Agrega dinero a la cuenta de un usuario.")
          .addUserOption((opt) => opt.setName("usuario").setDescription("Usuario a modificar.").setRequired(true))
          .addStringOption((opt) =>
            opt
              .setName("tipo")
              .setDescription("Tipo de cuenta a modificar.")
              .setRequired(true)
              .addChoices(
                { name: "💵 Dinero (Efectivo)", value: "dinero" },
                { name: "🏦 Banco", value: "banco" },
                { name: "🕶️ Dinero Negro (Ilegal)", value: "ilegal" }
              )
          )
          .addIntegerOption((opt) => opt.setName("cantidad").setDescription("Cantidad a agregar.").setRequired(true).setMinValue(1))
      )
      .addSubcommand((sub) =>
        sub
          .setName("retirar")
          .setDescription("Quita dinero de la cuenta de un usuario.")
          .addUserOption((opt) => opt.setName("usuario").setDescription("Usuario a modificar.").setRequired(true))
          .addStringOption((opt) =>
            opt
              .setName("tipo")
              .setDescription("Tipo de cuenta a modificar.")
              .setRequired(true)
              .addChoices(
                { name: "💵 Dinero (Efectivo)", value: "dinero" },
                { name: "🏦 Banco", value: "banco" },
                { name: "🕶️ Dinero Negro (Ilegal)", value: "ilegal" }
              )
          )
          .addIntegerOption((opt) => opt.setName("cantidad").setDescription("Cantidad a retirar.").setRequired(true).setMinValue(1))
      )
      .addSubcommand((sub) =>
        sub
          .setName("establecer")
          .setDescription("Establece un saldo exacto a la cuenta de un usuario.")
          .addUserOption((opt) => opt.setName("usuario").setDescription("Usuario a modificar.").setRequired(true))
          .addStringOption((opt) =>
            opt
              .setName("tipo")
              .setDescription("Tipo de cuenta a modificar.")
              .setRequired(true)
              .addChoices(
                { name: "💵 Dinero (Efectivo)", value: "dinero" },
                { name: "🏦 Banco", value: "banco" },
                { name: "🕶️ Dinero Negro (Ilegal)", value: "ilegal" }
              )
          )
          .addIntegerOption((opt) => opt.setName("cantidad").setDescription("Nuevo saldo exacto.").setRequired(true).setMinValue(0))
      )
      .addSubcommand((sub) =>
        sub
          .setName("reset")
          .setDescription("Reinicia a $0 toda la economía de un usuario.")
          .addUserOption((opt) => opt.setName("usuario").setDescription("Usuario a reiniciar.").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("bloquear")
          .setDescription("Bloquea la cuenta económica de un usuario.")
          .addUserOption((opt) => opt.setName("usuario").setDescription("Usuario a bloquear.").setRequired(true))
          .addStringOption((opt) => opt.setName("motivo").setDescription("Motivo del bloqueo.").setRequired(false))
      )
      .addSubcommand((sub) =>
        sub
          .setName("desbloquear")
          .setDescription("Desbloquea la cuenta económica de un usuario.")
          .addUserOption((opt) => opt.setName("usuario").setDescription("Usuario a desbloquear.").setRequired(true))
      )
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (group === "admin") {
      await handleEcoAdmin(interaction);
    } else if (sub === "general") {
      await handleEconomiaGeneral(interaction);
    } else if (sub === "ranking") {
      await handleRanking(interaction);
    }
  },
};

export default command;
