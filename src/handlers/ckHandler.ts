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

// Helper para timestamp
function getTimestampString(): string {
  const now = new Date();
  return now.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }) + " " + now.toLocaleTimeString("es-MX", {
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

  // Construir Modal Raw con FileUpload (type 19) usando REST directo
  const rawModalData = {
    title: "Generar Character Kill (CK)",
    custom_id: `ck:modal:generar:${targetUser.id}`,
    components: [
      {
        type: 18,
        label: "Tipo de CK",
        description: "Selecciona la modalidad de CK a ejecutar",
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
          placeholder: "Describe detalladamente la razón o justificación del CK...",
          required: true,
          min_length: 10,
          max_length: 1000,
        },
      },
      {
        type: 18,
        label: "Pruebas o evidencias de CK",
        description: "Imágenes o videos (Solo visibles en el canal de logs)",
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
    // 1. Extraer datos del modal
    let tipoCk = "CK";
    let motivo = "Sin motivo especificado";

    // Extraer campos
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

    // Fallback por getTextInputValue si aplica
    try {
      const m = interaction.fields.getTextInputValue("motivo");
      if (m) motivo = m;
    } catch {}

    // 2. Extraer archivos subidos (resolved.attachments)
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

    console.log(`[CK GENERAR] Archivos adjuntos encontrados (${imageUrls.length}):`, imageUrls);

    // 3. Obtener miembro objetivo
    let targetUserTag = `<@${targetUserId}>`;
    let targetAvatarUrl = interaction.guild.iconURL() ?? "";
    try {
      const targetMember = await interaction.guild.members.fetch(targetUserId);
      if (targetMember) {
        targetUserTag = `<@${targetMember.id}> (${targetMember.user.tag})`;
        targetAvatarUrl = targetMember.user.displayAvatarURL();

        // Asignar los 3 roles requeridos si no los tiene
        for (const roleId of ROLES_TO_ADD) {
          if (!targetMember.roles.cache.has(roleId)) {
            await targetMember.roles.add(roleId).catch(err => {
              console.warn(`[CK GENERAR] No se pudo asignar el rol ${roleId}:`, err);
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[CK GENERAR] No se pudo obtener el miembro ${targetUserId} en el servidor:`, err);
    }

    // 4. Resetear datos en la base de datos (Eliminar INE y reseteo de economía)
    await Ine.deleteOne({ discordId: targetUserId }).catch(err => {
      console.error(`[CK GENERAR] Error al eliminar INE de ${targetUserId}:`, err);
    });

    await Economy.findOneAndUpdate(
      { discordId: targetUserId },
      { money: 0, bank: 0, blackMoney: 0 },
      { upsert: false },
    ).catch(err => {
      console.error(`[CK GENERAR] Error al resetear economía de ${targetUserId}:`, err);
    });

    // 5. Publicar en Canal de Logs (CON imágenes de evidencia)
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) as TextChannel | undefined;
    if (logChannel) {
      const logContainer = new ContainerBuilder()
        .setAccentColor(0xf97316) // Naranja ROL
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("📋 **REGISTRO OFICIAL DE CK (STAFF LOG)**")
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetAvatarUrl))
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `👤 **Usuario Sancionado:** <@${targetUserId}>\n` +
            `🛡️ **Staff Ejecutor:** <@${interaction.user.id}>\n` +
            `💀 **Tipo de CK:** **${tipoCk}**\n` +
            `📝 **Motivo:**\n${motivo}\n\n` +
            `💳 **INE Eliminada:** Sí (Registros removidos)\n` +
            `💰 **Dinero IC:** Reseteado a $0\n` +
            `🎭 **Roles Asignados:** <@&1529584400126181516>, <@&1528974991813771304>, <@&1531425281502613675>\n` +
            `📅 **Fecha de Registro:** <t:${Math.floor(Date.now() / 1000)}:F>`
          )
        );

      // Si hay imágenes, agregamos MediaGallery al log
      if (imageUrls.length > 0) {
        const galleryItems = imageUrls.slice(0, 10).map(url => ({ media: { url } }));
        logContainer.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        );
        (logContainer as any).components.push({
          type: 12, // Media Gallery
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
          new TextDisplayBuilder().setContent(`-# Sonora RP Staff System · ${getTimestampString()}`)
        );

      await logChannel.send({
        components: [logContainer],
        flags: MessageFlags.IsComponentsV2,
      }).catch(err => {
        console.error(`[CK GENERAR] Error enviando log a ${LOG_CHANNEL_ID}:`, err);
      });
    }

    // 6. Publicar en Canal Público de CK (SIN imágenes de evidencia)
    const publicChannel = client.channels.cache.get(PUBLIC_CK_CHANNEL_ID) as TextChannel | undefined;
    if (publicChannel) {
      const publicContainer = new ContainerBuilder()
        .setAccentColor(0xf97316) // Naranja ROL
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("💀 **REGISTRO OFICIAL DE CHARACTER KILL**")
            )
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetAvatarUrl))
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `👤 **Usuario:** <@${targetUserId}>\n` +
            `💀 **Tipo de CK:** **${tipoCk}**\n` +
            `📝 **Motivo del CK:**\n${motivo}\n\n` +
            `🛡️ **Staff Responsable:** <@${interaction.user.id}>`
          )
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getTimestampString()}`)
        );

      await publicChannel.send({
        components: [publicContainer],
        flags: MessageFlags.IsComponentsV2,
      }).catch(err => {
        console.error(`[CK GENERAR] Error enviando anuncio a ${PUBLIC_CK_CHANNEL_ID}:`, err);
      });
    }

    // 7. Responder al Staff con confirmación limpia
    await interaction.editReply({
      components: [
        buildSuccessContainer(
          "✅ Character Kill Procesado",
          `👤 **Usuario:** <@${targetUserId}>\n` +
          `💀 **Tipo:** ${tipoCk}\n` +
          `🗑️ **Datos Removidos:** INE eliminada · Dinero IC reseteado a $0\n` +
          `🎭 **Roles Asignados:** <@&1529584400126181516>, <@&1528974991813771304>, <@&1531425281502613675>\n` +
          `📋 **Log con pruebas:** <#${LOG_CHANNEL_ID}>\n` +
          `📢 **Anuncio público:** <#${PUBLIC_CK_CHANNEL_ID}>`,
          client,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    console.error("[CK GENERAR] Error procesando submit de modal:", err);
    await interaction.editReply({
      components: [
        buildErrorContainer(
          "Ocurrió un error inesperado al procesar el Character Kill (CK).",
          client,
        ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}
