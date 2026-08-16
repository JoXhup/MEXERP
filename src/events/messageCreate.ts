import { type Message, Events } from "discord.js";
import { sendErlcApiErrorContainer } from "../handlers/erlcHandler.js";
import { documentCache, buildAISystemPrompt } from "../utils/documentCache.js";
import { queryGroq } from "../utils/ai.js";
import { config } from "../config.js";
import { Ticket } from "../models/Ticket.js";
import { CATEGORIES } from "../constants/categories.js";

// ─── Canal de IA Auto-respuesta ───────────────────────────────────────────────
const AI_CHANNEL_ID = "1528875068203991150";
const TICKET_CHANNEL_URL = "https://discord.com/channels/1528571127352262866/1528868846906114321";

const erlcCmdNames = new Set([
  "h", "m", "pm", "kill", "down", "refresh", "respawn", "load", "heal",
  "kick", "ban", "unban", "jail", "unjail", "free", "wanted", "unwanted",
  "bring", "to", "tp", "tocar", "toatv", "view", "time", "weather",
  "startfire", "startnearfire", "stopfire", "stopdumpsterfire", "bans",
  "admins", "mods", "helpers", "cmds", "commands", "logs", "mod", "unmod",
  "helper", "unhelper", "admin", "unadmin",
]);

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot || !message.content) return;

  // ─── Asistencia de IA en Tickets (Mientras el ticket esté sin reclamar) ─────
  const ticket = await Ticket.findOne({ channelId: message.channelId });
  if (ticket && ticket.status === "open" && !ticket.claimedBy) {
    await handleTicketAIResponse(message, ticket);
    return;
  }

  // ─── Canal de IA General ───────────────────────────────────────────────────
  if (message.channelId === AI_CHANNEL_ID) {
    await handleAIChannel(message);
    return;
  }

  // ─── Comandos ERLC ──────────────────────────────────────────────────────────
  const content = message.content.trim();
  if (!content.startsWith(":")) return;

  const firstWord = content.slice(1).split(/\s+/)[0].toLowerCase();
  if (erlcCmdNames.has(firstWord)) {
    await sendErlcApiErrorContainer(message, firstWord);
  }
}

// ─── Handler de Asistencia IA en Tickets (Sin Reclamar) ───────────────────────
async function handleTicketAIResponse(message: Message, ticket: any): Promise<void> {
  const userQuery = message.content.trim();
  if (!userQuery || userQuery.length < 2) return;

  const guildId = message.guildId ?? "global";

  // Mostrar "escribiendo..." en el canal del ticket
  if ("sendTyping" in message.channel) {
    await (message.channel as any).sendTyping().catch(() => {});
  }

  // Cargar base de datos / conocimiento del servidor
  await documentCache.ensureLoaded(guildId);
  const combined = documentCache.getCombined(guildId, userQuery);

  if (!config.groqApiKey) return;

  const cat = CATEGORIES[ticket.category];
  const catLabel = cat?.label ?? ticket.category;

  const systemPrompt =
    `${buildAISystemPrompt(combined)}\n\n` +
    `ASISTENTE VIRTUAL DE SOPORTE INTERNO — SONORA RP:\n` +
    `Estás respondiendo en un ticket de soporte de la categoría "${catLabel}" abierto por el usuario <@${ticket.ownerId}>.\n` +
    `INSTRUCCIONES OBLIGATORIAS:\n` +
    `1. Responde de forma amigable, atenta y respetuosa como el asistente virtual oficial del Staff de Sonora RP en chat directo.\n` +
    `2. Basa tus respuestas ÚNICAMENTE en cómo funciona Sonora RP y en los comandos/sistemas del BOT (ej: /arrestar, /multar, /ine, /estado, etc.). NUNCA hables del código de programación ni utilices información externa ajena al servidor.\n` +
    `3. Si el usuario pregunta por reglamentos, normas, tablas o canales, PROPORCIONA LOS ENLACES DIRECTOS Y MENCIONES DE CANALES correspondientes.\n` +
    `4. Si NO dispones de información o no está en la base de datos, sé totalmente SINCERO y responde que no cuentas con ese registro en este momento, indicando que espere a que un administrador atienda el ticket. NUNCA inventes información falsa.\n` +
    `5. NO utilices embeds, contenedores ni tarjetas. Responde en MENSAJE DE TEXTO PLANO conversacional.\n` +
    `6. En cuanto un miembro del staff reclame el ticket, tú dejarás de responder.`;

  try {
    let respuesta = await queryGroq({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    if (respuesta) {
      if (respuesta.length > 1900) {
        respuesta = respuesta.substring(0, 1900) + "...";
      }
      await message.reply({ content: respuesta, allowedMentions: { repliedUser: false } });
    }
  } catch (err: any) {
    console.error("[TICKET_AI] Error procesando respuesta de IA en ticket:", err.message);
  }
}

// ─── Handler de Auto-respuesta IA Canal General ──────────────────────────────
async function handleAIChannel(message: Message): Promise<void> {
  const pregunta = message.content.trim();
  if (!pregunta || pregunta.length < 2) return;

  const guildId = message.guildId ?? "global";

  if ("sendTyping" in message.channel) {
    await (message.channel as any).sendTyping().catch(() => {});
  }

  await documentCache.ensureLoaded(guildId);
  const combined = documentCache.getCombined(guildId, pregunta);

  if (combined.count === 0) {
    await message.reply({
      content: [
        "⚠️ **No se encuentra información ni reglamentos cargados en la base de datos.**",
        "",
        `Para resolver tu inquietud o recibir asistencia del equipo de Staff, abre un ticket aquí:`,
        `👉 ${TICKET_CHANNEL_URL}`,
      ].join("\n"),
    });
    return;
  }

  if (!config.groqApiKey) {
    console.error("[AI_CHANNEL] Falta GROQ_API_KEY en el entorno.");
    return;
  }

  const systemPrompt =
    `${buildAISystemPrompt(combined)}\n\n` +
    `REGLA ADICIONAL PARA EL CANAL DE DUDAS:\n` +
    `Busca exhaustivamente en todos los documentos cargados (Códigos Penales, Reglamentos, Manuales, Títulos, Capítulos, Artículos y Secciones).\n` +
    `Relaciona los términos de la pregunta aunque tengan pequeñas variaciones informales.\n` +
    `ÚNICAMENTE si la duda es completamente ajena y no existe ninguna información o antecedente en los documentos cargados, responde la palabra clave: "NO_INFO".`;

  let respuesta = "";
  try {
    respuesta = await queryGroq({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: pregunta },
      ],
      temperature: 0.25,
      max_tokens: 1200,
    });
  } catch (err: any) {
    console.error("[AI_CHANNEL] Error en consulta Groq:", err.message);
    return;
  }

  if (!respuesta) return;

  if (respuesta === "NO_INFO" || respuesta.toUpperCase().includes("NO_INFO")) {
    await message.reply({
      content: [
        `❓ **No cuento con información específica sobre esa consulta en mi base de datos.**`,
        "",
        `No tengo registrados reglamentos o datos concretos para responder a tu pregunta en este momento.`,
        "",
        `Para consultar directamente con el equipo administrativo o recibir ayuda, abre un ticket aquí:`,
        `👉 ${TICKET_CHANNEL_URL}`,
      ].join("\n"),
    });
    return;
  }

  if (respuesta.length > 1900) {
    respuesta = respuesta.substring(0, 1900) + "\n\n*(Respuesta truncada por longitud)*";
  }

  await message.reply({
    content: respuesta,
  });
}
