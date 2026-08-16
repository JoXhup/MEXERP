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
import { getRawResolved } from "../utils/rawInteractionStore.js";

// Configuración constante para Narco Post
export const NARCO_ROLE_ID = "1531406663507247184";
export const NARCO_CHANNEL_ID = "1532154858142957678";
export const BLOOD_RED_COLOR = 0x8b0000; // Rojo fuerte / Rojo sangre

/**
 * Genera el contenedor V2 para la publicación del Narco Post con estética criminal interceptada.
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

  // Contenido principal de la transmisión
  const mainContent = `### ☠️ ${titulo}\n${descripcion}`;

  // Formato Intercepted Transmission (inspirado en la imagen de referencia)
  const interceptedInfo = isEncrypted
    ? `**Message Intercepted**\n` +
      `🔒 **Origin:** Encrypted Signal (TOR Proxy)\n` +
      `🌐 **IP:** \`${fakeIP}\`\n` +
      `📱 **Device:** Encrypted Android Device ($2,500 MXN en efectivo)`
    : `**Message Intercepted**\n` +
      `🌐 **Origin:** Open Network (Public Location)\n` +
      `📱 **Device:** Unencrypted Mobile Device`;

  const container = new ContainerBuilder()
    .setAccentColor(BLOOD_RED_COLOR)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(mainContent)
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(interceptedInfo)
    );

  // Si se adjuntaron imágenes, agregamos MediaGallery V2 (hasta 10 fotos)
  if (imageUrls.length > 0) {
    const galleryItems = imageUrls.slice(0, 10).map((url) => ({ media: { url } }));
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
        `[SORP] Sonora Roleplay · ${getFooterTimestamp()}`
      )
    );

  return container;
}

/**
 * Handler del comando /narco post (y /narcopost).
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
      `Solo los miembros autorizados de la red criminal (<@&${NARCO_ROLE_ID}>) pueden usar la red **Narco Post**.`,
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
                label: "Adjuntar Fotografías / Evidencias",
                description: "Imágenes o videos de la operación (Hasta 10 archivos)",
                component: {
                  type: 19, // FILE_UPLOAD
                  custom_id: "narco_files",
                  min_values: 0,
                  max_values: 10,
                  required: false,
                },
              },
              {
                type: 18, // LABEL
                label: "Título o Asunto del Comunicado",
                component: {
                  type: 4, // TextInput
                  custom_id: "narco_titulo",
                  style: 1, // Short
                  placeholder: "Ej. Venta de Armamento Pesado / Comunicado Oficial",
                  required: true,
                  max_length: 100,
                },
              },
              {
                type: 18, // LABEL
                label: "Mensaje o Detalles del Comunicado",
                component: {
                  type: 4, // TextInput
                  custom_id: "narco_descripcion",
                  style: 2, // Paragraph
                  placeholder: "Especifica el mensaje, condiciones o detalles de la operación...",
                  required: true,
                  max_length: 2000,
                },
              },
              {
                type: 18, // LABEL
                label: "Ubicación Encriptada (Opciones V2)",
                description: "Encriptar ubicación ($2,500 MXN en efectivo) o ubicación abierta",
                component: {
                  type: 3, // StringSelect
                  custom_id: "narco_encriptado",
                  placeholder: "Selecciona el nivel de encriptación...",
                  min_values: 1,
                  max_values: 1,
                  options: [
                    {
                      label: "🔒 Encriptar Ubicación ($2,500 MXN en efectivo)",
                      value: "encriptado_2500",
                      description: "Cobra $2,500 MXN en efectivo. Oculta ubicación e IP 🔒",
                    },
                    {
                      label: "🌐 Ubicación Abierta (Sin Costo)",
                      value: "ubicacion_abierta",
                      description: "Ubicación pública sin encriptación (Gratis)",
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
    console.error("[NARCO_POST] Fallo REST Modal V2, usando fallback:", err);
    const modal = new ModalBuilder()
      .setCustomId("narco:modal_submit")
      .setTitle("Narco Post · Red Criminal");

    const inputTitulo = new TextInputBuilder()
      .setCustomId("narco_titulo")
      .setLabel("Título del Comunicado")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej. Venta de Armamento Pesado")
      .setRequired(true)
      .setMaxLength(100);

    const inputDesc = new TextInputBuilder()
      .setCustomId("narco_descripcion")
      .setLabel("Detalles del Comunicado")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Mensaje o detalles...")
      .setRequired(true)
      .setMaxLength(2000);

    const inputEnc = new TextInputBuilder()
      .setCustomId("narco_encriptado_text")
      .setLabel("¿Encriptar? (1 = $2500 Efectivo, 2 = Abierto)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Escribe 1 para Encriptado ($2,500) o 2 para Abierto")
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
  let titulo = "Comunicado Criminal";
  let descripcion = "Sin contenido.";
  let optionValue = "";

  const rawComponents =
    (interaction as any).data?.components ?? (interaction as any).components ?? [];

  for (const row of rawComponents) {
    const inner = row?.component ?? row?.components?.[0] ?? row;
    const customId = inner?.customId ?? inner?.custom_id;
    const values = inner?.values;
    const value = inner?.value;

    if (customId === "narco_titulo" && value) titulo = value;
    if (customId === "narco_descripcion" && value) descripcion = value;
    if (customId === "narco_encriptado" && values?.length) optionValue = values[0];
  }

  // Fallbacks por interaction.fields
  try {
    const t = interaction.fields.getTextInputValue("narco_titulo");
    if (t) titulo = t;
  } catch {}

  try {
    const d = interaction.fields.getTextInputValue("narco_descripcion");
    if (d) descripcion = d;
  } catch {}

  if (!optionValue) {
    try {
      const e = interaction.fields.getTextInputValue("narco_encriptado_text");
      if (e && (e.includes("1") || e.toLowerCase().includes("si") || e.toLowerCase().includes("sí"))) {
        optionValue = "encriptado_2500";
      }
    } catch {}
  }

  const esEncriptado = optionValue.includes("encriptado");

  // 3. Si solicitó encriptado ($2,500), verificar saldo en efectivo
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
  const fakeIP = `188.40.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}`;

  // 5. Enviar mensaje al canal target 1532154858142957678
  const targetChannel = await client.channels.fetch(NARCO_CHANNEL_ID).catch(() => null);
  if (!targetChannel || !targetChannel.isTextBased()) {
    await interaction.editReply({
      content: `❌ No se pudo encontrar o enviar la publicación al canal <#${NARCO_CHANNEL_ID}>.`,
    });
    return;
  }

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
  const confirmLines =
    `✅ **¡Narco Post publicado exitosamente en <#${NARCO_CHANNEL_ID}>!**\n\n` +
    `• **Título:** \`${titulo}\`\n` +
    `• **Encriptación:** ${
      esEncriptado
        ? `\`🔒 ENCRIPTADO ($2,500 MXN descontados en efectivo)\` (IP: \`${fakeIP}\`)`
        : "`🌐 UBICACIÓN ABIERTA`"
    }\n` +
    (imageUrls.length > 0 ? `• **Imágenes adjuntas:** \`${imageUrls.length}\`` : "");

  const successContainer = buildSuccessContainer("💀 Narco Post Publicado", confirmLines, client);
  await interaction.editReply({
    components: [successContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
