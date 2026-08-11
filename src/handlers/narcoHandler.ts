import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Routes,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type Client,
  type User,
} from "discord.js";
import { Economy } from "../models/Economy.js";
import {
  buildErrorContainer,
  buildSuccessContainer,
  getFooterTimestamp,
} from "../utils/components.js";
import {
  extractModalAttachments,
  findModalFieldValue,
} from "./tryoutHandler.js";

// Configuración constante para Narco Post
export const NARCO_ROLE_ID = "1531406663507247184";
export const NARCO_CHANNEL_ID = "1532154858142957678";

/**
 * Genera el contenedor V2 para la publicación del Narco Post con estética criminal.
 * Color: Carmesí oscuro / negro (0x8b0000).
 */
export function buildNarcoPostContainer(
  author: User,
  titulo: string,
  descripcion: string,
  isEncrypted: boolean,
  fakeIP: string,
  imageUrls: string[] = []
): ContainerBuilder {
  const avatarUrl = author.displayAvatarURL({ extension: "png", size: 256 });

  // Título General & Encabezado criminal
  const headerContent = `# 💀 Narco Post · Red Criminal\n**Mensaje Encriptado / Reporte de Operación**`;

  // Estado de Ubicación e IP
  const locationStatus = isEncrypted
    ? `🔒 **Estado de Ubicación:** \`🔒 ENCRIPTADA ($2,500 MXN en efectivo)\`\n📡 **IP de Conexión TOR:** \`${fakeIP}\``
    : `🌐 **Estado de Ubicación:** \`🌐 UBICACIÓN ABIERTA / RED PÚBLICA (Sin Encriptar)\``;

  const infoContent = [
    `# 📋 ${titulo}`,
    `👤 **Publicado por:** ${author} (\`${author.tag}\`)`,
    locationStatus,
  ].join("\n");

  const detailsContent = [
    `📝 **Detalles de la Operación / Mercancía:**`,
    `>>> ${descripcion}`,
  ].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(0x8b0000) // Rojo carmesí oscuro criminal
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(headerContent)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(infoContent)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(detailsContent)
    );

  // Si se adjuntaron imágenes, agregamos la galería MediaGallery V2
  if (imageUrls.length > 0) {
    const galleryItems = imageUrls.slice(0, 5).map((url) => ({ media: { url } }));
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12, // ComponentType.MEDIA_GALLERY
      items: galleryItems,
      toJSON() {
        return {
          type: 12,
          items: galleryItems,
        };
      },
    });
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# 💀 Red Narco Post · Transmisión Segura · ${getFooterTimestamp()}`
      )
    );

  return container;
}

/**
 * Handler del comando /narcopost.
 * Valida el rol criminal 1531406663507247184 y despliega el Modal V2.
 */
export async function handleNarcoPostCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  const member = interaction.member;
  let hasRole = false;

  if (member && "roles" in member) {
    if (Array.isArray(member.roles)) {
      hasRole = member.roles.includes(NARCO_ROLE_ID);
    } else if ((member.roles as any)?.cache) {
      hasRole = (member.roles as any).cache.has(NARCO_ROLE_ID);
    }
  }

  if (!hasRole) {
    const container = buildErrorContainer(
      `Solo los miembros autorizados de la red criminal (<@&${NARCO_ROLE_ID}>) pueden usar el comando **/narcopost**.`,
      client
    );
    await interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  // Desplegar Modal V2 con REST callback
  try {
    await client.rest.post(
      Routes.interactionCallback(interaction.id, interaction.token),
      {
        body: {
          type: 9,
          data: {
            custom_id: "narco:modal_submit",
            title: "Narco Post · Red Criminal",
            components: [
              {
                type: 18, // LABEL
                label: "Adjuntar Imágenes (Opcional - Máx. 5)",
                description: "Fotografías o evidencias de la operación (Hasta 5 imágenes)",
                component: {
                  type: 19, // FILE_UPLOAD
                  custom_id: "narco_files",
                  min_values: 0,
                  max_values: 5,
                  required: false,
                },
              },
              {
                type: 18, // LABEL
                label: "Título del Narco Post",
                component: {
                  type: 4, // TextInput
                  custom_id: "narco_titulo",
                  style: 1, // Short
                  placeholder: "Ej. Venta de Armamento Pesado / Cargamento",
                  required: true,
                  max_length: 100,
                },
              },
              {
                type: 18, // LABEL
                label: "Descripción / Detalles",
                component: {
                  type: 4, // TextInput
                  custom_id: "narco_descripcion",
                  style: 2, // Paragraph
                  placeholder: "Especifica los detalles de la mercancía, condiciones o mensaje...",
                  required: true,
                  max_length: 2400,
                },
              },
              {
                type: 18, // LABEL
                label: "Opción de Encriptación",
                description: "Encriptar ubicación ($2,500 en efectivo) o ubicación abierta",
                component: {
                  type: 3, // StringSelect
                  custom_id: "narco_encriptado",
                  placeholder: "Selecciona el tipo de encriptación...",
                  options: [
                    {
                      label: "Sí, costeo $2,500 ($2,500 en efectivo)",
                      value: "encriptado_2500",
                      description: "Cuesta $2,500 MXN en efectivo (mano). Muestra IP 🔒",
                      emoji: { name: "🔒" },
                    },
                    {
                      label: "Ubicación Abierta (Sin costo)",
                      value: "ubicacion_abierta",
                      description: "Ubicación pública sin encriptar (Gratis)",
                      emoji: { name: "🌐" },
                    },
                  ],
                },
              },
            ],
          },
        },
      }
    );
  } catch (err) {
    console.error("[NARCO_POST] Fallo REST Modal V2, probando modal estándar:", err);
    // Fallback a modal estándar
    const modal = new ModalBuilder()
      .setCustomId("narco:modal_submit")
      .setTitle("Narco Post · Red Criminal");

    const inputTitulo = new TextInputBuilder()
      .setCustomId("narco_titulo")
      .setLabel("Título del Narco Post")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej. Venta de Armamento Pesado")
      .setRequired(true)
      .setMaxLength(100);

    const inputDesc = new TextInputBuilder()
      .setCustomId("narco_descripcion")
      .setLabel("Descripción de la Operación")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Detalles de la mercancía...")
      .setRequired(true)
      .setMaxLength(2400);

    const inputEnc = new TextInputBuilder()
      .setCustomId("narco_encriptado_text")
      .setLabel("¿Encriptar? (1 = $2500 Efectivo, 2 = Abierto)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Escribe 1 para Encriptado ($2,500) o 2 para Ubicación Abierta")
      .setRequired(true)
      .setMaxLength(40);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputDesc),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputEnc)
    );

    await interaction.showModal(modal);
  }
}

