import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";

/**
 * Responde con el Container V2 Rojo cuando un comando ERLC no tiene API Key configurada.
 */
export async function sendErlcApiErrorContainer(
  target: ChatInputCommandInteraction | Message,
  cmdName: string
): Promise<void> {
  const guild = target.guild;
  const guildIcon = guild?.iconURL({ extension: "png", size: 256 })
    ?? "https://i.erlc.gg/erlc-logo.png";

  const container = new ContainerBuilder()
    .setAccentColor(0xe74c3c) // Color container Red
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# API / Not Found\n\`:${cmdName}\` · Comando Externo ERLC`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(guildIcon)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "* El comando no esta conectado mediante el **API-Key** de ERLC, contacta un desarrollador.",
          "",
          "› 📄 **Documentación oficial:** [ER:LC API Docs](https://apidocs.erlc.gg/)",
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Sonora System · ERLC Integration")
    );

  if ("isChatInputCommand" in target && typeof target.isChatInputCommand === "function") {
    await target.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  } else if ("reply" in target) {
    await (target as Message).reply({
      components: [container],
      // @ts-ignore
      flags: MessageFlags.IsComponentsV2,
    }).catch(() => null);
  }
}
