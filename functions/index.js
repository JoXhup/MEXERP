import { onRequest } from "firebase-functions/v2/https";
import mongoose from "mongoose";
import crypto from "node:crypto";

const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID || "4269442493051477939";
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET || "RBX-yTVBuq7blUyWrCvmwEMGDwXNDeAMHiQ9hXJHsYtEerntbf2ccDObK9K1FvAhrxUu";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN || "";
const GUILD_ID = process.env.GUILD_ID || "1528571127352262866";
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb+srv://Joshua_04:12345Joshua@cluster0.pwh747o.mongodb.net/mexerp?retryWrites=true&w=majority";

const VERIFIED_ROLE_IDS = [
  "1529584400126181516",
  "1528974991813771304",
  "1531425281502613675",
];
const UNVERIFIED_ROLE_ID = "1528974924805312562";
const LOG_CHANNEL_ID = "1528981341461544970";

// ─── MODELO VERIFIEDUSER ───────────────────────────────────────────────────────
const VerifiedUserSchema = new mongoose.Schema({
  discordId:  { type: String, required: true, unique: true },
  robloxId:   { type: Number, required: true, unique: true },
  robloxName: { type: String, required: true },
  verifiedAt: { type: Date,   default: Date.now },
});

const VerifiedUser = mongoose.models.VerifiedUser || mongoose.model("VerifiedUser", VerifiedUserSchema);

let isDbConnected = false;
async function connectDb() {
  if (isDbConnected || mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGO_URI);
    isDbConnected = true;
  } catch (err) {
    console.error("[DB] Error conectando a MongoDB:", err);
  }
}