/**
 * Handler para procesar el envío del Modal de Narco Post (`narco:modal_submit`).
 */
export async function handleNarcoModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // 1. Extraer adjuntos / imágenes
  const attachmentsList = extractModalAttachments(interaction);

  // 2. Extraer campos del formulario
  const titulo = findModalFieldValue(interaction, "narco_titulo") || "Narco Post Sin Título";
  const descripcion = findModalFieldValue(interaction, "narco_descripcion") || "Sin descripción.";

  let optionValue = findModalFieldValue(interaction, "narco_encriptado");
  if (!optionValue) {
    const rawData = (interaction as any).data?.components ?? (interaction as any).components ?? [];
    // Buscar valor en select menu
    for (const row of rawData) {
      const comps = row.components ?? [row];
      for (const c of comps) {
        if (c.custom_id === "narco_encriptado" && Array.isArray(c.values)) {
          optionValue = c.values[0];
        }
      }
    }
  }

  if (!optionValue) {
    const textVal = findModalFieldValue(interaction, "narco_encriptado_text");
    if (textVal && textVal.trim().startsWith("1")) {
      optionValue = "encriptado_2500";
    } else {
      optionValue = "ubicacion_abierta";
    }
  }

  const esEncriptado = optionValue === "encriptado_2500";

  // 3. Si solicitó encriptado ($2,500), verificar que tenga $2,500 en efectivo fuera del banco
  if (esEncriptado) {
    const eco = await Economy.findOne({ discordId: interaction.user.id });
    const efectivo = eco?.money ?? 0;

    if (efectivo < 2500) {
      const errorContainer = buildErrorContainer(
        `❌ **Fondos en efectivo insuficientes.**\n\n` +
          `Para encriptar la ubicación del Narco Post necesitas **$2,500 MXN en efectivo (mano)**.\n` +
          `Tu saldo actual en efectivo es: **$${efectivo.toLocaleString("es-MX")} MXN**.\n\n` +
          `*Nota: No se acepta dinero en banco ni dinero negro.*`,
        client
      );
      await interaction.editReply({
        components: [errorContainer],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    // Descontar $2,500 MXN de efectivo (money)
    await Economy.findOneAndUpdate(
      { discordId: interaction.user.id },
      { $inc: { money: -2500 } }
    );
    console.log(`[NARCO_POST] Descontados $2,500 en efectivo a ${interaction.user.tag} (${interaction.user.id})`);
  }

  // 4. Generar IP falsa para encriptación TOR
  const fakeIP = `185.220.101.${Math.floor(Math.random() * 200 + 10)}`;

  // 5. Enviar mensaje al canal target 1532154858142957678
  const targetChannel = await client.channels.fetch(NARCO_CHANNEL_ID).catch(() => null);
  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.editReply({
      content: `❌ No se pudo encontrar o enviar la publicación al canal <#${NARCO_CHANNEL_ID}>.`,
    });
    return;
  }

  const imageUrls = attachmentsList.map((a) => a.url);
  const container = buildNarcoPostContainer(
    interaction.user,
    titulo,
    descripcion,
    esEncriptado,
    fakeIP,
    imageUrls
  );

  await (targetChannel as any).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  // 6. Confirmación efímera al autor
  const confirmLines = [
    `✅ **¡Narco Post publicado exitosamente en <#${NARCO_CHANNEL_ID}>!**`,
    `› **Título:** \`${titulo}\``,
    `› **Encriptación:** ${
      esEncriptado
        ? `\`🔒 ENCRIPTADO ($2,500 MXN descontados en efectivo)\` (IP: \`${fakeIP}\`)`
        : "`🌐 UBICACIÓN ABIERTA`"
    }`,
    imageUrls.length > 0 ? `› **Imágenes adjuntas:** \`${imageUrls.length}\`` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const successContainer = buildSuccessContainer("💀 Narco Post Publicado", confirmLines, client);
  await interaction.editReply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
