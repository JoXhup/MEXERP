/**
 * robloxOAuthServer.ts
 * Servidor HTTP para manejar la autenticación OAuth 2.0 oficial de Roblox.
 * 
 * Flujo:
 * 1. Usuario da clic en "Iniciar sesión con Roblox" en Discord.
 * 2. Se genera un token de estado (state) único asociado a su discordId.
 * 3. El usuario inicia sesión en la página oficial de Roblox y autoriza la app.
 * 4. Roblox redirige a /oauth/callback con el parámetro `code` y `state`.
 * 5. El servidor intercambia el `code` por `access_token` e información del usuario.
 * 6. Se actualiza la base de datos, se le otorgan los roles en el servidor de Discord,
 *    se cambia su apodo a su usuario de Roblox y se le envía un registro en el canal de logs.
 * 7. Se renderiza una página HTML premium de confirmación en su navegador.
 */

import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { type Client, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, MessageFlags } from "discord.js";
import { config } from "../config.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
import { getFooterTimestamp } from "../utils/components.js";

export const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID || "4269442493051477939";
export const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET || "RBX-yTVBuq7blUyWrCvmwEMGDwXNDeAMHiQ9hXJHsYtEerntbf2ccDObK9K1FvAhrxUu";
export const ROBLOX_REDIRECT_URI = process.env.ROBLOX_REDIRECT_URI || "http://localhost:3000/oauth/callback";
export const OAUTH_PORT = Number(process.env.PORT || 3000);

interface OAuthState {
  discordUserId: string;
  guildId: string;
  createdAt: number;
}

const stateMap = new Map<string, OAuthState>();

// Limpiar estados expirados (> 15 min) cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateMap.entries()) {
    if (now - data.createdAt > 15 * 60 * 1000) {
      stateMap.delete(state);
    }
  }
}, 5 * 60 * 1000);

/**
 * Genera la URL de autorización oficial de Roblox para un usuario de Discord
 */
