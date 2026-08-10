import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  AttachmentBuilder,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { renderWelcomeCard } from "./welcomeCanvas.js";

export const WELCOME_CHANNEL_ID = "1528571135678087340";

/**
 * Ejecuta el flujo completo de bienvenida para un miembro (Canal de bienvenidas + DM de verificación)
 */
export async function processWelcomeFlow(member: GuildMember): Promise<{
  welcomeSent: boolean;
  dmSent: boolean;
}> {
  const guild = member.guild;
  const client = member.client;

  let welcomeSent = false;
  let dmSent = false;

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const guildIcon = guild.iconURL({ extension: "png", size: 256 })
    ?? "https://i.erlc.gg/erlc-logo.png";
  const botIcon = client.user.displayAvatarURL({ extension: "png", size: 256 });

  // ─── 1. DIBUJAR TARJETA CANVAS ──────────────────────────────────────────────
  const memberCount = guild.memberCount;
  const username = member.user.tag ?? member.user.username;
  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });

  let canvasBuffer: Buffer | null = null;
  try {
    canvasBuffer = await renderWelcomeCard({
      username,
      memberCount,
      avatarUrl,
    });
  } catch (err) {
    console.error("[WELCOME_SERVICE] Error generando tarjeta Canvas:", err);
  }

  // ─── 2. ENVIAR A CANAL DE BIENVENIDAS ───────────────────────────────────────
  const welcomeChannel = guild.channels.cache.get(WELCOME_CHANNEL_ID) as TextChannel | undefined
    ?? (await guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null) as TextChannel | null);

  if (welcomeChannel && welcomeChannel.isTextBased()) {
    try {
      const channelContainer = new ContainerBuilder()
        .setAccentColor(0x0005ff) // Embed color #0005ff
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `# Bienvenid@ to Sonora RP\n\nGracias por unirte a nuestra comunidad de **Roleplay** en ER:LC, revisa nuestros canales informativos y reglamentos para evitar sanciones por parte del staff.`
              )
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIcon))
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

      const files: AttachmentBuilder[] = [];

      if (canvasBuffer) {
        const attachment = new AttachmentBuilder(canvasBuffer, { name: "bienvenida.png" });
        files.push(attachment);

        channelContainer.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems({
            media: { url: "attachment://bienvenida.png" },
          })
        );
      }

      channelContainer
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addSectionComponents(
          new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`SORP System · ${dateStr}`)
          )
        );

      await welcomeChannel.send({
        content: `<@${member.id}>`,
        components: [channelContainer],
        files,
      });

      welcomeSent = true;
    } catch (err) {
      console.error("[WELCOME_SERVICE] Error enviando mensaje al canal de bienvenidas:", err);
    }
  }

  // ─── 3. ENVIAR AL DM DEL USUARIO ───────────────────────────────────────────
  try {
    const dmContainer = new ContainerBuilder()
      .setAccentColor(0xe74c3c) // Color embed Red
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("# Welcome")
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(botIcon))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `Recuerda verificarte para tener acceso completo al servidor.\n\n> Dirigete al canal https://discord.com/channels/1528571127352262866/1528973867362812024\n\n* Completa el cap chat solicitado, si tienes problemas al realizarlo ve al canal de https://discord.com/channels/1528571127352262866/1528868846906114321 para ser atendido por un moderador.`
          )
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addSectionComponents(
        new SectionBuilder().addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`SORP System · ${dateStr}`)
        )
      );

    await member.send({
      components: [dmContainer],
    });

    dmSent = true;
  } catch (err) {
    console.warn(`[WELCOME_SERVICE] No se pudo enviar DM a ${member.user.tag} (DMs cerrados):`, err);
  }

  return { welcomeSent, dmSent };
}
