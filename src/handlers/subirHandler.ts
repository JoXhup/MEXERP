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
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  Routes,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type Client,
  type Guild,
  type User,
} from "discord.js";
import {
  buildErrorContainer,
  buildSuccessContainer,
  getFooterTimestamp,
} from "../utils/components.js";
import {
  extractModalAttachments,
  findModalFieldValue,
} from "./tryoutHandler.js";

// Roles autorizados
export const SUBIR_ROLES = ["1532578233973739732", "1531426497942781972"];

// Canales de destino
export const DEST_CHANNELS = {
  legal: "1528875517430857829",   // Foro Facción Legal
  ilegal: "1528875559461978283",  // Foro Facción Ilegal
  empresa: "1528868964749283450", // Canal de Texto Empresas
};

/**
 * Verifica si el usuario tiene al menos uno de los roles autorizados.
 */
export function checkSubirPermissions(member: any): boolean {
  if (!member || !("roles" in member)) return false;
  if (Array.isArray(member.roles)) {
    return member.roles.some((r: string) => SUBIR_ROLES.includes(r));
  }
  if ((member.roles as any)?.cache) {
    return SUBIR_ROLES.some((r: string) => (member.roles as any).cache.has(r));
  }
  return false;
}

/**
 * Genera el contenedor V2 para la institución (Facción Legal, Ilegal o Empresa).
 */
export function buildInstitucionContainer(
  guild: Guild | null,
  author: User,
  tipo: "legal" | "ilegal" | "empresa",
  tituloForo: string,
  rolId: string,
  descripcion: string,
  linkServer: string,
  imageUrl?: string
): ContainerBuilder {
  // Server icon as thumbnail
  const iconUrl = guild?.iconURL({ extension: "png", size: 256 }) ?? "";

  const configMap = {
    legal: {
      color: 0x2563eb, // Azul medio-fuerte (Azul no tan fuerte pero si fuerte)
      emoji: "🏛️",
      nombre: "Facción Legal",
    },
    ilegal: {
      color: 0x991b1b, // Rojo / Carmesí oscuro
      emoji: "💀",
      nombre: "Facción Ilegal",
    },
    empresa: {
      color: 0xd97706, // Dorado / Ámbar
      emoji: "💼",
      nombre: "Empresa",
    },
  };

  const c = configMap[tipo];
  const roleDisplay = rolId ? `<@&${rolId}>` : "Rol Institucional";

  // El título del container es el Rol faccionario / empresarial
  const headerContent = `# ${c.emoji} ${roleDisplay}\n**${tituloForo}**`;

  const infoLines = [
    `📌 **Categoría:** \`${c.nombre}\``,
    `👤 **Publicado por:** ${author} (\`${author.tag}\`)`,
    `🏷️ **Rol Faccionario / Empresa:** ${roleDisplay}`,
    linkServer
      ? `🔗 **Link Server:** ${linkServer.startsWith("http") ? linkServer : `https://${linkServer}`}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const descLines = [
    `📝 **Descripción e Información:**`,
    `>>> ${descripcion}`,
  ].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(c.color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(headerContent)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(infoLines)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(descLines)
    );

  // Agregar 1 imagen de portada si existe
  if (imageUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12, // MediaGallery
      items: [{ media: { url: imageUrl } }],
      toJSON() {
        return {
          type: 12,
          items: [{ media: { url: imageUrl } }],
        };
      },
    });
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# SORP System · ${getFooterTimestamp()}`)
    );

  return container;
}

/**
 * Handler del comando /subir institucion.
 * Despliega el menú de selección de categoría (Legal, Ilegal, Empresa).
 */
