import type { TextChannel, Client } from "discord.js";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { ITicket } from "../models/Ticket.js";
import { CATEGORIES } from "../constants/categories.js";
import { config } from "../config.js";

// ─── GENERADOR DE TRANSCRIPCIONES HTML ────────────────────────────────────────

export async function generateTranscript(
  ticket: ITicket,
  channel: TextChannel,
  client: Client,
): Promise<string> {
  // Asegurar directorio
  const dir = config.transcriptDir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Obtener mensajes del canal (max 100 por limite de Discord API)
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();

  const cat = CATEGORIES[ticket.category]!;

  // ─── CONSTRUIR HTML ───────────────────────────────────────────────────────
  const messagesHtml = sorted.map(msg => {
    const time = msg.createdAt.toLocaleString("es-ES");
    const avatar = msg.author.displayAvatarURL({ size: 64, extension: "png" });
    const isBot = msg.author.bot;

    const attachments = msg.attachments.size > 0
      ? `<div class="attachments">${[...msg.attachments.values()].map(a =>
          a.contentType?.startsWith("image/")
            ? `<img src="${a.url}" alt="attachment" class="img-attach">`
            : `<a href="${a.url}" target="_blank" class="file-attach">${a.name}</a>`
        ).join("")}</div>`
      : "";

    const embeds = msg.embeds.length > 0
      ? `<div class="embeds">[${msg.embeds.length} embed(s)]</div>`
      : "";

    return `
      <div class="message ${isBot ? "bot" : ""}">
        <img src="${avatar}" class="avatar" alt="avatar" onerror="this.src='data:image/svg+xml,<svg/>'">
        <div class="content">
          <span class="author ${isBot ? "bot-name" : ""}">${msg.author.username}</span>
          <span class="timestamp">${time}</span>
          <div class="text">${escapeHtml(msg.content || "")}</div>
          ${attachments}
          ${embeds}
        </div>
      </div>`;
  }).join("\n");

  const modalEntries = [...ticket.modalData.entries()]
    .map(([k, v]) => {
      const field = cat.fields.find(f => f.customId === k);
      return `<div class="modal-field"><strong>${field?.label ?? k}:</strong><p>${escapeHtml(v)}</p></div>`;
    }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcripcion — ${ticket.ticketId.toUpperCase()}</title>
  <style>
    :root {
      --bg: #0f0f1a;
      --surface: #16162a;
      --surface2: #1e1e35;
      --accent: #7c3aed;
      --text: #e2e8f0;
      --muted: #64748b;
      --bot: #5865f2;
      --border: rgba(124,58,237,0.2);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      min-height: 100vh;
    }
    header {
      background: linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 100%);
      border-bottom: 1px solid var(--border);
      padding: 24px 32px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    header .logo {
      font-size: 22px;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: -0.5px;
    }
    header .meta { flex: 1; }
    header h1 { font-size: 18px; font-weight: 600; }
    header .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 99px;
      background: var(--accent);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      padding: 20px 32px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-item .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item .value { font-size: 13px; font-weight: 500; }
    .modal-data {
      padding: 16px 32px;
      background: var(--surface2);
      border-bottom: 1px solid var(--border);
    }
    .modal-data h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 12px; }
    .modal-field { margin-bottom: 10px; }
    .modal-field strong { font-size: 12px; color: var(--accent); }
    .modal-field p { margin-top: 2px; color: var(--text); white-space: pre-wrap; }
    .messages { padding: 16px 32px; display: flex; flex-direction: column; gap: 4px; }
    .messages h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 16px; }
    .message {
      display: flex;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      transition: background 0.15s;
    }
    .message:hover { background: var(--surface); }
    .message.bot { opacity: 0.85; }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      flex-shrink: 0;
      object-fit: cover;
      border: 2px solid var(--border);
    }
    .content { flex: 1; min-width: 0; }
    .author {
      font-weight: 600;
      font-size: 13px;
      color: var(--text);
    }
    .author.bot-name { color: var(--bot); }
    .timestamp {
      font-size: 11px;
      color: var(--muted);
      margin-left: 8px;
    }
    .text {
      margin-top: 2px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
    }
    .img-attach { max-width: 300px; max-height: 300px; border-radius: 6px; margin-top: 6px; display: block; }
    .file-attach { display: inline-block; margin-top: 6px; padding: 4px 10px; background: var(--surface2); border-radius: 4px; color: var(--accent); text-decoration: none; }
    footer {
      text-align: center;
      padding: 24px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <header>
    <div class="meta">
      <div class="logo">Sonora RP</div>
      <h1>${ticket.ticketId.toUpperCase()} <span class="badge">${cat.label}</span></h1>
    </div>
  </header>

  <div class="info-grid">
    <div class="info-item">
      <span class="label">Usuario</span>
      <span class="value">${ticket.ownerTag}</span>
    </div>
    <div class="info-item">
      <span class="label">Categoria</span>
      <span class="value">${cat.label}</span>
    </div>
    <div class="info-item">
      <span class="label">Prioridad</span>
      <span class="value">${ticket.priority}</span>
    </div>
    <div class="info-item">
      <span class="label">Estado</span>
      <span class="value">${ticket.status}</span>
    </div>
    <div class="info-item">
      <span class="label">Abierto</span>
      <span class="value">${ticket.openedAt.toLocaleString("es-ES")}</span>
    </div>
    ${ticket.closedAt ? `
    <div class="info-item">
      <span class="label">Cerrado</span>
      <span class="value">${ticket.closedAt.toLocaleString("es-ES")}</span>
    </div>` : ""}
    ${ticket.claimedBy ? `
    <div class="info-item">
      <span class="label">Reclamado por</span>
      <span class="value">${ticket.claimedByTag ?? ticket.claimedBy}</span>
    </div>` : ""}
    <div class="info-item">
      <span class="label">Mensajes</span>
      <span class="value">${sorted.length}</span>
    </div>
  </div>

  ${ticket.modalData.size > 0 ? `
  <div class="modal-data">
    <h2>Informacion del Ticket</h2>
    ${modalEntries}
  </div>` : ""}

  <div class="messages">
    <h2>Mensajes (${sorted.length})</h2>
    ${messagesHtml}
  </div>

  <footer>
    Transcripcion generada por Sonora RP System · ${new Date().toLocaleString("es-ES")}
  </footer>
</body>
</html>`;

  const filename = `${ticket.ticketId}-${Date.now()}.html`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, html, "utf-8");

  return filepath;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
