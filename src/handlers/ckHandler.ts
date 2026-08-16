import type {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Ine } from "../models/Ine.js";
import { Economy } from "../models/Economy.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
import { getRawResolved } from "../utils/rawInteractionStore.js";
import { buildErrorContainer, buildSuccessContainer } from "../utils/components.js";

const REQUIRED_ROLE_ID = "1532578233973739732";
const LOG_CHANNEL_ID = "1538734146321391676";
const PUBLIC_CK_CHANNEL_ID = "1538735086269108234";
const DARK_CONTAINER_COLOR = 0x2b2d31; // Color Gris Oscuro / Negro elegante

const ROLES_TO_ADD = [
  "1529584400126181516",
  "1528974991813771304",
  "1531425281502613675",
];

interface PendingCk {
  targetUserId: string;
  staffUserId: string;
  tipoCk: string;
  motivo: string;
  imageUrls: string[];
  createdAt: number;
}

const pendingCkStore = new Map<string, PendingCk>();

// ─── HANDLER COMANDO /ck generar ──────────────────────────────────────────────
export async function handleCkGenerarCommand(
  interaction: ChatInputCommandInteraction,
  client: Client,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const hasRole =
    member?.roles?.cache?.has(REQUIRED_ROLE_ID) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (!hasRole) {
    await interaction.reply({
      components: [
        buildErrorContainer(
          `No tienes permisos para ejecutar este comando. Requieres el rol <@&${REQUIRED_ROLE_ID}>.`,
          client,
        ),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("usuario", true);

  // Modal Raw con FileUpload (type 19) usando REST directo
  const rawModalData = {
    title: "Generar Character Kill (CK)",
    custom_id: `ck:modal:generar:${targetUser.id}`,
    components: [
      {
        type: 18,
        label: "Tipo de CK",
        description: "Selecciona la modalidad de CK a aplicar",
        component: {
          type: 3, // StringSelect
          custom_id: "tipo_ck",
          placeholder: "Selecciona el tipo de CK...",
          min_values: 1,
          max_values: 1,
          options: [
            {
              label: "Auto CK",
              value: "Auto CK",
              description: "Eliminación voluntaria de personaje",
            },
            {
              label: "CK Administrativo",
              value: "CK Administrativo",
              description: "Ejecutado por sanción o resolución administrativa",
            },
            {
              label: "CK",
              value: "CK",
              description: "Kill permanente de personaje en roleplay",
            },
          ],
        },
      },
      {
        type: 18,
        label: "Motivo del CK",
        description: "Detalle claro de la razón del CK",
        component: {
          type: 4, // TextInput Paragraph
          custom_id: "motivo",
          style: 2,
          placeholder: "Describe la razón o justificación del CK...",
          required: true,
          min_length: 10,
          max_length: 1000,
        },
      },
      {
        type: 18,
        label: "Pruebas o evidencias de CK",
        description: "Imágenes o videos (Solo visibles en canal de logs)",
        component: {
          type: 19, // FileUpload
          custom_id: "pruebas",
          required: false,
          min_values: 0,
          max_values: 10,
        },
      },
    ],
  };

  await interaction.client.rest.post(
    Routes.interactionCallback(interaction.id, interaction.token),
    { body: { type: InteractionResponseType.Modal, data: rawModalData } },
  );
}

// ─── HANDLER SUBMIT MODAL CK GENERAR ──────────────────────────────────────────
export async function handleCkModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client,
): Promise<void> {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "ck" || parts[1] !== "modal" || parts[2] !== "generar") return;

  const targetUserId = parts[3];
  if (!targetUserId || !interaction.guild) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let tipoCk = "CK";
    let motivo = "Sin motivo especificado";

    const rawComponents =
      (interaction as any).data?.components ?? (interaction as any).components ?? [];
    for (const row of rawComponents) {
      const inner = row?.component ?? row?.components?.[0] ?? row;
      const customId = inner?.customId ?? inner?.custom_id;
      const values = inner?.values;
      const value = inner?.value;

      if (customId === "tipo_ck" && values?.length) {
        tipoCk = values[0];
      }
      if (customId === "motivo" && value) {
        motivo = value;
      }
    }

    try {
      const m = interaction.fields.getTextInputValue("motivo");
      if (m) motivo = m;
    } catch {}

    // Extraer archivos adjuntos
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

    // Registrar pendiente en memoria para confirmación
    const pendingId = `${targetUserId}_${Date.now()}`;
    pendingCkStore.set(pendingId, {
      targetUserId,
      staffUserId: interaction.user.id,
      tipoCk,
      motivo,
      imageUrls,
      createdAt: Date.now(),
    });

    // Consultar información del ciudadano (INE + Roblox)
    const verifiedUser = await VerifiedUser.findOne({ discordId: targetUserId });
    const ineData = await Ine.findOne({ discordId: targetUserId });

    const nombreIC = ineData?.nombre ?? "No registrado";
    const numIne = ineData?.numIne ?? ineData?.curp ?? "No registrado";
    const robloxName = verifiedUser?.robloxName ?? ineData?.robloxUsername ?? "Sin vincular";
    const robloxId = verifiedUser?.robloxId;

    // Thumbnail del Server Icon
    const serverIconUrl = interaction.guild.iconURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

    const unixTimestamp = Math.floor(Date.now() / 1000);

    // Construir Container de Confirmación estilo Sonora RP (Gris/Negro con Server Icon)
    const confirmContainer = new ContainerBuilder()
      .setAccentColor(DARK_CONTAINER_COLOR)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### REGISTRO OFICIAL DE CHARACTER KILL\n**Fecha:** <t:${unixTimestamp}:F>`
            )
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(serverIconUrl))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Datos del Ciudadano (IC)**\n` +
          `• **Nombre IC:** ${nombreIC}\n` +
          `• **Identificación (INE):** ${numIne}\n` +
          `• **Cuenta Roblox:** ${robloxName}${robloxId ? ` (${robloxId})` : ""}`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Detalles del Character Kill (OOC)**\n` +
          `• **Usuario Sancionado:** <@${targetUserId}>\n` +
          `• **Modalidad:** ${tipoCk}\n` +
          `• **Motivo:** ${motivo}\n` +
          `• **Staff Responsable:** <@${interaction.user.id}>\n` +
          `• **Archivos Adjuntos:** ${imageUrls.length} archivo(s)`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`ck:confirm:${pendingId}`)
            .setLabel("Confirmar CK")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`ck:cancel:${pendingId}`)
            .setLabel("Anular CK")
            .setStyle(ButtonStyle.Danger)
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Sonora RP System · Confirmación de Character Kill`
        )
      );

    await interaction.editReply({
      components: [confirmContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    console.error("[CK MODAL SUBMIT] Error:", err);
    await interaction.editReply({
      components: [
        buildErrorContainer("Error al procesar el formulario de CK.", client),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

// ─── HANDLER DE BOTONES CONFIRMAR / ANULAR CK ─────────────────────────────────
export async function handleCkButtonInteraction(
  interaction: ButtonInteraction,
  client: Client,
): Promise<void> {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "ck") return;

  const action = parts[1]; // confirm | cancel
  const pendingId = parts[2];

  if (!pendingId) return;

  const pending = pendingCkStore.get(pendingId);
  if (!pending) {
    await interaction.reply({
      components: [
        buildErrorContainer("Esta solicitud de CK ha expirado o ya fue procesada.", client),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const isOwner = interaction.user.id === pending.staffUserId;
  const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    await interaction.reply({
      components: [
        buildErrorContainer("Solo el staff que inició el CK o un Administrador puede confirmar o anular esta acción.", client),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  // ─── ACCION: ANULAR CK ──────────────────────────────────────────────────────
  if (action === "cancel") {
    pendingCkStore.delete(pendingId);

    const cancelContainer = new ContainerBuilder()
      .setAccentColor(DARK_CONTAINER_COLOR)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### REGISTRO DE CHARACTER KILL — ANULADO")
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `La solicitud de Character Kill para <@${pending.targetUserId}> fue cancelada por <@${interaction.user.id}>. No se aplicó ninguna modificación.`
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Sonora RP System · Operación Anulada`
        )
      );

    await interaction.editReply({
      components: [cancelContainer],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // ─── ACCION: CONFIRMAR CK ───────────────────────────────────────────────────
  if (action === "confirm") {
    try {
      const { targetUserId, tipoCk, motivo, imageUrls, staffUserId } = pending;
      
      // Obtener datos del ciudadano ANTES de borrar la INE
      const verifiedUser = await VerifiedUser.findOne({ discordId: targetUserId });
      const ineData = await Ine.findOne({ discordId: targetUserId });

      const nombreIC = ineData?.nombre ?? "No registrado";
      const numIne = ineData?.numIne ?? ineData?.curp ?? "No registrado";
      const robloxName = verifiedUser?.robloxName ?? ineData?.robloxUsername ?? "Sin vincular";
      const robloxId = verifiedUser?.robloxId;

      let targetMember: GuildMember | null = null;
      try {
        targetMember = await interaction.guild?.members.fetch(targetUserId) ?? null;
      } catch {}

      // Server Icon Thumbnail
      const serverIconUrl = interaction.guild?.iconURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

      // 1. Aplicar Roles al usuario
      if (targetMember) {
        for (const roleId of ROLES_TO_ADD) {
          if (!targetMember.roles.cache.has(roleId)) {
            await targetMember.roles.add(roleId).catch(err => {
              console.warn(`[CK CONFIRM] Error asignando rol ${roleId}:`, err);
            });
          }
        }
      }

      // 2. Base de datos: Eliminar INE y Resetear Economía
      await Ine.deleteOne({ discordId: targetUserId }).catch(err => {
        console.error(`[CK CONFIRM] Error eliminando INE:`, err);
      });

      await Economy.findOneAndUpdate(
        { discordId: targetUserId },
        { money: 0, bank: 0, blackMoney: 0 },
        { upsert: false },
      ).catch(err => {
        console.error(`[CK CONFIRM] Error reseteando Economía:`, err);
      });

      const unixTimestamp = Math.floor(Date.now() / 1000);

      // 3. Publicar en Canal de Log Staff (1538734146321391676) con MediaGallery
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) as TextChannel | undefined;
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(DARK_CONTAINER_COLOR)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `### REGISTRO OFICIAL DE CHARACTER KILL (STAFF LOG)\n**Fecha:** <t:${unixTimestamp}:F>`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(serverIconUrl))
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Datos del Ciudadano (IC)**\n` +
              `• **Nombre IC:** ${nombreIC}\n` +
              `• **Identificación (INE):** ${numIne}\n` +
              `• **Cuenta Roblox:** ${robloxName}${robloxId ? ` (${robloxId})` : ""}`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Detalles del Character Kill (OOC)**\n` +
              `• **Usuario Sancionado:** <@${targetUserId}>\n` +
              `• **Modalidad:** ${tipoCk}\n` +
              `• **Motivo:** ${motivo}\n` +
              `• **Staff Responsable:** <@${staffUserId}>`
            )
          );

        if (imageUrls.length > 0) {
          const galleryItems = imageUrls.slice(0, 10).map(url => ({ media: { url } }));
          logContainer.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          );
          (logContainer as any).components.push({
            type: 12,
            items: galleryItems,
            toJSON() {
              return { type: 12, items: galleryItems };
            },
          });
        }

        logContainer
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# Sonora RP System · Sistema de Gestión de CK`
            )
          );

        await logChannel.send({
          components: [logContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch(err => console.error("[CK CONFIRM] Error enviando log:", err));
      }

      // 4. Publicar en Canal Público (1538735086269108234) SIN imágenes
      const publicChannel = client.channels.cache.get(PUBLIC_CK_CHANNEL_ID) as TextChannel | undefined;
      if (publicChannel) {
        const publicContainer = new ContainerBuilder()
          .setAccentColor(DARK_CONTAINER_COLOR)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `### REGISTRO OFICIAL DE CHARACTER KILL\n**Fecha:** <t:${unixTimestamp}:F>`
                )
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(serverIconUrl))
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Datos del Ciudadano (IC)**\n` +
              `• **Nombre IC:** ${nombreIC}\n` +
              `• **Identificación (INE):** ${numIne}\n` +
              `• **Cuenta Roblox:** ${robloxName}${robloxId ? ` (${robloxId})` : ""}`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Detalles del Character Kill (OOC)**\n` +
              `• **Usuario Sancionado:** <@${targetUserId}>\n` +
              `• **Modalidad:** ${tipoCk}\n` +
              `• **Motivo:** ${motivo}\n` +
              `• **Staff Responsable:** <@${staffUserId}>`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# Sonora RP System · Sistema de Gestión de CK`
            )
          );

        await publicChannel.send({
          components: [publicContainer],
          flags: MessageFlags.IsComponentsV2,
        }).catch(err => console.error("[CK CONFIRM] Error enviando anuncio público:", err));
      }

      pendingCkStore.delete(pendingId);

      // 5. Responder confirmación final
      const successContainer = buildSuccessContainer(
        "Character Kill Procesado Exitosamente",
        `**Usuario:** <@${targetUserId}>\n` +
        `**Modalidad:** ${tipoCk}\n` +
        `**INE:** Registro eliminado\n` +
        `**Economía:** Saldo reseteado a $0\n` +
        `**Log de Evidencias:** <#${LOG_CHANNEL_ID}>\n` +
        `**Anuncio Público:** <#${PUBLIC_CK_CHANNEL_ID}>`,
        client,
      );

      await interaction.editReply({
        components: [successContainer],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      console.error("[CK CONFIRM] Error procesando confirmación:", err);
      await interaction.editReply({
        components: [
          buildErrorContainer("Error inesperado al confirmar el CK.", client),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
}
