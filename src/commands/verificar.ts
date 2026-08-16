import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  AttachmentBuilder,
  type Client,
  type TextChannel,
} from "discord.js";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { buildVerificationPanelContainer } from "../utils/components.js";
import { isAdmin } from "../utils/permissions.js";

export const data = new SlashCommandBuilder()
  .setName("verificar")
  .setDescription("Envia el panel de verificacion al canal correspondiente")
  .setDefaultMemberPermissions(0); // Solo admins

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client,
): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? null;
  if (!isAdmin(member)) {
    await interaction.reply({
      content: "No tienes permisos para usar este comando.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const channel = await client.channels.fetch(config.verificationChannelId) as TextChannel;
    if (!channel?.isTextBased()) {
      await interaction.editReply({ content: "Canal de verificacion no encontrado." });
      return;
    }

    const guildIcon = interaction.guild?.iconURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

    let bannerUrl: string | undefined = undefined;
    const attachments: AttachmentBuilder[] = [];

    const candidatePaths = [
      path.join(process.cwd(), "src", "utils", "Assets", "Verify.png"),
      path.join(process.cwd(), "assets", "Verify.png"),
      path.join(process.cwd(), "Verify.png"),
      path.join(process.cwd(), "src", "utils", "Assets", "Verify.jpg"),
      path.join(process.cwd(), "assets", "Verify.jpg"),
      path.join(process.cwd(), "Verify.jpg"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        attachments.push(new AttachmentBuilder(p, { name: "Verify.png" }));
        bannerUrl = "attachment://Verify.png";
        break;
      }
    }

    const panel = buildVerificationPanelContainer(client, guildIcon, bannerUrl);

    await (channel as TextChannel).send({
      components: [panel],
      files: attachments,
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.editReply({ content: "Panel de verificacion enviado correctamente." });

  } catch (err) {
    console.error("[VERIFICAR] Error:", err);
    await interaction.editReply({ content: "Error al enviar el panel de verificacion." });
  }
}