export function generateRobloxOAuthUrl(discordUserId: string, guildId: string): string {
  // Crear token de estado firmado con HMAC para funcionamiento stateless y serverless
  const payload = {
    discordUserId,
    guildId,
    createdAt: Date.now(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", ROBLOX_CLIENT_SECRET).update(payloadB64).digest("hex");
  const state = `${payloadB64}.${sig}`;

  stateMap.set(state, payload);

  const authUrl = new URL("https://apis.roblox.com/oauth/v1/authorize");
  authUrl.searchParams.set("client_id", ROBLOX_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", ROBLOX_REDIRECT_URI);
  authUrl.searchParams.set("scope", "openid profile");
  authUrl.searchParams.set("state", state);

  return authUrl.toString();
}

/**
 * Inicializa el servidor HTTP para recibir la redirección de Roblox OAuth 2.0
 */
export function startOAuthServer(client: Client): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (reqUrl.pathname === "/oauth/callback") {
        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state");
        const error = reqUrl.searchParams.get("error");
        const errorDescription = reqUrl.searchParams.get("error_description");

        if (error) {
          renderHtmlResponse(
            res,
            400,
            "Autenticación Cancelada",
            `Roblox devolvió un error: <code>${errorDescription || error}</code>. Vuelve a Discord e inténtalo nuevamente.`,
            false
          );
          return;
        }

        if (!code || !state) {
          renderHtmlResponse(
            res,
            400,
            "Parámetros Faltantes",
            "La solicitud no contiene el código o el estado de verificación requerido.",
            false
          );
          return;
        }

        const oauthState = stateMap.get(state);
        if (!oauthState) {
          renderHtmlResponse(
            res,
            400,
            "Sesión Expirada",
            "La sesión de verificación ha expirado o es inválida. Por favor, regresa a Discord y genera un nuevo enlace.",
            false
          );
          return;
        }

        // Eliminar el estado usado (un solo uso)
        stateMap.delete(state);

        // 1. Intercambiar code por Access Token
        const tokenParams = new URLSearchParams();
        tokenParams.set("client_id", ROBLOX_CLIENT_ID);
        tokenParams.set("client_secret", ROBLOX_CLIENT_SECRET);
        tokenParams.set("grant_type", "authorization_code");
        tokenParams.set("code", code);

        const tokenRes: any = await fetch("https://apis.roblox.com/oauth/v1/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error("[OAUTH] Error obteniendo token de Roblox:", errText);
          renderHtmlResponse(
            res,
            500,
            "Error de Autenticación",
            "No se pudo completar el intercambio de token con Roblox. Por favor intenta más tarde.",
            false
          );
          return;
        }

        const tokenData = (await tokenRes.json()) as { access_token: string };
        const accessToken = tokenData.access_token;

        // 2. Obtener información del usuario con el Access Token
        const userInfoRes: any = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userInfoRes.ok) {
          const errText = await userInfoRes.text();
          console.error("[OAUTH] Error obteniendo userinfo de Roblox:", errText);
          renderHtmlResponse(
            res,
            500,
            "Error de Perfil",
            "No se pudo obtener la información de tu perfil de Roblox.",
            false
          );
          return;
        }

        const userInfo = (await userInfoRes.json()) as {
          sub: string;
          name?: string;
          preferred_username?: string;
          nickname?: string;
          profile?: string;
          picture?: string;
        };

        const robloxUserId = Number(userInfo.sub);
        const robloxUsername = userInfo.preferred_username || userInfo.name || `User_${robloxUserId}`;
        const robloxDisplayName = userInfo.nickname || robloxUsername;

        // 3. Obtener avatar headshot desde la API de thumbnails de Roblox
        let avatarUrl = userInfo.picture || "";
        if (!avatarUrl) {
          try {
            const thumbRes: any = await fetch(
              `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`
            );
            if (thumbRes.ok) {
              const thumbData = (await thumbRes.json()) as { data: Array<{ imageUrl: string }> };
              if (thumbData.data?.[0]?.imageUrl) {
                avatarUrl = thumbData.data[0].imageUrl;
              }
            }
          } catch {
            /* ok */
          }
        }

        // 4. Guardar en Base de Datos Mongoose
        await VerifiedUser.findOneAndUpdate(
          { discordId: oauthState.discordUserId },
          {
            discordId: oauthState.discordUserId,
            robloxId: robloxUserId,
            robloxName: robloxUsername,
            verifiedAt: new Date(),
          },
          { upsert: true, new: true }
        );

        // 5. Otorgar roles y actualizar apodo en el servidor de Discord
        const guild = client.guilds.cache.get(oauthState.guildId) || client.guilds.cache.get(config.guildId);
        let member = guild?.members.cache.get(oauthState.discordUserId);
        if (!member && guild) {
          member = await guild.members.fetch(oauthState.discordUserId).catch(() => undefined);
        }

        if (member) {
          // Asignar roles verificados
          for (const roleId of config.verifiedRoleIds) {
            await member.roles.add(roleId).catch((err) =>
              console.error(`[OAUTH] Error agregando rol ${roleId}:`, err)
            );
          }

          // Remover rol de no verificado
          if (config.unverifiedRoleId) {
            await member.roles.remove(config.unverifiedRoleId).catch(() => undefined);
          }

          // Cambiar apodo al nombre de usuario de Roblox
          await member.setNickname(robloxUsername).catch((err) =>
            console.log(`[OAUTH] No se pudo cambiar apodo a ${robloxUsername}:`, err.message)
          );
        }

        // 6. Enviar log al canal de verificación
        postVerificationLog(client, oauthState.discordUserId, robloxUserId, robloxUsername, robloxDisplayName, avatarUrl);

        // 7. Mostrar página de éxito en el navegador
        renderHtmlResponse(
          res,
          200,
          "¡Verificación Completada!",
          `Tu cuenta de Discord ha sido vinculada exitosamente con la cuenta de Roblox <strong>@${escapeHtml(robloxUsername)}</strong>.<br><br>Tus roles y permisos han sido otorgados en el servidor de Sonora RP. Ya puedes cerrar esta pestaña y regresar a Discord.`,
          true,
          avatarUrl,
          robloxUsername,
          robloxDisplayName
        );
        return;
      }

      // Endpoint principal / ping
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Sonora RP — OAuth 2.0</title>
          <style>
            body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; text-align: center; max-width: 400px; }
            h1 { color: #38bdf8; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Sonora RP Server</h1>
            <p>Servidor de Verificación Oficial Roblox OAuth 2.0 activo.</p>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      console.error("[OAUTH SERVER] Error no capturado:", err);
      renderHtmlResponse(
        res,
        500,
        "Error del Servidor",
        "Ocurrió un error inesperado al procesar la verificación.",
        false
      );
    }
  });

  server.listen(OAUTH_PORT, () => {
    console.log(`[OAUTH] 🚀 Servidor de Verificación OAuth 2.0 corriendo en el puerto ${OAUTH_PORT}`);
    console.log(`[OAUTH] Callback URL: ${ROBLOX_REDIRECT_URI}`);
  });

  return server;
}

