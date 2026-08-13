import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { buildWarnModal, WARN_OFFICER_ROLE_ID } from "../handlers/warnHandler.js";
import { getFooterTimestamp } from "../utils/components.js";

const data = new SlashCommandBuilder()
  .setName("warn")
  .setDescription("Gestión de advertencias administrativas — Staff")
  .addSubcommand(sub =>
    sub
      .setName("administrativo")
      .setDescription("Emite una advertencia administrativa a un miembro del staff")
  );

async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "administrativo") {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const hasPermission =
      member?.permissions.has(8n) ||
      member?.roles.cache.has(WARN_OFFICER_ROLE_ID);

    if (!hasPermission) {
      const noPermContainer = new ContainerBuilder()
        .setAccentColor(0xef4444)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## ⛔ Permisos Insuficientes"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("No tienes el rol requerido para emitir advertencias administrativas."))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`));

      await interaction.reply({
        components: [noPermContainer],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      return;
    }

    await interaction.showModal(buildWarnModal());
  }
}

export default { data, execute };
