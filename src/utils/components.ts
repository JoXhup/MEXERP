import {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  SeparatorSpacingSize,
  type Client,
} from "discord.js";
import type { ITicket } from "../models/Ticket.js";
import { CATEGORIES, CATEGORY_ORDER } from "../constants/categories.js";
import { config } from "../config.js";

// ─── HELPERS DE FECHA ──────────────────────────────────────────────────────────
export function getFooterTimestamp(): string {
  const now = new Date();
  const date = now.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

// ─── PRIORIDAD DISPLAY ─────────────────────────────────────────────────────────
export const PRIORITY_DISPLAY: Record<string, { label: string }> = {
  low:      { label: "Baja"    },
  medium:   { label: "Media"   },
  high:     { label: "Alta"    },
  critical: { label: "Critica" },
};

// ─── PANEL PRINCIPAL (COMPONENTS V2 CONTAINER) ────────────────────────────────
export function buildPanelContainer(client: Client, guildIconUrl?: string, bannerUrl?: string): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  // Opciones del select menu con las 17 categorías
  const options = CATEGORY_ORDER.map(catId => {
    const cat = CATEGORIES[catId]!;
    return new StringSelectMenuOptionBuilder()
      .setLabel(cat.label)
      .setDescription(cat.description)
      .setValue(catId)
      .setEmoji(cat.emoji);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket:select_category")
    .setPlaceholder("❗Selecciona la opccion que se acomode a tu solicitud.")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  const headerText =
    "# ❗ Soporte & Ayuda - SORP\n**Bienvenid@** al apartado de ayuda y atencion a los usuarios de forma **OOC**, revisa con lo que podemos ayudarte y auxiliarte para tu mejor atencion.";

  const politicaText = [
    "Antes de abrir ticket te recordamos nuestra politica de actitud y comportamiento en el soporte con el **equipo de moderacion.**",
    "* No se permiten actitudes grotescas & comportamientos negativos, todo usuario debera mantener una actitud respetuosa y acorde al reglamento de ética del servidor.",
    "",
    "* Todo usuario tiene derecho a recibir atención respetuosa de parte del **staff**, un ticket no puede durar menos de 12hrs sin ser atendido.",
  ].join("\n");

  const faqText = [
    "**Dudas & FAQ**",
    "",
    "Si tu ticket es para alguna duda relacionada al servidor, puede revisar estos enlaces:",
    "",
    "**Tabla de Sanciones:**",
    "[Ver](https://discord.com/channels/1528571127352262866/1531094184142831698)",
    "",
    "**Reglamento:**",
    "[Ver](https://discord.com/channels/1528571127352262866/1528865749987491990)",
    "",
    "**Rol Server:**",
    "[Ver](https://discord.gg/YhJcq4Mx7G)",
  ].join("\n");

  const soporteText =
    "Si tienes problemas con el funcionamiento del sistema puedes consultar con un **STAFF** via general para ser auxiliado.";

  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2); // Azul-morado Blurple

  container
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(headerText)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(iconUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(politicaText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(faqText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(soporteText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(selectRow);

  // Si se proporciona un banner (ej: attachment://ticketsupport.png), se agrega MediaGallery abajo
  if (bannerUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12, // MediaGallery ComponentType
      items: [{ media: { url: bannerUrl } }],
      toJSON() {
        return {
          type: 12,
          items: [{ media: { url: bannerUrl } }],
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

// ─── PANEL DE JORNADAS STAFF (CHANNEL 1528869236687110215) ─────────────────
export function buildJornadasPanelContainer(client: Client, guildIconUrl?: string): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const startBtn = new ButtonBuilder()
    .setCustomId("jornada:start")
    .setLabel("Iniciar Turno")
    .setEmoji("✅")
    .setStyle(ButtonStyle.Success);

  const manageBtn = new ButtonBuilder()
    .setCustomId("jornada:manage")
    .setLabel("Gestionar")
    .setEmoji("⚙️")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(startBtn, manageBtn);

  return new ContainerBuilder()
    .setAccentColor(0x7c3aed) // Morado
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# Jornadas Staff\n> Inicia tu turno administrativo para moderar.")
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(iconUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("**Instrucciones**")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Para iniciar tu jornada da click en el boton **✅ Iniciar Turno**")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Para gestionar tu jornada da click en el boton **⚙️ Gestionar**")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Para realizar un breve descanso pulsa en el boton **⏸️ Pausar** y para reincorporarte da click en el boton **⏯️ Volver**")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("El boton **❗ Finalizar** para terminar tu tiempo de moderacion.")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Si tienes dudas en el funcionamiento comunicate con un administrador.")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(row)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora RP Staff`)
    );
}


// ─── PANEL DE GESTIÓN DE APERTURAS (CHANNEL 1532163697559208027) ─────────────
export function buildAperturasPanelContainer(client: Client, guildIconUrl?: string): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const abrirBtn = new ButtonBuilder()
    .setCustomId("apertura:abrir")
    .setLabel("Abrir")
    .setEmoji("🟢")
    .setStyle(ButtonStyle.Success);

  const mantenimientoBtn = new ButtonBuilder()
    .setCustomId("apertura:mantenimiento")
    .setLabel("Mantenimiento")
    .setEmoji("🟡")
    .setStyle(ButtonStyle.Secondary);

  const cierreBtn = new ButtonBuilder()
    .setCustomId("apertura:cierre")
    .setLabel("Cierre")
    .setEmoji("🔴")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(abrirBtn, mantenimientoBtn, cierreBtn);

  return new ContainerBuilder()
    .setAccentColor(0x3b82f6) // Azul
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "# Gestion de Aperturas\n*Usalo para manipular el estado del servidor en ER:LC*\n> Este sistema actualmente es manipulado en discord, no tiene ningun efecto en ERLC."
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(iconUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("🟢 Envia la notificacion de apertura del servidor")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("🟡 Mantenimiento del servidor")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("🔴 Cierre del servidor")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Usalo correctamente, el mal uso sera sancionado.")
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(row)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora RP Staff`)
    );
}


// ─── HELPER COLOR ALEATORIO ───────────────────────────────────────────────────
export function getRandomColor(): number {
  const colors = [
    0x7c3aed, // Morado
    0x3b82f6, // Azul
    0x10b981, // Verde
    0xf59e0b, // Naranja
    0xec4899, // Rosa
    0x8b5cf6, // Violeta
    0x06b6d4, // Cyan
    0x10b981, // Esmeralda
  ];
  return colors[Math.floor(Math.random() * colors.length)]!;
}

// ─── CONTAINER DEL TICKET ─────────────────────────────────────────────────────
export function buildTicketContainer(
  ticket: ITicket,
  client: Client,
  guildIconUrl?: string,
): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
  const cat = CATEGORIES[ticket.category]!;

  const rolePings = cat.pingRoleIds.map(id => `<@&${id}>`).join(" / ");
  const headerText = `# ${cat.emoji} ${cat.label} - Sonora RP\n**Bienvenid@** <@${ticket.ownerId}>, su solicitud fue creada con exito, espere a un miembro de la administracion atienda el ticket (${rolePings}).`;

  // Información de tu Ticket
  const infoLines: string[] = ["📝 **Información de tu Ticket:**"];
  const imageUrls: string[] = [];

  // Campos del modal (solo si el usuario rellenó información)
  for (const [key, value] of ticket.modalData) {
    if (!value || !value.trim()) continue; // Si es opcional y no puso nada, no aparece
    const fieldDef = cat.fields.find(f => f.customId === key);
    const label = fieldDef?.label ?? (key === "tipo_ck" ? "Tipo de CK" : key);

    const lines = value.split("\n").map(l => l.trim()).filter(Boolean);
    const urls = lines.filter(l => l.startsWith("attachment://") || l.startsWith("http://") || l.startsWith("https://"));

    if (urls.length > 0) {
      imageUrls.push(...urls);
      infoLines.push(`**${label}:**\n* ${urls.length} archivo(s) adjunto(s)`);
    } else {
      infoLines.push(`**${label}:**\n* ${value.trim()}`);
    }
  }

  // Usuario
  infoLines.push(`**Usuario:**\n* <@${ticket.ownerId}>`);

  // Registro (Fecha)
  const openedTimestamp = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
  infoLines.push(`**Registro (Fecha):**\n* <t:${openedTimestamp}:f>`);

  // Estado
  const statusText = ticket.claimedBy
    ? `* 🟢 Atendido por <@${ticket.claimedBy}>`
    : `* 🟡 Espera de atención`;
  infoLines.push(`**Estado:**\n${statusText}`);

  // Botón Reclamar con estado
  const claimBtn = new ButtonBuilder()
    .setCustomId(`ticket:claim:${ticket.channelId}`)
    .setEmoji("✅");

  if (ticket.claimedBy) {
    claimBtn
      .setLabel(`Reclamado por ${ticket.claimedByTag ?? "Staff"}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);
  } else {
    claimBtn
      .setLabel("Reclamar")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false);
  }

  const claimRow = new ActionRowBuilder<ButtonBuilder>().addComponents(claimBtn);

  // Select menu con las opciones de Cerrar / Agregar / Retirar Usuario
  const managementSelect = new StringSelectMenuBuilder()
    .setCustomId(`ticket:management:${ticket.channelId}`)
    .setPlaceholder("Opciones de gestión del ticket...")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Cerrar")
        .setValue("close")
        .setEmoji("🔒")
        .setDescription("Cierra este ticket y genera la transcripción"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Agregar / Retirar Usuario")
        .setValue("add_remove_user")
        .setEmoji("👤")
        .setDescription("Gestiona los usuarios con acceso a este ticket"),
    );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(managementSelect);

  const isRolCategory = [
    "area_rol",
    "control_rol",
    "solicitud_rp",
    "solicitud_ck",
    "solicitud_rol",
    "retiro_rol",
    "robos_ic",
  ].includes(ticket.category);

  // Container naranja para tickets de ROL, aleatorio para los demas
  const containerColor = isRolCategory ? 0xf97316 : getRandomColor();

  const container = new ContainerBuilder()
    .setAccentColor(containerColor)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(headerText)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(iconUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(infoLines.join("\n"))
    );

  // Si hay imágenes subidas, agregamos MediaGallery arriba del botón Reclamar y la línea separadora
  if (imageUrls.length > 0) {
    console.log("[CONTAINER] Agregando imágenes a MediaGallery:", imageUrls);
    const galleryItems = imageUrls.slice(0, 10).map(url => ({ media: { url } }));
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
    .addActionRowComponents(claimRow)
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(selectRow)
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora RP System · ${getFooterTimestamp()}`)
    );

  return container;
}

// ─── CONTAINER DE LOG ─────────────────────────────────────────────────────────
export function buildLogContainer(
  action: string,
  description: string,
  fields: { name: string; value: string }[],
  client: Client,
): ContainerBuilder {
  const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";
  const fieldsText = fields.map(f => `**${f.name}:** ${f.value}`).join("\n");

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## ${action}\n${description}`
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(fieldsText)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Sonora RP System · ${getFooterTimestamp()}`
      )
    );
}

// ─── CONTAINER DE ERROR ───────────────────────────────────────────────────────
export function buildErrorContainer(
  message: string,
  client: Client,
): ContainerBuilder {
  const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";

  return new ContainerBuilder()
    .setAccentColor(0xef4444) // Rojo — Error / Sin Permisos
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ❌ Permisos Insuficientes / Error\n${message}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Sonora RP System · ${getFooterTimestamp()}`
      )
    );
}

// ─── CONTAINER DE EXITO ───────────────────────────────────────────────────────
export function buildSuccessContainer(
  title: string,
  message: string,
  client: Client,
): ContainerBuilder {
  const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${title}\n${message}`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Sonora RP System · ${getFooterTimestamp()}`
      )
    );
}

