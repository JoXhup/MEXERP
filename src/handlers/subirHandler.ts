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
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Routes,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
  type ButtonInteraction,
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

// ─── Roles autorizados ─────────────────────────────────────────────────────────
export const SUBIR_ROLES = ["1532578233973739732", "1531426497942781972"];

// ─── Canales de destino ────────────────────────────────────────────────────────
export const DEST_CHANNELS = {
  legal: "1528875517430857829",
  ilegal: "1528875559461978283",
  empresa: "1528868964749283450",
};

// ─── Config por tipo ──────────────────────────────────────────────────────────
const TIPO_CONFIG = {
  legal: {
    color: 0x2563eb,
    nombre: "Facción Legal",
    jefeLabel: "Jefe Faccionario",
    subjefeLabel: "Sub Jefe Faccionario",
    hasSubjefe: true,
  },
  ilegal: {
    color: 0x991b1b,
    nombre: "Facción Ilegal",
    jefeLabel: "Jefe Faccionario",
    subjefeLabel: "Sub Jefe Faccionario",
    hasSubjefe: true,
  },
  empresa: {
    color: 0xd97706,
    nombre: "Empresa",
    jefeLabel: "Jefe Empresarial",
    subjefeLabel: "",
    hasSubjefe: false,
  },
};

// ─── Cache de datos pendientes (Modal 1 + selecciones de Jefe) ────────────────
interface PendingInstData {
  tipo: "legal" | "ilegal" | "empresa";
  tituloForo: string;
  rolId: string;
  descripcion: string;
  linkServer: string;
  imageUrl?: string;
  jefeId?: string;
  subjefeId?: string;
  expiresAt: number;
}
const pendingInstData = new Map<string, PendingInstData>();

function savePendingData(userId: string, data: PendingInstData): void {
  pendingInstData.set(userId, data);
  const now = Date.now();
  for (const [k, v] of pendingInstData.entries()) {
    if (v.expiresAt < now) pendingInstData.delete(k);
  }
}

function updatePendingData(userId: string, updates: Partial<PendingInstData>): boolean {
  const existing = pendingInstData.get(userId);
  if (!existing) return false;
  pendingInstData.set(userId, { ...existing, ...updates });
  return true;
}

function popPendingData(userId: string): PendingInstData | null {
  const data = pendingInstData.get(userId) ?? null;
  if (data) pendingInstData.delete(userId);
  return data;
}

// ─── Permisos ─────────────────────────────────────────────────────────────────
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

// ─── Helper recursivo: busca values en árbol de componentes raw ───────────────
function searchCompValues(list: any[], targetId: string): string | null {
  for (const comp of list) {
    if (
      (comp.custom_id === targetId || comp.customId === targetId) &&
      Array.isArray(comp.values) &&
      comp.values[0]
    ) {
      return comp.values[0];
    }
    if (comp.component) {
      const r = searchCompValues([comp.component], targetId);
      if (r) return r;
    }
    if (comp.components && Array.isArray(comp.components)) {
      const r = searchCompValues(comp.components, targetId);
      if (r) return r;
    }
  }
  return null;
}

