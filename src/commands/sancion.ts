import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { handleSancionRetirarCommand } from "../handlers/warnHandler.js";

const data = new SlashCommandBuilder()
  .setName("sancion")
  .setDescription("Gestión de sanciones administrativas del staff")
  .addSubcommandGroup(group =>
    group
      .setName("administrativa")
      .setDescription("Sanciones administrativas del staff")
      .addSubcommand(sub =>
        sub
          .setName("retirar")
          .setDescription("Retira una advertencia administrativa activa (abre modal de selección)")
          .addUserOption(opt =>
            opt
              .setName("usuario")
              .setDescription("Filtrar sanciones de un usuario específico (opcional)")
              .setRequired(false)
          )
      )
  );

async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const group = interaction.options.getSubcommandGroup();
  const sub   = interaction.options.getSubcommand();

  if (group === "administrativa" && sub === "retirar") {
    await handleSancionRetirarCommand(interaction, client);
  }
}

export default { data, execute };
