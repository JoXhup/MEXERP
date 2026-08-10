import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, } from "discord.js";
import { Shift } from "../models/Shift.js";
import { StaffStats } from "../models/StaffStats.js";
import { formatShiftTime } from "../utils/components.js";
const STAFF_SHIFT_ROLE = "1531855122634772630";
const SHIFT_LOG_THREAD_ID = "1532150320409346088";
/** Detecta el dispositivo utilizado por el miembro */
function getDeviceDisplay(member) {
    if (!member || !member.presence)
        return "💻 Computadora / PC";
    const status = member.presence.clientStatus;
    if (status?.mobile)
        return "📱 Celular / Móvil";
    if (status?.web)
        return "🌐 Web";
    return "💻 Computadora / PC";
}
/** Embed de error eférmero estilizado */
function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle(`❌ ${title}`)
        .setDescription(description);
}
export async function handleJornadaButton(interaction, client) {
    const parts = interaction.customId.split(":");
    const action = parts[1]; // start, manage, pause, resume, end
    const guild = interaction.guild;
    const member = guild?.members.cache.get(interaction.user.id);
    const canUse = member?.roles.cache.has(STAFF_SHIFT_ROLE) ||
        member?.permissions.has(PermissionFlagsBits.Administrator);
    if (!canUse) {
        await interaction.reply({
            embeds: [errorEmbed("Sin Permisos", "No cuentas con el rol o permisos requeridos para iniciar o gestionar jornadas de staff.\n\nContacta a un administrador si crees que esto es un error.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    switch (action) {
        case "start": return handleStart(interaction, client);
        case "manage": return handleManage(interaction, client);
        case "pause": return handlePause(interaction, client);
        case "resume": return handleResume(interaction, client);
        case "end": return handleEnd(interaction, client);
    }
}
// ─── INICIAR TURNO ─────────────────────────────────────────────────────────────
async function handleStart(interaction, client) {
    const existingShift = await Shift.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        active: true,
    });
    if (existingShift) {
        await interaction.reply({
            embeds: [errorEmbed("Jornada ya Activa", "Ya tienes una jornada en curso en este momento.\n\nPresiona el botón **⚙️ Gestionar** para ver el estado de tu turno, pausarlo o finalizarlo.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const device = getDeviceDisplay(member ?? null);
    await Shift.create({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        startTime: new Date(),
        status: "active",
        pausedTimeMs: 0,
        pauseStartTime: null,
        device,
        active: true,
    });
    const nowTs = Math.floor(Date.now() / 1000);
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(0x10b981)
                .setTitle("✅ Jornada Iniciada")
                .setDescription([
                `Tu turno administrativo ha comenzado correctamente.`,
                ``,
                `**🕐 Hora de inicio:** <t:${nowTs}:F> (<t:${nowTs}:R>)`,
                `**${device.split(" ")[0]} Dispositivo:** ${device.replace(/^[^ ]+ /, "")}`,
                ``,
                `Cuando quieras pausar o finalizar tu turno, usa el botón **⚙️ Gestionar** en el panel.`,
            ].join("\n"))
        ],
        flags: MessageFlags.Ephemeral,
    });
}
// ─── GESTIONAR JORNADA ─────────────────────────────────────────────────────────
async function handleManage(interaction, client) {
    const shift = await Shift.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        active: true,
    });
    if (!shift) {
        await interaction.reply({
            embeds: [errorEmbed("Sin Jornada Activa", "No tienes ninguna jornada activa en este momento.\n\nHaz clic en **✅ Iniciar Turno** en el panel para comenzar tu turno administrativo.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const startTimestamp = Math.floor(shift.startTime.getTime() / 1000);
    const isPaused = shift.status === "paused";
    const statusText = isPaused ? "⏸️ En Pausa" : "🟢 En Servicio";
    const statusColor = isPaused ? 0xf59e0b : 0x7c3aed;
    const togglePauseBtn = isPaused
        ? new ButtonBuilder().setCustomId("jornada:resume").setLabel("Volver").setEmoji("⏯️").setStyle(ButtonStyle.Success)
        : new ButtonBuilder().setCustomId("jornada:pause").setLabel("Pausar").setEmoji("⏸️").setStyle(ButtonStyle.Secondary);
    const endBtn = new ButtonBuilder()
        .setCustomId("jornada:end")
        .setLabel("Finalizar")
        .setEmoji("❗")
        .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(togglePauseBtn, endBtn);
    const container = new ContainerBuilder()
        .setAccentColor(statusColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚙️ Gestión de Jornada`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**Estado actual:**  ${statusText}`,
        `**👤 Staff:**  <@${interaction.user.id}> (@${interaction.user.username})`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**📅 Inicio de turno:**`,
        `<t:${startTimestamp}:F>  (<t:${startTimestamp}:R>)`,
        ``,
        `**${shift.device.split(" ")[0]} Dispositivo:**`,
        shift.device,
        ``,
        `**⏸️ Tiempo pausado acumulado:**`,
        formatShiftTime(shift.pausedTimeMs) || "0",
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(row)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff`));
    await interaction.reply({
        // @ts-ignore — Components V2
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
}
// ─── PAUSAR JORNADA ────────────────────────────────────────────────────────────
async function handlePause(interaction, client) {
    const shift = await Shift.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        active: true,
    });
    if (!shift) {
        await interaction.reply({
            embeds: [errorEmbed("Sin Jornada Activa", "No tienes una jornada activa que pausar.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (shift.status === "paused") {
        await interaction.reply({
            embeds: [errorEmbed("Ya en Pausa", "Tu jornada ya se encuentra en pausa.\nUsa **⏯️ Volver** para reincorporarte.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    shift.status = "paused";
    shift.pauseStartTime = new Date();
    await shift.save();
    const startTs = Math.floor(shift.startTime.getTime() / 1000);
    const pauseTs = Math.floor(Date.now() / 1000);
    const resumeBtn = new ButtonBuilder()
        .setCustomId("jornada:resume")
        .setLabel("Volver")
        .setEmoji("⏯️")
        .setStyle(ButtonStyle.Success);
    const endBtn = new ButtonBuilder()
        .setCustomId("jornada:end")
        .setLabel("Finalizar")
        .setEmoji("❗")
        .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(resumeBtn, endBtn);
    const container = new ContainerBuilder()
        .setAccentColor(0xf59e0b)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# ⏸️ Turno en Pausa"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `**Pausaste tu jornada a las <t:${pauseTs}:t>**`,
        ``,
        `**📅 Inicio de turno:** <t:${startTs}:F>`,
        `**${shift.device.split(" ")[0]} Dispositivo:** ${shift.device}`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("Presiona **⏯️ Volver** cuando te reincorpores a moderar."))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(row)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff`));
    await interaction.update({
        // @ts-ignore — Components V2
        components: [container],
        embeds: [],
    });
}
// ─── REINCORPORARSE (VOLVER) ──────────────────────────────────────────────────
async function handleResume(interaction, client) {
    const shift = await Shift.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        active: true,
    });
    if (!shift) {
        await interaction.reply({
            embeds: [errorEmbed("Sin Jornada Activa", "No tienes una jornada activa.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (shift.status !== "paused" || !shift.pauseStartTime) {
        await interaction.reply({
            embeds: [errorEmbed("Sin Pausa Activa", "Tu jornada no está pausada actualmente.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const pauseDuration = Date.now() - shift.pauseStartTime.getTime();
    shift.pausedTimeMs += pauseDuration;
    shift.status = "active";
    shift.pauseStartTime = null;
    await shift.save();
    const startTs = Math.floor(shift.startTime.getTime() / 1000);
    const pauseBtn = new ButtonBuilder()
        .setCustomId("jornada:pause")
        .setLabel("Pausar")
        .setEmoji("⏸️")
        .setStyle(ButtonStyle.Secondary);
    const endBtn = new ButtonBuilder()
        .setCustomId("jornada:end")
        .setLabel("Finalizar")
        .setEmoji("❗")
        .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(pauseBtn, endBtn);
    const container = new ContainerBuilder()
        .setAccentColor(0x7c3aed)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# 🟢 Turno Reanudado"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `¡Bienvenido de vuelta! Tu jornada ha sido reanudada.`,
        ``,
        `**📅 Inicio de turno:** <t:${startTs}:F>`,
        `**⏸️ Tiempo pausado acumulado:** ${formatShiftTime(shift.pausedTimeMs)}`,
        `**${shift.device.split(" ")[0]} Dispositivo:** ${shift.device}`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(row)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff`));
    await interaction.update({
        // @ts-ignore — Components V2
        components: [container],
        embeds: [],
    });
}
// ─── FINALIZAR JORNADA ─────────────────────────────────────────────────────────
async function handleEnd(interaction, client) {
    const shift = await Shift.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        active: true,
    });
    if (!shift) {
        await interaction.reply({
            embeds: [errorEmbed("Sin Jornada Activa", "No tienes ninguna jornada activa para finalizar.")],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    const now = new Date();
    let finalPausedMs = shift.pausedTimeMs;
    if (shift.status === "paused" && shift.pauseStartTime) {
        finalPausedMs += (now.getTime() - shift.pauseStartTime.getTime());
    }
    const totalDurationMs = now.getTime() - shift.startTime.getTime();
    const activeDurationMs = Math.max(0, totalDurationMs - finalPausedMs);
    shift.active = false;
    shift.pausedTimeMs = finalPausedMs;
    await shift.save();
    await StaffStats.findOneAndUpdate({ guildId: interaction.guildId, userId: interaction.user.id }, {
        $inc: { totalShiftTimeMs: activeDurationMs },
        $set: { userTag: interaction.user.tag },
    }, { upsert: true });
    const formattedActive = formatShiftTime(activeDurationMs);
    const formattedPaused = formatShiftTime(finalPausedMs);
    const startTs = Math.floor(shift.startTime.getTime() / 1000);
    const endTs = Math.floor(now.getTime() / 1000);
    // 1. Responder al interaction
    const container = new ContainerBuilder()
        .setAccentColor(0xef4444)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("# ❗ Jornada Finalizada"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `Has finalizado tu turno administrativo correctamente.`,
        ``,
        `**⏱️ Tiempo activo:** ${formattedActive}`,
        `**⏸️ Tiempo pausado:** ${formattedPaused}`,
        ``,
        `¡Gracias por tu servicio de moderación!`,
    ].join("\n")))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Staff`));
    await interaction.update({
        // @ts-ignore — Components V2
        components: [container],
        embeds: [],
    });
    // 2. Log al hilo 1532150320409346088
    try {
        const guildIconUrl = interaction.guild?.iconURL({ size: 256 }) ?? client.user?.displayAvatarURL({ size: 256 }) ?? "";
        const logChannel = interaction.guild?.channels.cache.get(SHIFT_LOG_THREAD_ID)
            ?? (await interaction.guild?.channels.fetch(SHIFT_LOG_THREAD_ID).catch(() => null));
        if (logChannel && (logChannel.isTextBased() || logChannel.isThread())) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xef4444)
                .setThumbnail(guildIconUrl)
                .setTitle("🚨 Registro de Jornada Finalizada")
                .setDescription("Se ha registrado el cierre de turno de un miembro del equipo.")
                .addFields({ name: "👤 Staff", value: `<@${interaction.user.id}> (@${interaction.user.username})`, inline: true }, { name: `${shift.device.split(" ")[0]} Dispositivo`, value: shift.device, inline: true }, { name: "⏱️ Duración Activa", value: `**${formattedActive}**`, inline: true }, { name: "⏸️ Tiempo en Pausa", value: formattedPaused || "0", inline: true }, { name: "📅 Hora de Inicio", value: `<t:${startTs}:F>  (<t:${startTs}:R>)`, inline: false }, { name: "📅 Hora de Finalización", value: `<t:${endTs}:F>  (<t:${endTs}:R>)`, inline: false })
                .setFooter({ text: "Sonora RP Staff" })
                .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
        }
    }
    catch (logErr) {
        console.error("[JORNADA LOG] Error al enviar log:", logErr);
    }
}
