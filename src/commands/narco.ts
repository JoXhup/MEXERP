import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { handleNarcoPostCommand } from "../handlers/narcoHandler.js";

const data = new SlashCommandBuilder()
  .setName("narco")
  .setDescription("Sistema de gestión de publicaciones criminales")
  .addSubcommand(sub =>
    sub
      .setName("post")
      .setDescription("Publica un comunicado en la red Narco Post (Exclusivo Facciones Criminales)")
  );

async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();
  if (sub === "post") {
    await handleNarcoPostCommand(interaction, client);
  }
}

export default { data, execute };
