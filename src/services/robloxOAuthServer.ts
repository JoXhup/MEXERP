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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)} — Sonora RP</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 0;
          background-color: #0b0f19;
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background: linear-gradient(145deg, #131c2e, #0f172a);
          border: 1px solid ${isSuccess ? "#10b981" : "#ef4444"};
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          max-width: 480px;
          width: 90%;
          text-align: center;
        }
        .avatar-wrap {
          margin: 0 auto 1.5rem auto;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border: 3px solid ${isSuccess ? "#10b981" : "#ef4444"};
          overflow: hidden;
          background: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-wrap img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .status-badge {
          display: inline-block;
          padding: 6px 16px;
          border-radius: 9999px;
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: ${isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"};
          color: ${isSuccess ? "#34d399" : "#f87171"};
          border: 1px solid ${isSuccess ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"};
          margin-bottom: 1rem;
        }
        h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 1rem 0;
          color: #ffffff;
        }
        p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #94a3b8;
          margin: 0 0 1.5rem 0;
        }
        .btn {
          display: inline-block;
          background: #3b82f6;
          color: #ffffff;
          font-weight: 600;
          padding: 12px 28px;
          border-radius: 10px;
          text-decoration: none;
          transition: background 0.2s;
        }
        .btn:hover {
          background: #2563eb;
        }
        .footer {
          margin-top: 2rem;
          font-size: 0.8rem;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        ${avatarUrl ? `<div class="avatar-wrap"><img src="${escapeHtml(avatarUrl)}" alt="Avatar"></div>` : ""}
        <div class="status-badge">${isSuccess ? "Éxito" : "Error"}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${message}</p>
        <div class="footer">Sonora RP System · Autenticación Oficial Roblox OAuth 2.0</div>
      </div>
    </body>
    </html>
  `);
}