export async function handleSubirCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand !== "institucion") return;

  if (!checkSubirPermissions(interaction.member)) {
    const errorContainer = buildErrorContainer(
      `Solo el personal autorizado de instituciones (<@&${SUBIR_ROLES[0]}> / <@&${SUBIR_ROLES[1]}>) puede usar este comando.`,
      client
    );
    await interaction.reply({
      components: [errorContainer],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("subir:select_categoria")
    .setPlaceholder("Selecciona el tipo de institución a publicar...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Facción Legal")
        .setValue("legal")
        .setDescription("Publica una facción legal en el foro oficial")
        .setEmoji("🏛️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Facción Ilegal")
        .setValue("ilegal")
        .setDescription("Publica una facción ilegal en el foro de actividades ilegales")
        .setEmoji("💀"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Empresa")
        .setValue("empresa")
        .setDescription("Publica una empresa en el canal de empresas")
        .setEmoji("💼")
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const iconUrl = interaction.guild?.iconURL({ extension: "png", size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const container = new ContainerBuilder()
    .setAccentColor(0x3b82f6)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "# 🏢 Registro de Institución\n**Selecciona la categoría a publicar:**"
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(row)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# SORP System · ${getFooterTimestamp()}`)
    );

  await interaction.reply({
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

/**
 * Handler cuando el usuario selecciona una categoría en el select menu `subir:select_categoria`.
 * Abre el Modal V2 correspondiente.
 */
export async function handleSubirSelectCategory(
  interaction: StringSelectMenuInteraction,
  client: Client
): Promise<void> {
  const tipo = interaction.values[0] as "legal" | "ilegal" | "empresa";

  if (!checkSubirPermissions(interaction.member)) {
    await interaction.reply({
      content: "❌ No tienes permisos para esta acción.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const titles = {
    legal: "Publicar Facción Legal (Modal V2)",
    ilegal: "Publicar Facción Ilegal (Modal V2)",
    empresa: "Publicar Empresa (Modal V2)",
  };

  try {
    await client.rest.post(
      Routes.interactionCallback(interaction.id, interaction.token),
      {
        body: {
          type: 9,
          data: {
            custom_id: `subir:modal_submit:${tipo}`,
            title: titles[tipo],
            components: [
              {
                type: 18, // LABEL
                label: "Addfiles (1 Imagen de Portada)",
                description: "Adjunta la imagen o logo de portada (Máximo 1 imagen)",
                component: {
                  type: 19, // FILE_UPLOAD
                  custom_id: "inst_addfiles",
                  min_values: 0,
                  max_values: 1,
                  required: false,
                },
              },
              {
                type: 18, // LABEL
                label: "Título Foro",
                component: {
                  type: 4, // TextInput
                  custom_id: "inst_titulo_foro",
                  style: 1, // Short
                  placeholder: "Ej. [Oficial] Policía Estatal de Sonora / Cártel...",
                  required: true,
                  max_length: 100,
                },
              },
              {
                type: 18, // LABEL
                label: "Rol Faccionario / Empresa",
                description: "Selecciona el rol oficial que identificará al container",
                component: {
                  type: 6, // RoleSelect
                  custom_id: "inst_rol_select",
                  placeholder: "Elige el rol de la institución...",
                  min_values: 1,
                  max_values: 1,
                },
              },
              {
                type: 18, // LABEL
                label: "Descripción Detallada",
                component: {
                  type: 4, // TextInput
                  custom_id: "inst_descripcion",
                  style: 2, // Paragraph
                  placeholder: "Escribe la historia, requisitos, normativas o servicios...",
                  required: true,
                  max_length: 2400,
                },
              },
              {
                type: 18, // LABEL
                label: "Link Server (Invitación Discord)",
                component: {
                  type: 4, // TextInput
                  custom_id: "inst_link_server",
                  style: 1, // Short
                  placeholder: "https://discord.gg/tu-comunidad",
                  required: true,
                  max_length: 200,
                },
              },
            ],
          },
        },
      }
    );
  } catch (err) {
    console.error("[SUBIR_INSTITUCION] Error enviando Modal V2, probando fallback:", err);
    // Fallback modal estándar
    const modal = new ModalBuilder()
      .setCustomId(`subir:modal_submit:${tipo}`)
      .setTitle(titles[tipo]);

    const inputTitulo = new TextInputBuilder()
      .setCustomId("inst_titulo_foro")
      .setLabel("Título Foro")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej. [Oficial] Nombre de la Institución")
      .setRequired(true)
      .setMaxLength(100);

    const inputRol = new TextInputBuilder()
      .setCustomId("inst_rol_id")
      .setLabel("ID o Mención del Rol Faccionario")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Pega el ID o mención del rol aquí...")
      .setRequired(true)
      .setMaxLength(50);

    const inputDesc = new TextInputBuilder()
      .setCustomId("inst_descripcion")
      .setLabel("Descripción Detallada")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Escribe la descripción o requisitos...")
      .setRequired(true)
      .setMaxLength(2400);

    const inputLink = new TextInputBuilder()
      .setCustomId("inst_link_server")
      .setLabel("Link Server (Invitación Discord)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://discord.gg/ejemplo")
      .setRequired(true)
      .setMaxLength(200);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputTitulo),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputRol),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputDesc),
      new ActionRowBuilder<TextInputBuilder>().addComponents(inputLink)
    );

    await interaction.showModal(modal);
  }
}

/**
 * Handler del envío del modal de institución (`subir:modal_submit:<tipo>`).
 */
export async function handleSubirModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(":");
  const tipo = (parts[2] ?? "legal") as "legal" | "ilegal" | "empresa";

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // 1. Extraer adjuntos / imágenes
  const attachmentsList = extractModalAttachments(interaction);
  const imageUrl = attachmentsList[0]?.url;

  // 2. Extraer campos
  const tituloForo = findModalFieldValue(interaction, "inst_titulo_foro") || "Institución Sin Título";
  const descripcion = findModalFieldValue(interaction, "inst_descripcion") || "Sin descripción.";
  const linkServer = findModalFieldValue(interaction, "inst_link_server") || "";

  // Extraer rol seleccionado del componente RoleSelect
  let rolId = "";
  const rawComponents = (interaction as any).data?.components ?? (interaction as any).components ?? [];

  function searchRoleValues(list: any[]): string | null {
    for (const comp of list) {
      if ((comp.custom_id === "inst_rol_select" || comp.customId === "inst_rol_select") && Array.isArray(comp.values) && comp.values[0]) {
        return comp.values[0];
      }
      if (comp.component) {
        const res = searchRoleValues([comp.component]);
        if (res) return res;
      }
      if (comp.components && Array.isArray(comp.components)) {
        const res = searchRoleValues(comp.components);
        if (res) return res;
      }
    }
    return null;
  }

  rolId = searchRoleValues(rawComponents) ?? findModalFieldValue(interaction, "inst_rol_id") ?? "";

  // Si rolId vino como mención <@&123456>, extraer solo números
  if (rolId.includes("<@&")) {
    rolId = rolId.replace(/[^0-9]/g, "");
  }

  // 3. Crear el contenedor V2
  const container = buildInstitucionContainer(
    interaction.guild,
    interaction.user,
    tipo,
    tituloForo,
    rolId,
    descripcion,
    linkServer,
    imageUrl
  );

  // 4. Determinar canal de destino
  const targetChannelId = DEST_CHANNELS[tipo];
  const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);

  if (!targetChannel) {
    await interaction.editReply({
      content: `❌ No se pudo encontrar el canal de destino para **${tipo}** (\`${targetChannelId}\`).`,
    });
    return;
  }

  try {
    // Si el destino es un ForumChannel (Facción Legal / Ilegal)
    if ((targetChannel as any).isThreadOnly?.() || (targetChannel as any).type === 15) {
      const forumChannel = targetChannel as import("discord.js").ForumChannel;
      const thread = await forumChannel.threads.create({
        name: tituloForo.substring(0, 100),
        message: {
          components: [container],
          // @ts-ignore
          flags: MessageFlags.IsComponentsV2,
        },
      });
      console.log(`[SUBIR_INSTITUCION] Publicado hilo en foro (${tipo}): ${thread.name} (${thread.id})`);
    } else if ((targetChannel as any).isTextBased?.()) {
      // Si el destino es un TextChannel (Empresa)
      const textChannel = targetChannel as import("discord.js").TextChannel;
      await textChannel.send({
        components: [container],
        // @ts-ignore
        flags: MessageFlags.IsComponentsV2,
      });
      console.log(`[SUBIR_INSTITUCION] Publicado mensaje en canal (${tipo}): ${targetChannelId}`);
    }
  } catch (pubErr) {
    console.error("[SUBIR_INSTITUCION] Error al publicar en canal de destino:", pubErr);
    await interaction.editReply({
      content: `❌ Error al crear la publicación en el canal <#${targetChannelId}>.`,
    });
    return;
  }

  // 5. Confirmación efímera al usuario
  const confirmText = [
    `✅ **¡Institución publicada exitosamente!**`,
    `› **Categoría:** \`${tipo.toUpperCase()}\``,
    `› **Título:** \`${tituloForo}\``,
    `› **Rol:** ${rolId ? `<@&${rolId}>` : "`Sin rol`"}`,
    `› **Canal/Foro Destino:** <#${targetChannelId}>`,
  ].join("\n");

  const successContainer = buildSuccessContainer("🏢 Publicación Completada", confirmText, client);
  await interaction.editReply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
