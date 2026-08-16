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
import { getRawResolved } from "../utils/rawInteractionStore.js";
import { buildErrorContainer, buildSuccessContainer } from "../utils/components.js";

const REQUIRED_ROLE_ID = "1532578233973739732";
const LOG_CHANNEL_ID = "1538734146321391676";
const PUBLIC_CK_CHANNEL_ID = "1538735086269108234";

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

// Helper para formato de fecha limpio
function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }) + " · " + now.toLocaleTimeString("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

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
              label: "CK2",
              value: "CK2",
              description: "Character Kill secundario o especial",
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

    // Construir Container de Confirmación limpio y estructurado
    const avatarUrl = interaction.user.displayAvatarURL({ size: 256 });
    const confirmContainer = new ContainerBuilder()
      .setAccentColor(0xf97316)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### Confirmación de Character Kill (CK)")
          )
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Usuario Afectado:** <@${targetUserId}>\n` +
          `**Tipo de CK:** ${tipoCk}\n` +
          `**Motivo:** ${motivo}\n` +
          `**Evidencias Adjuntas:** ${imageUrls.length} archivo(s)`
        )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Acciones que se ejecutarán:**\n` +
          `• Eliminación permanente del registro de INE.\n` +
          `• Reseteo del saldo bancario y efectivo a $0.\n` +
          `• Asignación de roles: <@&1529584400126181516>, <@&1528974991813771304>, <@&1531425281502613675>.\n` +
          `• Publicación del informe en canal de logs (<#${LOG_CHANNEL_ID}>).\n` +
          `• Publicación de anuncio en canal público (<#${PUBLIC_CK_CHANNEL_ID}>).`
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
        new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFormattedDate()}`)
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

  // Verificar que quien confirma/anula sea quien ejecutó el comando o un Administrador
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
      .setAccentColor(0xef4444)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### Proceso de Character Kill Anulado")
          )
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `La solicitud de CK para <@${pending.targetUserId}> fue cancelada por <@${interaction.user.id}>. No se aplicó ningún cambio.`
        )
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFormattedDate()}`)
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
      let targetAvatarUrl = interaction.guild?.iconURL() ?? "";

      // 1. Aplicar Roles al usuario
      try {
        const targetMember = await interaction.guild?.members.fetch(targetUserId);
        if (targetMember) {
          targetAvatarUrl = targetMember.user.displayAvatarURL();
          for (const roleId of ROLES_TO_ADD) {
            if (!targetMember.roles.cache.has(roleId)) {
              await targetMember.roles.add(roleId).catch(err => {
                console.warn(`[CK CONFIRM] Error asignando rol ${roleId}:`, err);
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[CK CONFIRM] No se pudo obtener el miembro ${targetUserId}:`, err);
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

      // 3. Publicar en Canal de Log Staff (1538734146321391676) con MediaGallery
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) as TextChannel | undefined;
      if (logChannel) {
        const logContainer = new ContainerBuilder()
          .setAccentColor(0xf97316)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("### REGISTRO DE CHARACTER KILL (STAFF LOG)")
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetAvatarUrl))
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Usuario Afectado:** <@${targetUserId}>\n` +
              `**Staff Ejecutor:** <@${staffUserId}>\n` +
              `**Tipo de CK:** ${tipoCk}\n` +
              `**Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
              `**Motivo:**\n${motivo}\n\n` +
              `**Acciones Registradas:**\n` +
              `• Registro de INE removido\n` +
              `• Saldo bancario y efectivo reseteados a $0\n` +
              `• Roles asignados: <@&1529584400126181516>, <@&1528974991813771304>, <@&1531425281502613675>`
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
            new TextDisplayBuilder().setContent(`-# Sonora RP Staff System · ${getFormattedDate()}`)
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
          .setAccentColor(0xf97316)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("### REGISTRO OFICIAL DE CHARACTER KILL")
              )
              .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetAvatarUrl))
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `**Usuario:** <@${targetUserId}>\n` +
              `**Tipo de CK:** ${tipoCk}\n\n` +
              `**Motivo:**\n${motivo}\n\n` +
              `**Staff Responsable:** <@${staffUserId}>`
            )
          )
          .addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
          )
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFormattedDate()}`)
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
        `**Tipo:** ${tipoCk}\n` +
        `**INE:** Eliminada de la base de datos\n` +
        `**Economía:** Reseteada a $0\n` +
        `**Log Registrado:** <#${LOG_CHANNEL_ID}>\n` +
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
