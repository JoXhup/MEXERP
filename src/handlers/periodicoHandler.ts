import type {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  Client,
  GuildMember,
  TextChannel,
} from "discord.js";
import {
  MessageFlags,
  InteractionResponseType,
  Routes,
  PermissionFlagsBits,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import {
  buildErrorContainer,
  buildSuccessContainer,
  getRandomColor,
  getFooterTimestamp,
} from "../utils/components.js";
import { getRawResolved } from "../utils/rawInteractionStore.js";

export const PERIODICO_ROLE_ID = "1538744574715895809";

/**
 * Handler para el comando /periodico.
 * Verifica rol 1538744574715895809 y abre el modal V2 con FileUpload y StringSelect.
 */
export async function handlePeriodicoCommand(
  interaction: ChatInputCommandInteraction,
  client: Client,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const hasRole =
    member?.roles?.cache?.has(PERIODICO_ROLE_ID) ||
    (Array.isArray(member?.roles) && member.roles.includes(PERIODICO_ROLE_ID)) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (!hasRole) {
    await interaction.reply({
      components: [
        buildErrorContainer(
          `Solo los redactores autorizados (<@&${PERIODICO_ROLE_ID}>) pueden publicar en el periódico oficial.`,
          client,
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // Modal Raw con FileUpload (type 19) y StringSelect (type 3) usando REST callback
  try {
    await client.rest.post(
      Routes.interactionCallback(interaction.id, interaction.token),
      {
        body: {
          type: 9,
          data: {
            custom_id: "periodico:modal_submit",
            title: "Publicar Artículo · Periódico Oficial",
            components: [
              {
                type: 18, // LABEL
                label: "Adjuntar Fotografías / Ilustraciones",
                description: "Imágenes o fotografías del artículo (Hasta 10 archivos)",
                component: {
                  type: 19, // FILE_UPLOAD
                  custom_id: "periodico_files",
                  min_values: 0,
                  max_values: 10,
                  required: false,
                },
              },
              {
                type: 18, // LABEL
                label: "Sección Periodística",
                description: "Selecciona la categoría del artículo",
                component: {
                  type: 3, // StringSelect
                  custom_id: "periodico_seccion",
                  placeholder: "Selecciona la sección...",
                  min_values: 1,
                  max_values: 1,
                  options: [
                    {
                      label: "Noticia de Última Hora",
                      value: "Última Hora",
                      description: "Acontecimientos relevantes de impacto inmediato",
                    },
                    {
                      label: "Nota Roja / Policiaca",
                      value: "Nota Roja",
                      description: "Sucesos policiacos, operativos y emergencias",
                    },
                    {
                      label: "Gobierno / Política",
                      value: "Gobierno",
                      description: "Comunicados oficiales, leyes e informes gubernamentales",
                    },
                    {
                      label: "Economía / Negocios",
                      value: "Economía",
                      description: "Mercado, comercios y actividades financieras",
                    },
                    {
                      label: "Eventos / Entretenimiento",
                      value: "Eventos",
                      description: "Sociales, espectáculos y actividades comunitarias",
                    },
                  ],
                },
              },
              {
                type: 18, // LABEL
                label: "Titular / Título Principal",
                component: {
                  type: 4, // TextInput
                  custom_id: "periodico_titulo",
                  style: 1, // Short
                  placeholder: "Ej. Gran Inauguración del Nuevo Complejo Deportivo...",
                  required: true,
                  max_length: 100,
                },
              },
              {
                type: 18, // LABEL
                label: "Cuerpo de la Nota / Contenido",
                component: {
                  type: 4, // TextInput
                  custom_id: "periodico_descripcion",
                  style: 2, // Paragraph
                  placeholder: "Redacta la nota periodística con todos los detalles...",
                  required: true,
                  max_length: 2400,
                },
              },
              {
                type: 18, // LABEL
                label: "Links / Enlaces a Servidores (Opcional)",
                description: "Enlaces a páginas, discord o referencias (Opcional)",
                component: {
                  type: 4, // TextInput
                  custom_id: "periodico_links",
                  style: 2, // Paragraph
                  placeholder: "https://discord.gg/... o enlaces relevantes",
                  required: false,
                  max_length: 500,
                },
              },
            ],
          },
        },
      }
    );
  } catch (err) {
    console.error("[PERIODICO] Fallo REST Modal V2, usando fallback:", err);
    const modal = new ModalBuilder()
      .setCustomId("periodico:modal_submit")
      .setTitle("Publicar Periódico Oficial");

    const inputTitulo = new TextInputBuilder()
      .setCustomId("periodico_titulo")
      .setLabel("Titular Principal")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej. Gran Inauguración...")
      .setRequired(true)
      .setMaxLength(100);

    const inputDesc = new TextInputBuilder()
      .setCustomId("periodico_descripcion")
      .setLabel("Contenido de la Nota")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Redacta la nota...")
      .setRequired(true)
      .setMaxLength(2400);

    const inputLinks = new TextInputBuilder()
      .setCustomId("periodico_links")
      .setLabel("Links / Enlaces (Opcional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("https://...")
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputDesc),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputLinks)
    );

    await interaction.showModal(modal);
  }
}

/**
 * Handler para procesar el envío del Modal del Periódico (`periodico:modal_submit`).
 */
export async function handlePeriodicoModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // 1. Extraer archivos subidos (resolved.attachments)
    const rawResolved = getRawResolved(interaction.id);
    const resolvedData =
      rawResolved ??
      (interaction as any).data?.resolved ??
      (interaction as any).resolved ??
      (interaction as any).fields?.resolved;

    const attachmentsMap = resolvedData?.attachments ?? {};
    const imageUrls: string[] = [];
    for (const att of Object.values(attachmentsMap) as any[]) {
      if (att?.url) imageUrls.push(att.url);
    }

    // 2. Extraer campos del formulario
    let seccion = "Noticia General";
    let titulo = "Artículo Periodístico";
    let descripcion = "Sin contenido.";
    let links = "";

    const rawComponents =
      (interaction as any).data?.components ?? (interaction as any).components ?? [];

    for (const row of rawComponents) {
      const inner = row?.component ?? row?.components?.[0] ?? row;
      const customId = inner?.customId ?? inner?.custom_id;
      const values = inner?.values;
      const value = inner?.value;

      if (customId === "periodico_seccion" && values?.length) seccion = values[0];
      if (customId === "periodico_titulo" && value) titulo = value;
      if (customId === "periodico_descripcion" && value) descripcion = value;
      if (customId === "periodico_links" && value) links = value;
    }

    // Fallbacks por interaction.fields
    try {
      const t = interaction.fields.getTextInputValue("periodico_titulo");
      if (t) titulo = t;
    } catch {}

    try {
      const d = interaction.fields.getTextInputValue("periodico_descripcion");
      if (d) descripcion = d;
    } catch {}

    try {
      const l = interaction.fields.getTextInputValue("periodico_links");
      if (l) links = l;
    } catch {}

    // Server Icon Thumbnail
    const serverIconUrl =
      interaction.guild?.iconURL({ size: 256 }) ??
      client.user?.displayAvatarURL({ size: 256 }) ??
      "";

    const unixTimestamp = Math.floor(Date.now() / 1000);
    const randomColor = getRandomColor();

    // Construir Container V2 con Color Aleatorio y Server Icon
    const newsContainer = new ContainerBuilder()
      .setAccentColor(randomColor)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### 📰 EL PERIÓDICO DE SONORA · ${seccion.toUpperCase()}\n**Edición Especial** · <t:${unixTimestamp}:F>`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(serverIconUrl))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `# ${titulo}\n` +
          `*Por: <@${interaction.user.id}>*\n\n` +
          `${descripcion}`
        )
      );

    // Agregar sección de Links si existen
    if (links.trim().length > 0) {
      newsContainer
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `🔗 **Enlaces y Enlaces de Servidores:**\n${links}`
          )
        );
    }

    // Agregar MediaGallery si hay imágenes
    if (imageUrls.length > 0) {
      const galleryItems = imageUrls.slice(0, 10).map((url) => ({ media: { url } }));
      newsContainer.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      );
      (newsContainer as any).components.push({
        type: 12,
        items: galleryItems,
        toJSON() {
          return { type: 12, items: galleryItems };
        },
      });
    }

    newsContainer
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Sonora News · Periódico Oficial de Sonora RP · ${getFooterTimestamp()}`
        )
      );

    // Publicar en el canal donde se ejecutó el comando
    if (interaction.channel && interaction.channel.isTextBased()) {
      await (interaction.channel as TextChannel).send({
        components: [newsContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Confirmación al redactor
    const successContainer = buildSuccessContainer(
      "Artículo Publicado Exitosamente",
      `El artículo **"${titulo}"** fue publicado correctamente en este canal.\n\n` +
      `• **Sección:** ${seccion}\n` +
      `• **Imágenes adjuntas:** ${imageUrls.length} archivo(s)`,
      client,
    );

    await interaction.editReply({
      components: [successContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    console.error("[PERIODICO MODAL SUBMIT] Error:", err);
    await interaction.editReply({
      components: [
        buildErrorContainer("Ocurrió un error al publicar el artículo periodístico.", client),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}