// ─── Builder del Container V2 de Institución ──────────────────────────────────
export function buildInstitucionContainer(
  guild: Guild | null,
  author: User,
  tipo: "legal" | "ilegal" | "empresa",
  tituloForo: string,
  rolId: string,
  descripcion: string,
  linkServer: string,
  jefeId?: string,
  subjefeId?: string,
  imageUrl?: string
): ContainerBuilder {
  const iconUrl = guild?.iconURL({ extension: "png", size: 256 }) ?? "";
  const c = TIPO_CONFIG[tipo];
  const roleDisplay = rolId ? `<@&${rolId}>` : "Rol Institucional";

  // Rol en texto normal (sin # grande ni emoji) + título en negrita
  const headerContent = `${roleDisplay}\n**${tituloForo}**`;

  const infoLines = [
    `📌 **Categoría:** \`${c.nombre}\``,
    `👤 **Publicado por:** ${author} (\`${author.tag}\`)`,
    jefeId ? `👑 **${c.jefeLabel}:** <@${jefeId}>` : "",
    subjefeId && c.subjefeLabel ? `⭐ **${c.subjefeLabel}:** <@${subjefeId}>` : "",
    linkServer
      ? `🔗 **Link Server:** ${linkServer.startsWith("http") ? linkServer : `https://${linkServer}`}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const descLines = [`📝 **Descripción e Información:**`, `>>> ${descripcion}`].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(c.color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(infoLines))
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(descLines));

  if (imageUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12,
      items: [{ media: { url: imageUrl } }],
      toJSON() {
        return { type: 12, items: [{ media: { url: imageUrl } }] };
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

// ─── /subir institucion — Comando principal ────────────────────────────────────
export async function handleSubirCommand(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand !== "institucion") return;

  if (!checkSubirPermissions(interaction.member)) {
    const errorContainer = buildErrorContainer(
      `Solo el personal autorizado (<@&${SUBIR_ROLES[0]}> / <@&${SUBIR_ROLES[1]}>) puede usar este comando.`,
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
        .setLabel("Facción Legal").setValue("legal")
        .setDescription("Publica una facción legal en el foro oficial").setEmoji("🏛️"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Facción Ilegal").setValue("ilegal")
        .setDescription("Publica una facción ilegal en el foro de actividades ilegales").setEmoji("💀"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Empresa").setValue("empresa")
        .setDescription("Publica una empresa en el canal de empresas").setEmoji("💼")
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  const iconUrl =
    interaction.guild?.iconURL({ extension: "png", size: 256 }) ??
    client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const container = new ContainerBuilder()
    .setAccentColor(0x3b82f6)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# 🏢 Registro de Institución\n**Selecciona la categoría a publicar:**")
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(row)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# SORP System · ${getFooterTimestamp()}`));

  await interaction.reply({
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  });
}

// ─── Select categoría → abre Modal 1 ─────────────────────────────────────────
export async function handleSubirSelectCategory(
  interaction: StringSelectMenuInteraction,
  client: Client
): Promise<void> {
  const tipo = interaction.values[0] as "legal" | "ilegal" | "empresa";

  if (!checkSubirPermissions(interaction.member)) {
    await interaction.reply({ content: "❌ No tienes permisos.", flags: MessageFlags.Ephemeral });
    return;
  }

  const titles = {
    legal: "Publicar Facción Legal — Paso 1/2",
    ilegal: "Publicar Facción Ilegal — Paso 1/2",
    empresa: "Publicar Empresa — Paso 1/2",
  };

  try {
    await client.rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
      body: {
        type: 9,
        data: {
          custom_id: `subir:modal1:${tipo}`,
          title: titles[tipo],
          components: [
            {
              type: 18, label: "Addfiles (1 Imagen de Portada)",
              description: "Adjunta imagen o logo de portada (Máx. 1 imagen)",
              component: { type: 19, custom_id: "inst_addfiles", min_values: 0, max_values: 1, required: false },
            },
            {
              type: 18, label: "Título Foro",
              component: { type: 4, custom_id: "inst_titulo_foro", style: 1, placeholder: "Ej. [Oficial] Policía Estatal de Sonora...", required: true, max_length: 100 },
            },
            {
              type: 18, label: "Rol Faccionario / Empresa",
              description: "Selecciona el rol que identificará al container",
              component: { type: 6, custom_id: "inst_rol_select", placeholder: "Elige el rol...", min_values: 1, max_values: 1 },
            },
            {
              type: 18, label: "Descripción Detallada",
              component: { type: 4, custom_id: "inst_descripcion", style: 2, placeholder: "Historia, requisitos, servicios...", required: true, max_length: 2400 },
            },
            {
              type: 18, label: "Link Server (Invitación Discord)",
              component: { type: 4, custom_id: "inst_link_server", style: 1, placeholder: "https://discord.gg/tu-comunidad", required: true, max_length: 200 },
            },
          ],
        },
      },
    });
  } catch (err) {
    console.error("[SUBIR] Fallback modal estándar Modal 1:", err);
    const modal = new ModalBuilder().setCustomId(`subir:modal1:${tipo}`).setTitle(titles[tipo]);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("inst_titulo_foro").setLabel("Título Foro").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("inst_rol_id").setLabel("ID del Rol Faccionario").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("inst_descripcion").setLabel("Descripción").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2400)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("inst_link_server").setLabel("Link Server").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)
      )
    );
    await interaction.showModal(modal);
  }
}