// ─── VERIFICAR FIRMA DE ESTADO HMAC (STATELESS & SEGURO) ──────────────────────
function verifySignedState(state) {
  try {
    if (!state || !state.includes(".")) return null;
    const [payloadB64, sig] = state.split(".");
    const expectedSig = crypto
      .createHmac("sha256", ROBLOX_CLIENT_SECRET)
      .update(payloadB64)
      .digest("hex");

    if (sig !== expectedSig) {
      console.warn("[OAUTH] Firma de state inválida.");
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const data = JSON.parse(payloadJson);

    // Expiración: 15 minutos
    if (Date.now() - data.createdAt > 15 * 60 * 1000) {
      console.warn("[OAUTH] State expirado.");
      return null;
    }

    return data;
  } catch (e) {
    console.error("[OAUTH] Error decodificando state:", e);
    return null;
  }
}

// ─── HTML RENDERER ────────────────────────────────────────────────────────────
function renderHtmlResponse(res, statusCode, title, message, isSuccess, avatarUrl = "") {
  res.status(statusCode).set("Content-Type", "text/html; charset=utf-8").send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)} - Sonora RP</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #030712;
          color: #f8fafc;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          overflow: hidden;
          position: relative;
        }
        .bg-mesh { position: absolute; width: 100%; height: 100%; overflow: hidden; z-index: 1; }
        .blob { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.55; }
        .blob-1 {
          width: 450px; height: 450px;
          background: ${isSuccess ? "linear-gradient(135deg, #10b981, #06b6d4)" : "linear-gradient(135deg, #f43f5e, #be123c)"};
          top: -100px; left: -100px;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: ${isSuccess ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "linear-gradient(135deg, #e11d48, #9333ea)"};
          bottom: -100px; right: -100px;
        }
        .glass-card {
          position: relative;
          z-index: 10;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(40px) saturate(200%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.65);
          border-radius: 36px;
          padding: 3rem 2.25rem;
          max-width: 440px;
          width: 90%;
          text-align: center;
        }
        .avatar-container {
          position: relative;
          width: 110px; height: 110px;
          margin: 0 auto 1.75rem auto;
        }
        .avatar-img-wrap {
          width: 100%; height: 100%;
          border-radius: 50%;
          border: 3px solid #0f172a;
          overflow: hidden;
          background: #1e293b;
        }
        .avatar-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .ios-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          background: ${isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"};
          color: ${isSuccess ? "#34d399" : "#f87171"};
          border: 1px solid ${isSuccess ? "rgba(52, 211, 153, 0.35)" : "rgba(248, 113, 113, 0.35)"};
          margin-bottom: 1.25rem;
        }
        h1 { font-size: 1.85rem; font-weight: 800; margin-bottom: 0.85rem; color: #ffffff; }
        p { font-size: 0.95rem; line-height: 1.65; color: #94a3b8; margin-bottom: 1.75rem; }
        .user-tag {
          display: inline-block;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 700;
          color: #38bdf8;
        }
        .ios-hint {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          padding: 12px 16px;
          font-size: 0.85rem;
          color: #cbd5e1;
        }
        .footer-text { margin-top: 1.75rem; font-size: 0.75rem; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="bg-mesh">
        <div class="blob blob-1"></div>
        <div class="blob blob-2"></div>
      </div>
      <div class="glass-card">
        ${avatarUrl ? `
        <div class="avatar-container">
          <div class="avatar-img-wrap">
            <img src="${escapeHtml(avatarUrl)}" alt="Roblox Avatar">
          </div>
        </div>
        ` : ""}
        <div class="ios-badge">
          <span>${isSuccess ? "Verificación Exitosa" : "Error"}</span>
        </div>
        <h1>${escapeHtml(title)}</h1>
        <p>${message}</p>
        <div class="ios-hint">
          <span>💬 Ya puedes cerrar esta pestaña y regresar a Discord.</span>
        </div>
        <div class="footer-text">Sonora RP System · Powered by Firebase & Roblox OAuth 2.0</div>
      </div>
    </body>
    </html>
  `);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── CLOUD FUNCTION PRINCIPAL ─────────────────────────────────────────────────
export const oauthApp = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host || "joxhup.web.app"}`);

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      res.status(200).json({ status: "ok", timestamp: new Date().toISOString(), service: "Sonora RP OAuth" });
      return;
    }

    if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

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

      // Validar estado firmado
      const oauthState = verifySignedState(state);
      if (!oauthState) {
        renderHtmlResponse(
          res,
          400,
          "Sesión Expirada o Inválida",
          "La sesión de verificación ha expirado o es inválida. Por favor, regresa a Discord y genera un nuevo enlace.",
          false
        );
        return;
      }

      // 1. Intercambiar code por Access Token
      const tokenParams = new URLSearchParams();
      tokenParams.set("client_id", ROBLOX_CLIENT_ID);
      tokenParams.set("client_secret", ROBLOX_CLIENT_SECRET);
      tokenParams.set("grant_type", "authorization_code");
      tokenParams.set("code", code);

      const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
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

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 2. Obtener información del usuario
      const userInfoRes = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoRes.ok) {
        renderHtmlResponse(res, 500, "Error de Perfil", "No se pudo obtener la información de tu perfil de Roblox.", false);
        return;
      }

      const userInfo = await userInfoRes.json();
      const robloxUserId = Number(userInfo.sub);
      const robloxUsername = userInfo.preferred_username || userInfo.name || `User_${robloxUserId}`;
      const robloxDisplayName = userInfo.nickname || robloxUsername;

      // 3. Avatar headshot
      let avatarUrl = userInfo.picture || "";
      if (!avatarUrl) {
        try {
          const thumbRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxUserId}&size=150x150&format=Png&isCircular=false`
          );
          if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            if (thumbData.data?.[0]?.imageUrl) {
              avatarUrl = thumbData.data[0].imageUrl;
            }
          }
        } catch { /* ok */ }
      }

      // 4. Guardar en MongoDB
      await connectDb();
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

      // 5. Asignar roles y apodo en Discord REST API
      const targetGuildId = oauthState.guildId || GUILD_ID;
      const targetDiscordUserId = oauthState.discordUserId;

      if (DISCORD_TOKEN) {
        try {
          // Obtener miembro actual
          const memberRes = await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${targetDiscordUserId}`, {
            headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
          });

          if (memberRes.ok) {
            const memberData = await memberRes.json();
            const currentRoles = new Set(memberData.roles || []);

            // Agregar roles de verificado y quitar rol de no verificado
            VERIFIED_ROLE_IDS.forEach(r => currentRoles.add(r));
            currentRoles.delete(UNVERIFIED_ROLE_ID);

            // Actualizar roles y apodo
            await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${targetDiscordUserId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bot ${DISCORD_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                roles: Array.from(currentRoles),
                nick: robloxUsername,
              }),
            });
          }

          // Enviar log al canal de Discord
          const logPayload = {
            embeds: [
              {
                title: "✅ Usuario Verificado vía OAuth 2.0 (Firebase Cloud)",
                description: `<@${targetDiscordUserId}> ha vinculado su cuenta oficial de Roblox.`,
                color: 0x10b981,
                thumbnail: { url: avatarUrl || "https://images.rbxcdn.com/264531478229e71e72e1c3e38706d8a3.png" },
                fields: [
                  { name: "› Discord", value: `<@${targetDiscordUserId}> (\`${targetDiscordUserId}\`)`, inline: true },
                  { name: "› Roblox Username", value: `\`@${robloxUsername}\``, inline: true },
                  { name: "› Roblox ID", value: `\`${robloxUserId}\``, inline: true },
                  { name: "› Perfil de Roblox", value: `[Ver Perfil](https://www.roblox.com/users/${robloxUserId}/profile)`, inline: false },
                ],
                footer: { text: `Sonora RP System · ${new Date().toLocaleString("es-MX")}` },
              },
            ],
          };

          await fetch(`https://discord.com/api/v10/channels/${LOG_CHANNEL_ID}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${DISCORD_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(logPayload),
          }).catch(() => {});
        } catch (discordErr) {
          console.error("[OAUTH] Error actualizando Discord vía REST API:", discordErr);
        }
      }

      // 6. Respuesta HTML Exitosa
      renderHtmlResponse(
        res,
        200,
        "¡Verificación Exitosa!",
        `¡Bienvenid@ a <strong>Sonora RP</strong>!<br><br>Tu cuenta de Discord ha sido vinculada correctamente con el usuario de Roblox <span class="user-tag">@${escapeHtml(robloxUsername)}</span>.<br><br>Se te han otorgado los roles de <strong>Ciudadano</strong> y desbloqueado el acceso completo a los canales.`,
        true,
        avatarUrl
      );
      return;
    }

    // Ruta raíz por defecto
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Sonora RP OAuth Server</title></head>
      <body style="background:#030712;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
        <h2>🟢 Sonora RP OAuth 2.0 Web Server en Firebase</h2>
        <p>Servicio activo 24/7 para verificación oficial con Roblox.</p>
      </body>
      </html>
    `);
  } catch (globalErr) {
    console.error("[OAUTH FUNCTION] Error crítico:", globalErr);
    renderHtmlResponse(res, 500, "Error del Servidor", "Ocurrió un error inesperado al procesar la verificación.", false);
  }
});