// ─── CONTAINER DE PRIORIDAD ───────────────────────────────────────────────────
export function buildPrioritySelectContainer(
  channelId: string,
  client: Client,
): ContainerBuilder {
  const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const lowBtn = new ButtonBuilder()
    .setCustomId(`ticket:setpriority:${channelId}:low`)
    .setLabel("Baja")
    .setStyle(ButtonStyle.Secondary);

  const medBtn = new ButtonBuilder()
    .setCustomId(`ticket:setpriority:${channelId}:medium`)
    .setLabel("Media")
    .setStyle(ButtonStyle.Primary);

  const highBtn = new ButtonBuilder()
    .setCustomId(`ticket:setpriority:${channelId}:high`)
    .setLabel("Alta")
    .setStyle(ButtonStyle.Danger);

  const critBtn = new ButtonBuilder()
    .setCustomId(`ticket:setpriority:${channelId}:critical`)
    .setLabel("Critica")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(lowBtn, medBtn, highBtn, critBtn);

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## Cambiar Prioridad\nSelecciona la nueva prioridad para este ticket.`
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    )
    .addActionRowComponents(row)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Sonora RP System · ${getFooterTimestamp()}`
      )
    );
}

// ─── CONTAINER DE ESTADISTICAS ────────────────────────────────────────────────
export function buildStatsContainer(
  stats: Array<{
    userTag: string;
    totalClaimed: number;
    totalClosed: number;
    totalTranscripts: number;
  }>,
  client: Client,
): ContainerBuilder {
  const avatarUrl = client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const rows = stats
    .map(
      (s, i) =>
        `**${i + 1}.** ${s.userTag} — Reclamados: **${s.totalClaimed}** · Cerrados: **${s.totalClosed}** · Transcripciones: **${s.totalTranscripts}**`
    )
    .join("\n");

  return new ContainerBuilder()
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `## Estadisticas del Staff\nRanking basado en actividad en tickets.`
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(SeparatorSpacingSize.Small)
        .setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(rows || "Sin datos registrados.")
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Sonora RP System · ${getFooterTimestamp()}`
      )
    );
}

export function formatShiftTime(ms?: number): string {
  if (!ms || ms <= 0) return "0";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function buildStaffProfileContainer(
  targetMember: import("discord.js").GuildMember,
  processedCount: number,
  robloxName: string | null,
  hiredAt: Date | null,
  client: Client,
  totalShiftTimeMs?: number,
  activeWarnsCount?: number,
  ratingCount?: number,
  ratingSum?: number,
): ContainerBuilder {
  const userAvatar = targetMember.user.displayAvatarURL({ size: 256 });

  const HIERARCHY_ROLES = [
    "1528876703450136737",
    "1528876795783282880",
    "1529312367706378341",
    "1529312300207443978",
    "1529322176757628970",
    "1531855122634772630",
    "1531420532753305853",
    "1531835160222503123",
    "1531825255889506506",
  ];

  const matchingRoleId = HIERARCHY_ROLES.find(roleId => targetMember.roles.cache.has(roleId));

  const rangoDisplay = matchingRoleId
    ? `<@&${matchingRoleId}>`
    : (targetMember.roles.highest && targetMember.roles.highest.id !== targetMember.guild.id
        ? `<@&${targetMember.roles.highest.id}>`
        : "Sin Rango");

  const robloxText = robloxName ? `**${robloxName}**` : "*Sin registro*";

  const fechaIngresoText = hiredAt
    ? `<t:${Math.floor(hiredAt.getTime() / 1000)}:F>`
    : "*Sin fecha de contratacion.*";

  const infoStaffText = [
    "**Informacion del staff:**",
    `* <:discotoolsxyzicon4:1532137819726675968> Usuario:\n<@${targetMember.id}> (@${targetMember.user.username})`,
    `* <:discotoolsxyzicon5:1532137818652934324> Roblox user vinculado:\n${robloxText}`,
    `* <:discotoolsxyzicon2:1532137821949923569> Fecha de Ingreso:\n${fechaIngresoText}`,
    `* <:discotoolsxyzicon6:1532137817843437741> Rango:\n${rangoDisplay}`,
  ].join("\n");

  const horasDisplay = formatShiftTime(totalShiftTimeMs);

  const avgRating = (ratingCount && ratingCount > 0 && ratingSum) ? (ratingSum / ratingCount) : 0;
  const ratingStars = avgRating > 0 ? "⭐".repeat(Math.round(avgRating)) : "";
  const ratingText = (ratingCount && ratingCount > 0)
    ? `${ratingStars} **${avgRating.toFixed(1)} / 5.0** (${ratingCount} evaluaciones)`
    : "*Sin evaluaciones aún*";

  const statsText = [
    "**Estadisticas:**",
    `* <:discotoolsxyzicon3:1532137821077504020> Tickets Atendidos:\n${processedCount}`,
    `* <:discotoolsxyzicon8:1532141321198764093> Horas Realizadas:\n${horasDisplay}`,
    `* ⭐ Calificación Promedio:\n${ratingText}`,
  ].join("\n");

  const advertenciasDisplay = (activeWarnsCount && activeWarnsCount > 0)
    ? `🔴 **${activeWarnsCount}** advertencia(s) administrativa(s) activa(s)`
    : "*Sin registro de advertencias administrativas*";

  const sancionesText = [
    "**Sanciones:**",
    `* <:discotoolsxyzicon7:1532137816832606449> Advertencias:\n${advertenciasDisplay}`,
  ].join("\n");

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`stats:menu:${targetMember.id}`)
    .setPlaceholder("📋 Navegar a...")
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Perfil Revisar")
        .setDescription("Muestra el perfil completo del miembro del staff")
        .setValue("perfil_revisar")
        .setEmoji("👤"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Estadísticas Generales")
        .setDescription("Muestra las estadísticas y calificación del miembro")
        .setValue("estadisticas_generales")
        .setEmoji("📊"),
      new StringSelectMenuOptionBuilder()
        .setLabel("Sanciones Administrativas")
        .setDescription("Muestra el historial de sanciones del miembro")
        .setValue("sanciones_administrativas")
        .setEmoji("⚠️"),
    );

  return new ContainerBuilder()
    .setAccentColor(getRandomColor())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent("# Perfil Administrativo")
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(userAvatar)
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(infoStaffText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(statsText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sancionesText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Sonora RP Staff · ${getFooterTimestamp()}`)
    );
}