// ─── Modal 1 submit → guarda datos y abre Modal 2 (UserSelects) ───────────────
// IMPORTANTE: NO llamar deferReply/reply antes de abrir Modal 2,
// ya que eso consume el token de interacción.
export async function handleSubirModal1Submit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(":");
  const tipo = (parts[2] ?? "legal") as "legal" | "ilegal" | "empresa";

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Extraer imagen (Modal V2 rawInteractionStore)
  const attachmentsList = extractModalAttachments(interaction);
  const imageUrl = attachmentsList[0]?.url;

  // Extraer campos de texto
  const tituloForo = findModalFieldValue(interaction, "inst_titulo_foro") || "Institución Sin Título";
  const descripcion = findModalFieldValue(interaction, "inst_descripcion") || "Sin descripción.";
  const linkServer = findModalFieldValue(interaction, "inst_link_server") || "";

  const rawComponents = (interaction as any).data?.components ?? (interaction as any).components ?? [];
  let rolId = searchCompValues(rawComponents, "inst_rol_select") ?? findModalFieldValue(interaction, "inst_rol_id") ?? "";
  if (rolId.includes("<@&")) rolId = rolId.replace(/[^0-9]/g, "");

  // Guardar en caché (10 min)
  savePendingData(interaction.user.id, {
    tipo, tituloForo, rolId, descripcion, linkServer, imageUrl,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  console.log(`[SUBIR] Modal 1 guardado — tipo=${tipo}, rol=${rolId}, titulo="${tituloForo}"`);

  const c = TIPO_CONFIG[tipo];
  const iconUrl = interaction.guild?.iconURL({ extension: "png", size: 256 }) ?? "";

  // Paso 2: Mensaje efímero con UserSelects de Jefe / SubJefe y botón Publicar
  const stepContainer = new ContainerBuilder()
    .setAccentColor(c.color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## 👑 Paso 2/2 — Mandos de la Institución\n> Selecciona el **${c.jefeLabel}**${c.hasSubjefe ? ` y el **${c.subjefeLabel}**` : ""} abajo y luego haz clic en **Publicar**.`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`subir:jefe:${tipo}`)
          .setPlaceholder(`👑 Selecciona el ${c.jefeLabel}...`)
          .setMinValues(1).setMaxValues(1)
      )
    );

  if (c.hasSubjefe) {
    stepContainer.addActionRowComponents(
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`subir:subjefe:${tipo}`)
          .setPlaceholder(`⭐ Selecciona el ${c.subjefeLabel} (Opcional)...`)
          .setMinValues(0).setMaxValues(1)
      )
    );
  }

  stepContainer
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`subir:publish:${tipo}`)
          .setLabel("✅ Publicar Institución")
          .setStyle(ButtonStyle.Success)
      )
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# SORP System · ${getFooterTimestamp()}`));

  await interaction.editReply({ components: [stepContainer], flags: MessageFlags.IsComponentsV2 });
}

// ─── Modal 2 submit → publica la institución ─────────────────────────────────
export async function handleSubirModal2Submit(
  interaction: ModalSubmitInteraction,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(":");
  const tipo = (parts[2] ?? "legal") as "legal" | "ilegal" | "empresa";

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pending = popPendingData(interaction.user.id);
  if (!pending) {
    await interaction.editReply({
      content: "❌ Los datos del formulario anterior expiraron. Vuelve a usar `/subir institucion`.",
    });
    return;
  }

  const rawComponents = (interaction as any).data?.components ?? (interaction as any).components ?? [];
  const jefeId = searchCompValues(rawComponents, "inst_jefe") ?? undefined;
  const subjefeId = searchCompValues(rawComponents, "inst_subjefe") ?? undefined;

  console.log(`[SUBIR] Modal 2 recibido — tipo=${tipo}, jefe=${jefeId}, subjefe=${subjefeId}`);

  await publishInstitucion(interaction, client, pending, jefeId, subjefeId);
}

