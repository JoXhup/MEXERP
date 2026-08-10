/**
 * verificationHandler.ts
 * Maneja todo el flujo de verificacion Roblox:
 *   1. Boton "Iniciar"        → abre modal v2
 *   2. Modal submit           → busca perfil Roblox → muestra embed con botones
 *   3. Boton "Confirmar"      → asigna rol verificado + log
 *   4. Boton "Intentar de nuevo" → vuelve a abrir el modal
 */
import { MessageFlags, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, } from "discord.js";
import { config } from "../config.js";
import { sendLog } from "../utils/logger.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
async function robloxFetch(url, init) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...init,
    });
    if (!res.ok)
        throw new Error(`Roblox API ${res.status}: ${url}`);
    return res.json();
}
/** Busca un usuario por nombre de usuario exacto */
async function getUserByUsername(username) {
    const body = JSON.stringify({ usernames: [username.trim()], excludeBannedUsers: false });
    const data = await robloxFetch("https://users.roblox.com/v1/usernames/users", { method: "POST", body });
    const match = data.data[0];
    if (!match)
        return null;
    // Obtener info completa
    return robloxFetch(`https://users.roblox.com/v1/users/${match.id}`);
}
/** Obtiene la URL del headshot */
async function getHeadshot(userId) {
    try {
        const data = await robloxFetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=true`);
        return data.data[0]?.state === "Completed" ? data.data[0].imageUrl : "";
    }
    catch {
        return "";
    }
}
// ─── MODAL DE VERIFICACION ────────────────────────────────────────────────────
function buildVerificationModal() {
    const modal = new ModalBuilder()
        .setCustomId("verification:modal")
        .setTitle("Verificacion — Sonora RP");
    // Label 1: Usuario de Roblox
    const l1 = new LabelBuilder()
        .setLabel("Usuario de Roblox")
        .setDescription("Escribe tu nombre de usuario exacto de Roblox")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("roblox_username")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ej: Builderman")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20));
    // Label 2: Como te uniste
    const l2 = new LabelBuilder()
        .setLabel("Como te uniste al servidor?")
        .setDescription("Cuentanos como llegaste a conocer Sonora RP")
        .setTextInputComponent(new TextInputBuilder()
        .setCustomId("como_uniste")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Ej: Un amigo me invito, lo vi en redes sociales...")
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(300));
    // Label 3: StringSelect — Te auxilio un moderador? (no obligatorio)
    const auxSelect = new StringSelectMenuBuilder()
        .setCustomId("auxilio_moderador")
        .setPlaceholder("Selecciona una opcion (opcional)...")
        .setMinValues(0)
        .setMaxValues(1)
        .setRequired(false)
        .addOptions(new StringSelectMenuOptionBuilder().setLabel("Si, un moderador me ayudo").setValue("si"), new StringSelectMenuOptionBuilder().setLabel("No, entre solo").setValue("no"));
    const l3 = new LabelBuilder()
        .setLabel("Te auxilio un moderador?")
        .setDescription("Esta pregunta es opcional")
        .setStringSelectMenuComponent(auxSelect);
    modal.addLabelComponents(l1, l2, l3);
    return modal;
}
// ─── EMBED DE PERFIL ROBLOX ───────────────────────────────────────────────────
function buildProfileEmbed(user, headshotUrl, client) {
    const createdDate = new Date(user.created);
    const dias = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    const anios = Math.floor(dias / 365);
    const edadTexto = anios > 0 ? `${anios} año(s) y ${dias % 365} día(s)` : `${dias} días`;
    const fechaCreacion = createdDate.toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric",
    });
    return new EmbedBuilder()
        .setColor(0xf97316) // Naranja — pendiente de confirmar
        .setAuthor({
        name: "Verificacion — Sonora RP",
        iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
        .setTitle(`${user.hasVerifiedBadge ? "☑ " : ""}${user.displayName}`)
        .setDescription([
        `**@${user.name}** · ID: \`${user.id}\``,
        user.isBanned ? "\n⚠️ **Esta cuenta fue baneada de Roblox**" : "",
        user.description.trim()
            ? `\n> ${user.description.trim().slice(0, 200)}${user.description.length > 200 ? "…" : ""}`
            : "",
    ].filter(Boolean).join(""))
        .addFields({ name: "Miembro desde", value: fechaCreacion, inline: true }, { name: "Tiempo en Roblox", value: edadTexto, inline: true }, { name: "Badge verificado", value: user.hasVerifiedBadge ? "Si" : "No", inline: true })
        .setThumbnail(headshotUrl || null)
        .setFooter({
        text: "Sonora RP System — Confirma si este es tu perfil",
        iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
        .setTimestamp();
}
// ─── BOTONES DE CONFIRMACION ──────────────────────────────────────────────────
function buildConfirmRow(robloxId) {
    return new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId(`verification:confirm:${robloxId}`)
        .setLabel("Si, ese soy yo")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"), new ButtonBuilder()
        .setCustomId("verification:retry")
        .setLabel("Intentar de nuevo")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🔄"));
}
// ─────────────────────────────────────────────────────────────────────────────
// BOTON: "Iniciar" → abre modal
// ─────────────────────────────────────────────────────────────────────────────
export async function handleVerificationStart(interaction) {
    // Verificar si ya tiene el rol verificado
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const yaVerificadoRol = config.verifiedRoleIds.some(id => member?.roles.cache.has(id));
    // Verificar si ya esta en la base de datos
    const yaEnDB = await VerifiedUser.findOne({ discordId: interaction.user.id });
    if (yaVerificadoRol || yaEnDB) {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("Ya estas verificado")
                    .setDescription(yaEnDB
                    ? `Tu cuenta de Discord ya esta vinculada a **@${yaEnDB.robloxName}** en Roblox.\nNo puedes verificarte dos veces.`
                    : "Ya tienes el rol de verificado asignado. No es necesario verificarte de nuevo.")
                    .setFooter({ text: "Sonora RP System — Verificacion" })
                    .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.showModal(buildVerificationModal());
}
// ─────────────────────────────────────────────────────────────────────────────
// BOTON: "Intentar de nuevo" → vuelve a abrir el modal
// ─────────────────────────────────────────────────────────────────────────────
export async function handleVerificationRetry(interaction) {
    await interaction.showModal(buildVerificationModal());
}
// ─────────────────────────────────────────────────────────────────────────────
// MODAL SUBMIT → buscar usuario Roblox → mostrar perfil + botones
// ─────────────────────────────────────────────────────────────────────────────
export async function handleVerificationModal(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    // Leer TextInputs
    const robloxUsername = interaction.fields.getTextInputValue("roblox_username").trim();
    const comoUniste = interaction.fields.getTextInputValue("como_uniste").trim();
    // Leer StringSelect opcional del modal v2
    let auxilioModerador = "No especificado";
    try {
        for (const row of interaction.components ?? []) {
            const inner = row?.components?.[0] ?? row;
            if (inner?.type === ComponentType.StringSelect ||
                inner?.componentType === ComponentType.StringSelect) {
                const vals = inner.values;
                if (vals?.length) {
                    auxilioModerador = vals[0] === "si" ? "Si" : "No";
                }
            }
        }
    }
    catch { /* opcional */ }
    // Buscar en Roblox
    let user = null;
    try {
        user = await getUserByUsername(robloxUsername);
    }
    catch {
        await interaction.editReply({
            content: "No se pudo conectar con Roblox. Intenta de nuevo en un momento.",
        });
        return;
    }
    if (!user) {
        await interaction.editReply({
            content: `No se encontro ningun usuario de Roblox con el nombre **${robloxUsername}**.\nVerifica que el nombre sea correcto e intenta de nuevo.`,
            components: [
                new ActionRowBuilder().addComponents(new ButtonBuilder()
                    .setCustomId("verification:retry")
                    .setLabel("Intentar de nuevo")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("🔄")),
            ],
        });
        return;
    }
    const headshotUrl = await getHeadshot(user.id);
    // Verificar si esta cuenta de Roblox ya esta vinculada a otro Discord
    const cuentaEnUso = await VerifiedUser.findOne({ robloxId: user.id });
    if (cuentaEnUso) {
        const esTuYo = cuentaEnUso.discordId === interaction.user.id;
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle("Cuenta de Roblox no disponible")
                    .setDescription(esTuYo
                    ? `La cuenta **@${user.name}** ya esta vinculada a tu Discord. Ya estas verificado.`
                    : `La cuenta **@${user.name}** ya esta en uso por otro miembro del servidor.\nSi crees que es un error, contacta a un administrador.`)
                    .setThumbnail(headshotUrl || null)
                    .setFooter({ text: "Sonora RP System — Verificacion" })
                    .setTimestamp(),
            ],
            components: [
                new ActionRowBuilder().addComponents(new ButtonBuilder()
                    .setCustomId("verification:retry")
                    .setLabel("Intentar con otra cuenta")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("🔄")),
            ],
        });
        return;
    }
    // Guardar datos del modal en memoria hasta que confirme
    verificationTemp.set(interaction.user.id, { comoUniste, auxilioModerador, robloxId: user.id });
    const embed = buildProfileEmbed(user, headshotUrl, client);
    const confirmRow = buildConfirmRow(user.id);
    await interaction.editReply({
        embeds: [embed],
        components: [confirmRow],
    });
}
// Storage en memoria para datos del modal (solo necesario hasta que confirme)
const verificationTemp = new Map();
// ─────────────────────────────────────────────────────────────────────────────
// BOTON: "Confirmar" → asigna rol + log
// ─────────────────────────────────────────────────────────────────────────────
export async function handleVerificationConfirm(interaction, client) {
    // customId: verification:confirm:<robloxId>
    const robloxId = parseInt(interaction.customId.split(":")[2] ?? "0");
    await interaction.deferUpdate();
    const guild = interaction.guild;
    const member = guild?.members.cache.get(interaction.user.id)
        ?? await guild?.members.fetch(interaction.user.id);
    if (!guild || !member) {
        await interaction.followUp({
            content: "Error: no se pudo obtener la informacion del servidor.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    // Recuperar datos del modal
    const tempData = verificationTemp.get(interaction.user.id);
    verificationTemp.delete(interaction.user.id);
    // Re-fetch usuario Roblox para obtener el username actual
    let robloxName = `ID: ${robloxId}`;
    try {
        const u = await robloxFetch(`https://users.roblox.com/v1/users/${robloxId}`);
        robloxName = `${u.displayName} (@${u.name})`;
    }
    catch { /* ok */ }
    // Asignar todos los roles verificados configurados
    let rolesAsignados = 0;
    for (const roleId of config.verifiedRoleIds) {
        try {
            await member.roles.add(roleId, "Verificacion Roblox completada");
            rolesAsignados++;
        }
        catch (err) {
            console.error(`[VERIFICAR] Error asignando rol ${roleId}:`, err);
        }
    }
    const rolAsignado = rolesAsignados > 0;
    // Quitar el rol de "no verificado" si lo tiene
    const ROL_QUITAR = config.unverifiedRoleId;
    try {
        if (member.roles.cache.has(ROL_QUITAR)) {
            await member.roles.remove(ROL_QUITAR, "Verificacion Roblox completada");
        }
    }
    catch (err) {
        console.error(`[VERIFICAR] Error quitando rol ${ROL_QUITAR}:`, err);
    }
    // Guardar vinculo Discord ↔ Roblox en MongoDB
    let robloxNameShort = String(robloxId);
    try {
        const u2 = await robloxFetch(`https://users.roblox.com/v1/users/${robloxId}`);
        robloxNameShort = u2.name;
    }
    catch { /* ok */ }
    try {
        await VerifiedUser.findOneAndUpdate({ discordId: interaction.user.id }, { discordId: interaction.user.id, robloxId, robloxName: robloxNameShort, verifiedAt: new Date() }, { upsert: true, new: true });
    }
    catch (err) {
        console.error("[VERIFICAR] Error guardando en DB:", err);
    }
    // Cambiar apodo al nombre de usuario de Roblox
    try {
        await member.setNickname(robloxNameShort, "Verificacion Roblox completada");
        console.log(`[VERIFICAR] Apodo cambiado a: ${robloxNameShort}`);
    }
    catch (err) {
        console.error("[VERIFICAR] Error cambiando apodo (puede que no tenga permisos):", err);
    }
    // Actualizar el mensaje con confirmacion final
    const successEmbed = new EmbedBuilder()
        .setColor(0x7c3aed) // Morado — verificacion completada
        .setAuthor({
        name: "Verificacion Completada",
        iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
        .setDescription([
        `Bienvenido a **Sonora RP**, <@${interaction.user.id}>!`,
        ``,
        `Tu cuenta de Roblox **${robloxName}** ha sido vinculada correctamente.`,
        rolAsignado ? `\nSe te ha asignado el rol de verificado.` : "",
    ].join("\n"))
        .setFooter({
        text: "Sonora RP System — Verificacion Roblox",
        iconURL: client.user?.displayAvatarURL() ?? undefined,
    })
        .setTimestamp();
    await interaction.editReply({
        embeds: [successEmbed],
        components: [],
    });
    // Log
    await sendLog(client, "Usuario Verificado", `${interaction.user.tag} completo la verificacion`, [
        { name: "Discord", value: `<@${interaction.user.id}> (${interaction.user.tag})` },
        { name: "Roblox", value: robloxName },
        { name: "Como se unio", value: tempData?.comoUniste ?? "No especificado" },
        { name: "Auxilio moderador", value: tempData?.auxilioModerador ?? "No especificado" },
        { name: "Roles asignados", value: rolAsignado ? `${rolesAsignados} rol(es) asignados` : "Error — sin roles asignados" },
    ]);
}