// ─── PANEL TABLA DE SANCIONES / WARN LIST (COMPONENTS V2 CONTAINER) ─────────
export const WARN_LIST_ROLE_ID = "1532578233973739732";

export function buildWarnListPanelContainer(
  client: Client,
  guildIconUrl?: string,
  bannerUrl?: string,
): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const headerContent = `# ❗ WARN LIST · TABLA DE SANCIONES\n**Reglamento Oficial de Sanciones Administrativas & Modales de Rol — Sonora RP**`;

  const group1 = [
    "### 📜 Sanciones & Modales de Rol",
    "",
    "**Fail RP (Leve)**",
    "🔒 **Lockup:** 1 día",
    "",
    "**Meta Gaming (MG)**",
    "⚠️ **Warn**",
    "",
    "**Power Gaming (PG)**",
    "⚠️ **Warn**",
    "",
    "**No Valorar Vida del Personaje (NVPJ)**",
    "🔒 **Lockup:** 1 día + warn",
    "",
    "**Revenge Kill (RK)**",
    "🔒 **Lockup:** 30 minutos",
    "",
    "**Random Deathmatch (RDM)**",
    "🔒 **Lockup:** 1 hora",
  ].join("\n");

  const group2 = [
    "**PG2**",
    "🔒 **Lockup:** 60 minutos",
    "",
    "**Toxicidad Leve**",
    "⚠️ **Warn**",
    "",
    "**Insultos Graves**",
    "🔒 **Lockup:** 1 día a 5 días *(depende de la gravedad)*",
    "",
    "**Abuso de Vacío Legal o Bugs**",
    "⚠️ Warn o lockup de 5 horas a 1 día *(según la gravedad)*",
    "",
    "**Uso de Cheats o Hacks**",
    "🚫 **Ban Permanente**",
    "",
    "**Evasión de Sanción (Ban Evading)**",
    "🔒 **Lockup:** 3 horas",
  ].join("\n");

  const footerSection = `**Revisado por:** <@&${WARN_LIST_ROLE_ID}>`;

  const container = new ContainerBuilder()
    .setAccentColor(0xf97316) // Naranja brillante
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
      new TextDisplayBuilder().setContent(group1)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(group2)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(footerSection)
    );

  if (bannerUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12, // MediaGallery
      items: [{ media: { url: bannerUrl } }],
      toJSON() {
        return {
          type: 12,
          items: [{ media: { url: bannerUrl } }],
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

// ─── PANEL NORMATIVA GENERAL (COMPONENTS V2 CONTAINER) ────────────────────────
export function buildNormativaPanelContainer(
  client: Client,
  guildIconUrl?: string,
  bannerUrl?: string,
): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const headerContent = `# 📜 NORMATIVA GENERAL\n**Reglamento Oficial & Normas de la Comunidad — Sonora RP**`;

  const bodyContent = [
    "En este documento encontrarás la normativa general que rige dentro de **Sonora RP**, incluyendo conceptos de Roleplay, normativa legal e ilegal, uso de armas, comandos `/me` y `/do`, normas de Discord y sistema de sanciones.",
    "",
    "Su lectura y cumplimiento es **obligatorio** para todos los miembros de la comunidad, independientemente de su rango o función.",
    "",
    "*El desconocimiento de la normativa no exime de su cumplimiento ni de las sanciones correspondientes.*",
  ].join("\n");

  const linkButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Normativa General")
      .setStyle(ButtonStyle.Link)
      .setURL("https://docs.google.com/document/d/1bJxwBK7E1NH4QETysCzsRS_EkeRcDPIMclDF0AsbfEM/edit?tab=t.0")
      .setEmoji("📁")
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x3b82f6) // Azul rey / Blurple elegante
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
      new TextDisplayBuilder().setContent(bodyContent)
    );

  if (bannerUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12, // MediaGallery
      items: [{ media: { url: bannerUrl } }],
      toJSON() {
        return {
          type: 12,
          items: [{ media: { url: bannerUrl } }],
        };
      },
    });
  }

  container
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addActionRowComponents(linkButtonRow)
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# SORP System · ${getFooterTimestamp()}`)
    );

  return container;
}