// ─── UserSelect: Jefe seleccionado (fallback) ────────────────────────────────
export async function handleSubirJefeSelect(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const parts = interaction.customId.split(":");
  const tipo = (parts[2] ?? "legal") as "legal" | "ilegal" | "empresa";
  const jefeId = interaction.values[0];

  const updated = updatePendingData(interaction.user.id, { jefeId });
  if (!updated) {
    await interaction.reply({
      content: "❌ Los datos expiraron. Vuelve a usar `/subir institucion`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const c = TIPO_CONFIG[tipo];
  await interaction.reply({
    content: `✅ **${c.jefeLabel}** guardado: <@${jefeId}>`,
    flags: MessageFlags.Ephemeral,
  });
}

// ─── UserSelect: Sub Jefe seleccionado (fallback) ────────────────────────────
export async function handleSubirSubjefeSelect(
  interaction: UserSelectMenuInteraction
): Promise<void> {
  const parts = interaction.customId.split(":");
  const tipo = (parts[2] ?? "legal") as "legal" | "ilegal" | "empresa";
  const subjefeId = interaction.values[0];

  const updated = updatePendingData(interaction.user.id, { subjefeId });
  if (!updated) {
    await interaction.reply({
      content: "❌ Los datos expiraron. Vuelve a usar `/subir institucion`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const c = TIPO_CONFIG[tipo];
  await interaction.reply({
    content: `✅ **${c.subjefeLabel}** guardado: <@${subjefeId}>`,
    flags: MessageFlags.Ephemeral,
  });
}

// ─── Botón: Publicar (fallback) ───────────────────────────────────────────────
export async function handleSubirPublishButton(
  interaction: ButtonInteraction,
  client: Client
): Promise<void> {
  const parts = interaction.customId.split(":");
  const tipo = (parts[2] ?? "legal") as "legal" | "ilegal" | "empresa";

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const pending = popPendingData(interaction.user.id);
  if (!pending) {
    await interaction.editReply({
      content: "❌ Los datos expiraron o no se encontraron. Vuelve a usar `/subir institucion`.",
    });
    return;
  }

  const c = TIPO_CONFIG[tipo];
  if (!pending.jefeId) {
    savePendingData(interaction.user.id, pending); // Restaurar para no perder datos
    await interaction.editReply({
      content: `❌ Debes seleccionar al **${c.jefeLabel}** antes de publicar.`,
    });
    return;
  }

  await publishInstitucion(interaction, client, pending, pending.jefeId, pending.subjefeId);
}

// ─── Función de publicación compartida ───────────────────────────────────────
async function publishInstitucion(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  client: Client,
  pending: PendingInstData,
  jefeId: string | undefined,
  subjefeId: string | undefined
): Promise<void> {
  const c = TIPO_CONFIG[pending.tipo];

  const container = buildInstitucionContainer(
    interaction.guild,
    interaction.user,
    pending.tipo,
    pending.tituloForo,
    pending.rolId,
    pending.descripcion,
    pending.linkServer,
    jefeId,
    subjefeId,
    pending.imageUrl
  );

  const targetChannelId = DEST_CHANNELS[pending.tipo];
  const targetChannel = await client.channels.fetch(targetChannelId).catch(() => null);

  if (!targetChannel) {
    await interaction.editReply({
      content: `❌ No se pudo encontrar el canal de destino (\`${targetChannelId}\`).`,
    });
    return;
  }

  try {
    if ((targetChannel as any).isThreadOnly?.() || (targetChannel as any).type === 15) {
      const forumChannel = targetChannel as import("discord.js").ForumChannel;
      const thread = await forumChannel.threads.create({
        name: pending.tituloForo.substring(0, 100),
        message: { components: [container], flags: MessageFlags.IsComponentsV2 as any },
      });
      console.log(`[SUBIR_INST] Hilo en foro (${pending.tipo}): ${thread.name} (${thread.id})`);
    } else if ((targetChannel as any).isTextBased?.()) {
      const textChannel = targetChannel as import("discord.js").TextChannel;
      await textChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2 as any,
      });
      console.log(`[SUBIR_INST] Publicado en canal (${pending.tipo}): ${targetChannelId}`);
    }
  } catch (pubErr) {
    console.error("[SUBIR_INST] Error publicando:", pubErr);
    await interaction.editReply({ content: `❌ Error al publicar en <#${targetChannelId}>.` });
    return;
  }

  const confirmText = [
    `✅ **¡Institución publicada exitosamente!**`,
    `› **Categoría:** \`${c.nombre}\``,
    `› **Título:** \`${pending.tituloForo}\``,
    `› **Rol:** ${pending.rolId ? `<@&${pending.rolId}>` : "`Sin rol`"}`,
    jefeId ? `› **${c.jefeLabel}:** <@${jefeId}>` : "",
    subjefeId ? `› **${c.subjefeLabel}:** <@${subjefeId}>` : "",
    `› **Canal/Foro Destino:** <#${targetChannelId}>`,
  ]
    .filter(Boolean)
    .join("\n");

  const successContainer = buildSuccessContainer("🏢 Publicación Completada", confirmText, client);
  await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
}
