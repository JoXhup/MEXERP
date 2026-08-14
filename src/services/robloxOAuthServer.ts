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
  const state = crypto.randomBytes(16).toString("hex");
  stateMap.set(state, {
    discordUserId,
    guildId,
    createdAt: Date.now(),
  });

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
  const channelId = config.verificationChannelId || config.logChannelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !(channel as any).isTextBased?.()) return;

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

  await (channel as import("discord.js").TextChannel).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2 as any,
  }).catch((err) => console.error("[OAUTH_LOG] Error enviando log de verificación:", err));
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
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
        }
        body {
          background-color: #030712;
          color: #f8fafc;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          position: relative;
        }

        /* ─── ANIMATED BACKGROUND BLOBS (APPLE LIQUID MESH) ─── */
        .bg-mesh {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
        }
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.55;
          animation: floatBlob 18s infinite ease-in-out alternate;
        }
        .blob-1 {
          width: 450px;
          height: 450px;
          background: ${isSuccess ? "linear-gradient(135deg, #10b981, #06b6d4)" : "linear-gradient(135deg, #f43f5e, #be123c)"};
          top: -100px;
          left: -100px;
          animation-duration: 16s;
        }
        .blob-2 {
          width: 400px;
          height: 400px;
          background: ${isSuccess ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "linear-gradient(135deg, #e11d48, #9333ea)"};
          bottom: -100px;
          right: -100px;
          animation-duration: 20s;
          animation-delay: -5s;
        }
        .blob-3 {
          width: 320px;
          height: 320px;
          background: ${isSuccess ? "linear-gradient(135deg, #059669, #3b82f6)" : "linear-gradient(135deg, #fb7185, #7c3aed)"};
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-duration: 14s;
          animation-delay: -9s;
        }

        @keyframes floatBlob {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(40px, -60px) scale(1.12); }
          100% { transform: translate(-30px, 50px) scale(0.92); }
        }

        /* ─── IPHONE GLASS CARD ─── */
        .glass-card {
          position: relative;
          z-index: 10;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 
            0 30px 60px -12px rgba(0, 0, 0, 0.65),
            0 18px 36px -18px rgba(0, 0, 0, 0.75),
            inset 0 1px 1px rgba(255, 255, 255, 0.25);
          border-radius: 36px;
          padding: 3rem 2.25rem;
          max-width: 440px;
          width: 90%;
          text-align: center;
          animation: iosSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes iosSlideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ─── AVATAR RING ─── */
        .avatar-container {
          position: relative;
          width: 110px;
          height: 110px;
          margin: 0 auto 1.75rem auto;
        }
        .avatar-pulse-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: ${isSuccess ? "linear-gradient(135deg, #10b981, #3b82f6)" : "linear-gradient(135deg, #ef4444, #ec4899)"};
          animation: spinGlow 8s linear infinite;
          opacity: 0.85;
          filter: drop-shadow(0 0 12px ${isSuccess ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)"});
        }
        @keyframes spinGlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .avatar-img-wrap {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 3px solid #0f172a;
          overflow: hidden;
          background: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-img-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* ─── IOS BADGE ─── */
        .ios-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: ${isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"};
          color: ${isSuccess ? "#34d399" : "#f87171"};
          border: 1px solid ${isSuccess ? "rgba(52, 211, 153, 0.35)" : "rgba(248, 113, 113, 0.35)"};
          margin-bottom: 1.25rem;
          box-shadow: 0 4px 12px ${isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"};
        }
        .ios-badge svg {
          width: 14px;
          height: 14px;
          fill: currentColor;
        }

        h1 {
          font-size: 1.85rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: 0.85rem;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .user-tag {
          display: inline-block;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 700;
          color: #38bdf8;
          font-size: 0.95rem;
        }

        p {
          font-size: 0.95rem;
          line-height: 1.65;
          color: #94a3b8;
          margin-bottom: 1.75rem;
        }

        /* ─── IOS STYLE BUTTON / FOOTER ─── */
        .ios-hint {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 12px 16px;
          font-size: 0.85rem;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .footer-text {
          margin-top: 1.75rem;
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <!-- Dynamic Background Blobs -->
      <div class="bg-mesh">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
        <div class="blob blob-3"></div>
      </div>

      <!-- iPhone Glass Card -->
      <div class="glass-card">
        ${avatarUrl ? `
        <div class="avatar-container">
          <div class="avatar-pulse-ring"></div>
          <div class="avatar-img-wrap">
            <img src="${escapeHtml(avatarUrl)}" alt="Roblox Avatar">
          </div>
        </div>
        ` : ""}

        <div class="ios-badge">
          ${isSuccess ? `
            <svg viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
            <span>Verificación Completada</span>
          ` : `
            <svg viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/></svg>
            <span>Error de Verificación</span>
          `}
        </div>

        <h1>${escapeHtml(title)}</h1>
        <p>${message}</p>

        <div class="ios-hint">
          <span>💬</span>
          <span>Ya puedes cerrar esta pestaña y regresar a Discord.</span>
        </div>

        <div class="footer-text">
          Sonora RP System · Autenticación Oficial Roblox OAuth 2.0
        </div>
      </div>
    </body>
    </html>
  `);
}

