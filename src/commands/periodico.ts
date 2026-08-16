import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { handlePeriodicoCommand } from "../handlers/periodicoHandler.js";

const data = new SlashCommandBuilder()
  .setName("periodico")
  .setDescription("Publica un artículo o nota informativa en el periódico oficial (Exclusivo Prensa)");

async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await handlePeriodicoCommand(interaction, client);
}

export default { data, execute };
