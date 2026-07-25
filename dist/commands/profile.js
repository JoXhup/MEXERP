import { SlashCommandBuilder, MessageFlags, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, ThumbnailBuilder, SeparatorSpacingSize, } from "discord.js";
import { getFooterTimestamp } from "../utils/components.js";
// ─── DEFINICION DEL COMANDO ───────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Comandos de perfil de Roblox")
    .addSubcommand(sub => sub
    .setName("view")
    .setDescription("Ver informacion de un usuario de Roblox por su ID")
    .addIntegerOption(opt => opt
    .setName("user_id")
    .setDescription("ID numerica del usuario de Roblox")
    .setRequired(true)
    .setMinValue(1)));
// ─── ESTADO DE PRESENCIA ──────────────────────────────────────────────────────
function presenceLabel(type, location) {
    switch (type) {
        case 0: return "Desconectado";
        case 1: return "En linea (Website)";
        case 2: return `Jugando: ${location || "Roblox"}`;
        case 3: return "En Roblox Studio";
        default: return "Desconocido";
    }
}
// ─── FETCH CON TIMEOUT ────────────────────────────────────────────────────────
async function fetchJson(url, options) {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status} — ${url}`);
    return res.json();
}
// ─── EXECUTOR ─────────────────────────────────────────────────────────────────
export async function execute(interaction, client) {
    if (interaction.options.getSubcommand() !== "view")
        return;
    const userId = interaction.options.getInteger("user_id", true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        // ── 1. Info basica del usuario ────────────────────────────────────────────
        const user = await fetchJson(`https://users.roblox.com/v1/users/${userId}`);
        // ── 2. Avatar headshot ────────────────────────────────────────────────────
        const thumbRes = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
        const avatarUrl = thumbRes.data[0]?.state === "Completed"
            ? thumbStr(thumbRes.data[0].imageUrl)
            : "https://t6.rbxcdn.com/7c55c4b9a4f7f4a2f4f4f4f4f4f4f4f4";
        // ── 3. Body avatar (fullbody) ─────────────────────────────────────────────
        const bodyRes = await fetchJson(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
        const bodyUrl = bodyRes.data[0]?.state === "Completed"
            ? bodyRes.data[0].imageUrl
            : null;
        // ── 4. Amigos, seguidores, siguiendo ──────────────────────────────────────
        const [friendsRes, followersRes, followingRes] = await Promise.allSettled([
            fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
            fetchJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
            fetchJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
        ]);
        const friends = friendsRes.status === "fulfilled" ? friendsRes.value.count : null;
        const followers = followersRes.status === "fulfilled" ? followersRes.value.count : null;
        const following = followingRes.status === "fulfilled" ? followingRes.value.count : null;
        // ── 5. Presencia ──────────────────────────────────────────────────────────
        let presenceText = "Desconocido";
        try {
            const presRes = await fetchJson("https://presence.roblox.com/v1/presence/users", { method: "POST", body: JSON.stringify({ userIds: [userId] }) });
            const presence = presRes.userPresences[0];
            if (presence)
                presenceText = presenceLabel(presence.userPresenceType, presence.lastLocation);
        }
        catch { /* presencia puede fallar por rate limit */ }
        // ── 6. Grupos (primeros 3) ────────────────────────────────────────────────
        let groupsText = "No disponible";
        try {
            const groupRes = await fetchJson(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
            const groups = groupRes.data.slice(0, 3).map(g => g.group.name);
            groupsText = groups.length > 0 ? groups.join(", ") : "Sin grupos publicos";
        }
        catch { /* ok */ }
        // ── CALCULOS ──────────────────────────────────────────────────────────────
        const createdDate = new Date(user.created);
        const now = new Date();
        const diasEnRoblox = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        const anios = Math.floor(diasEnRoblox / 365);
        const diasRestantes = diasEnRoblox % 365;
        const edadTexto = anios > 0
            ? `${anios} año${anios !== 1 ? "s" : ""} y ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`
            : `${diasEnRoblox} días`;
        const fechaCreacion = createdDate.toLocaleDateString("es-ES", {
            day: "2-digit", month: "long", year: "numeric",
        });
        const fmt = (n) => n === null ? "N/D" : n.toLocaleString("es-ES");
        // ── CONTAINER ─────────────────────────────────────────────────────────────
        const container = new ContainerBuilder()
            .addSectionComponents(new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `## ${user.hasVerifiedBadge ? "☑ " : ""}${user.displayName}`,
            `**@${user.name}** · ID: \`${user.id}\``,
            user.isBanned ? "**Esta cuenta fue baneada**" : "",
        ].filter(Boolean).join("\n")))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)))
            .addSeparatorComponents(new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `**Descripcion**`,
            user.description.trim()
                ? user.description.trim().slice(0, 300) + (user.description.length > 300 ? "…" : "")
                : "*Sin descripcion*",
        ].join("\n")))
            .addSeparatorComponents(new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `**Miembro desde:** ${fechaCreacion}`,
            `**Tiempo en Roblox:** ${edadTexto} (${diasEnRoblox.toLocaleString("es-ES")} días)`,
            `**Estado:** ${presenceText}`,
            ``,
            `**Amigos:** ${fmt(friends)}   **Seguidores:** ${fmt(followers)}   **Siguiendo:** ${fmt(following)}`,
            ``,
            `**Grupos:** ${groupsText}`,
        ].join("\n")));
        // Avatar cuerpo completo si está disponible
        if (bodyUrl) {
            container
                .addSeparatorComponents(new SeparatorBuilder()
                .setSpacing(SeparatorSpacingSize.Small)
                .setDivider(true))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Avatar completo:** [Ver imagen](${bodyUrl})`));
        }
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# MEXERP System · ${getFooterTimestamp()}`));
        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    }
    catch (err) {
        const isNotFound = err?.message?.includes("404") || err?.message?.includes("400");
        const errContainer = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(isNotFound
            ? `## Usuario no encontrado\nNo existe un usuario de Roblox con la ID **${userId}**.\nVerifica que sea una ID numerica valida.`
            : `## Error al obtener el perfil\nNo se pudo conectar con la API de Roblox. Intenta de nuevo en unos momentos.`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# MEXERP System · ${getFooterTimestamp()}`));
        await interaction.editReply({
            components: [errContainer],
            flags: MessageFlags.IsComponentsV2,
        });
    }
}
// Asegura que la URL del thumbnail sea HTTPS y valida
function thumbStr(url) {
    if (!url || !url.startsWith("http"))
        return "";
    return url;
}