// ─── PANEL INTRODUCCIÓN / OUR-INFO (COMPONENTS V2 CONTAINER) ─────────────────
export function buildIntroduccionPanelContainer(
  client: Client,
  guildIconUrl?: string,
  bannerUrl?: string,
): ContainerBuilder {
  const iconUrl = guildIconUrl ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";

  const headerContent = `# 📘 OUR-INFO · INTRODUCCIÓN\n**Guía Informativa Oficial de la Comunidad — Sonora RP**`;

  const sec1 = [
    "### 1.1 | ¿Cómo me puedo verificar?",
    "Para verificarte, dirígete al canal <#1528973867362812024> y presiona el botón **Verificar**. Posteriormente, introduce tu **usuario de Roblox** y confirma que la información proporcionada sea correcta.",
    "",
    "Una vez completado el proceso, el bot de **SONORA RP** verificará automáticamente tu cuenta, asignará los roles correspondientes y te otorgará acceso como **Ciudadano Mexicano** dentro de nuestro servidor de Discord.",
  ].join("\n");

  const sec2 = [
    "### 1.2 | ¿Cómo puedo comprar?",
    "Para realizar una **compra benéfica o publicitaria**, dirígete al canal <#1528868846906114321> y abre un ticket. Posteriormente, presiona el botón **Sección** y selecciona la categoría **IRL**.",
    "",
    "Un encargado del área de **Marketing** se pondrá en contacto contigo para conocer tu solicitud, resolver tus dudas y gestionar el proceso de compra correspondiente.",
  ].join("\n");

  const sec3 = [
    "### 1.3 | ¿Cómo entro a Roblox?",
    "Para ingresar a nuestro servidor de Roblox, primero debes acceder a **Liberty County (ER:LC)**.",
    "",
    "Una vez dentro del juego:",
    "1. Abre el menú lateral ubicado en la parte derecha de la pantalla.",
    "2. Selecciona la opción **Servidores**.",
    "3. Presiona **Unirse por código**.",
    "4. Introduce el código **SORPA**.",
    "5. Confirma tu ingreso al servidor.",
    "",
    "También puedes acceder mediante el **Listado de servidores**, buscando **MX SONORA RP**. Una vez localizado, podrás unirte directamente y comenzar tu experiencia de roleplay.",
  ].join("\n");

  const sec4 = [
    "### 1.4 | ¿Cómo gestiono mi economía?",
    "Para gestionar tu economía dentro de **SONORA RP**, dirígete al canal <#1533672379786723398> y utiliza los comandos indicados en los **MENSAJES FIJADOS**.",
    "",
    "Actualmente, encontrarás los siguientes comandos:",
    "* `/estado monetario`",
    "* `/cobrar`",
    "* `/depositar`",
    "* `/estado ilegal`",
    "* `/historial`",
    "* `/lavar`",
    "* `/retirar`",
    "* `/transferir`",
    "* `/transferencias`",
    "",
    "> Cada comando cumple una función específica y te permitirá administrar diferentes aspectos de tu economía dentro del servidor.",
  ].join("\n");

  const sec5 = [
    "### 1.5 | ¿Cómo creo una facción legal, ilegal o empresa?",
    "Si deseas crear una **Facción Legal**, **Facción Ilegal** o **Empresa**, dirígete al canal <#1528868846906114321> y accede al apartado **Empresas y Facciones**.",
    "",
    "Una vez abierto el ticket, un encargado del área correspondiente atenderá tu solicitud y te proporcionará el **formato, requisitos y procedimiento** necesarios para comenzar el proceso de verificación.",
    "",
    "> Toda facción o empresa deberá cumplir con los requisitos establecidos antes de ser aprobada oficialmente.",
  ].join("\n");

  const sec6 = [
    "### 1.6 | ¿Cómo me uno a una facción o empresa?",
    "Para formar parte de una facción o empresa, dirígete a la categoría **EMPLEOS**.",
    "",
    "Dentro de esta categoría encontrarás los espacios correspondientes a:",
    "* **Facciones Legales**",
    "* **Facciones Ilegales**",
    "* **Empresas**",
    "",
    "En cada apartado podrás consultar las organizaciones disponibles, sus requisitos y la información necesaria para postularte.",
    "",
    "Para ingresar a una facción o empresa, deberás realizar la **convocatoria, solicitud o postulación** indicada por la organización correspondiente y esperar a que sus responsables revisen tu solicitud.",
  ].join("\n");

  const sec7 = [
    "### 1.7 | ¿Cómo me uno al Staff de SORP?",
    "Si deseas formar parte del **Staff de SORP**, deberás cumplir con los requisitos establecidos para la convocatoria correspondiente.",
    "",
    "Las convocatorias y requisitos se publican en el canal <#1528868451517599784>. Antes de enviar tu solicitud, asegúrate de cumplir correctamente con cada uno de los requisitos indicados.",
    "",
    "Una vez enviada tu postulación, deberás esperar a que un integrante de **Recursos Humanos (RR. HH.)** revise tu solicitud.",
    "",
    "Si tu postulación cumple con los requisitos establecidos, será aceptada y podrás continuar con las siguientes etapas del proceso de selección.",
    "",
    "> Recuerda que enviar una postulación no garantiza tu ingreso al Staff. Todas las solicitudes están sujetas a revisión y selección por parte de Recursos Humanos.",
  ].join("\n");

  const container = new ContainerBuilder()
    .setAccentColor(0xff1493) // Rosado fuerte / Hot Pink
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
      new TextDisplayBuilder().setContent(sec1)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sec2)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sec3)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sec4)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sec5)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sec6)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(sec7)
    );

  if (bannerUrl) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
    );
    (container as any).components.push({
      type: 12, // MediaGallery
      items: [{ media: { url: bannerUrl } }],
      toJSON() {
        return {
          type: 12,
          items: [{ media: { url: bannerUrl } }],
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
