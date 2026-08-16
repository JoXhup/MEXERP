import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { handleCkGenerarCommand } from "../handlers/ckHandler.js";

const data = new SlashCommandBuilder()
  .setName("ck")
  .setDescription("Sistema de gestión de Character Kill (CK)")
  .addSubcommand(sub =>
    sub
      .setName("generar")
      .setDescription("Genera y aplica un Character Kill (CK) a un usuario")
      .addUserOption(opt =>
        opt
          .setName("usuario")
          .setDescription("Usuario al que se le aplicará el Character Kill (CK)")
          .setRequired(true)
      )
  );

async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (sub === "generar") {
    await handleCkGenerarCommand(interaction, client);
  }
}

export default { data, execute };