// ─── LOGS EN DISCORD ─────────────────────────────────────────────────────────
async function postVerificationLog(
  client: Client,
  discordId: string,
  robloxId: number,
  robloxUsername: string,
  robloxDisplayName: string,
  avatarUrl: string
): Promise<void> {
  const nowUnix = Math.floor(Date.now() / 1000);

  const container = new ContainerBuilder()
    .setAccentColor(0x10b981)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# ✅ Usuario Verificado vía OAuth 2.0\n<@${discordId}> ha vinculado su cuenta oficial de Roblox.`
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl || "https://images.rbxcdn.com/264531478229e71e72e1c3e38706d8a3.png"))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        `› **Discord:** <@${discordId}> (\`${discordId}\`)`,
        `› **Roblox Username:** \`@${robloxUsername}\``,
        `› **Display Name:** ${robloxDisplayName}`,
        `› **Roblox User ID:** \`${robloxId}\``,
        `› **Perfil de Roblox:** [Ver Perfil](https://www.roblox.com/users/${robloxId}/profile)`,
        `› **Fecha:** <t:${nowUnix}:F>`,
      ].join("\n"))
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Sonora RP Verification · ${getFooterTimestamp()}`));

  // Enviar mensaje privado (DM) al usuario verificado — solo DM, no en canal del servidor
  try {
    const user = await client.users.fetch(discordId);
    await user.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2 as any,
    });
    console.log(`[OAUTH] ✅ DM de verificación enviado a ${user.tag}`);
  } catch (dmErr: any) {
    console.warn(`[OAUTH] No se pudo enviar DM a ${discordId}:`, dmErr.message);
  }
}

// ─── HELPER HTML ──────────────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}

function renderHtmlResponse(
  res: http.ServerResponse,
  statusCode: number,
  title: string,
  message: string,
  isSuccess: boolean,
  avatarUrl?: string,
  username?: string,
  displayName?: string
): void {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>${escapeHtml(title)} — Sonora RP</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          min-height: 100vh;
          background: #000;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
        }

        /* ── Orbs animados ── */
        .orbs {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          animation: orbFloat linear infinite;
        }
        .orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, ${isSuccess ? "#1a6b3a" : "#7f1d1d"} 0%, transparent 70%);
          top: -120px; left: -120px;
          animation-duration: 20s;
        }
        .orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, ${isSuccess ? "#0f4a2a" : "#991b1b"} 0%, transparent 70%);
          bottom: -100px; right: -100px;
          animation-duration: 25s;
          animation-delay: -8s;
        }
        .orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, ${isSuccess ? "#14532d" : "#7f1d1d"} 0%, transparent 70%);
          top: 40%; left: 55%;
          animation-duration: 18s;
          animation-delay: -4s;
        }

        @keyframes orbFloat {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(30px, -40px) scale(1.08); }
          100% { transform: translate(-20px, 30px) scale(0.94); }
        }

        /* ── Card principal Apple Glass ── */
        .card {
          position: relative;
          z-index: 10;
          width: 90%;
          max-width: 380px;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(48px) saturate(180%);
          -webkit-backdrop-filter: blur(48px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 28px;
          padding: 48px 36px 40px;
          text-align: center;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.4),
            0 8px 32px rgba(0, 0, 0, 0.5),
            0 32px 64px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation: cardIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Icono / avatar ── */
        .icon-wrap {
          width: 72px;
          height: 72px;
          margin: 0 auto 28px;
          position: relative;
        }
        .icon-bg {
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, ${isSuccess ? "#22c55e, #16a34a, #15803d, #22c55e" : "#ef4444, #dc2626, #b91c1c, #ef4444"});
          animation: spinSlow 6s linear infinite;
          opacity: 1;
        }
        .icon-inner {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #0a0a0a;
          border: 2px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          overflow: hidden;
          color: ${isSuccess ? "#4ade80" : "#f87171"};
        }
        .icon-inner img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        @keyframes spinSlow {
          to { transform: rotate(360deg); }
        }

        /* ── Badge ── */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 16px;
          background: ${isSuccess ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)"};
          color: ${isSuccess ? "#4ade80" : "#f87171"};
          border: 1px solid ${isSuccess ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"};
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        ${isSuccess ? `.badge .badge-dot { animation: pulse-dot 1.4s ease infinite; }` : ""}
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ── Tipografía ── */
        h1 {
          font-size: 22px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.4px;
          line-height: 1.3;
          margin-bottom: 10px;
        }
        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          line-height: 1.6;
          font-weight: 400;
        }

        /* ── Username pill ── */
        .username-pill {
          display: inline-block;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 2px 10px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.8);
          margin-top: 6px;
        }

        /* ── Divider ── */
        .divider {
          width: 100%;
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 28px 0;
        }

        /* ── Footer hint ── */
        .hint {
          font-size: 12px;
          color: rgba(255,255,255,0.25);
          font-weight: 400;
        }
      </style>
    </head>
    <body>
      <div class="orbs">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
      </div>

      <div class="card">
        <div class="icon-wrap">
          <div class="icon-bg"></div>
          <div class="icon-inner">
            ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="">` : (isSuccess ? "✓" : "✕")}
          </div>
        </div>

        <div class="badge">
          <span class="badge-dot"></span>
          ${isSuccess ? "Verificado" : "Error"}
        </div>

        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">
          ${isSuccess ? `Bienvenido a Sonora RP<br><span class="username-pill">@${escapeHtml(username || "Usuario")}</span>` : escapeHtml(message)}
        </p>

        <div class="divider"></div>
        <p class="hint">${isSuccess ? "Puedes cerrar esta ventana y volver a Discord." : "Cierra esta ventana y genera un nuevo enlace."}</p>
      </div>
    </body>
    </html>
  `);
}

