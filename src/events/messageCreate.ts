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
  if (!userQuery || userQuery.length < 1) return;

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
    `Estás respondiendo en el ticket de la categoría "${catLabel}" abierto por <@${ticket.ownerId}>.\n` +
    `Mantén el hilo de la conversación recordando los mensajes anteriores de la charla.`;

  // Construir historial de mensajes recientes (últimos 8) para continuidad de chat
  const historyMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  try {
    const recent = await message.channel.messages.fetch({ limit: 8 }).catch(() => null);
    if (recent) {
      const sorted = Array.from(recent.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const m of sorted) {
        if (!m.content || m.content.startsWith(":") || m.components?.length > 0) continue;
        const role = m.author.id === message.client.user?.id ? "assistant" : "user";
        historyMessages.push({ role, content: m.content });
      }
    } else {
      historyMessages.push({ role: "user", content: userQuery });
    }
  } catch {
    historyMessages.push({ role: "user", content: userQuery });
  }

  try {
    let respuesta = await queryGroq({
      messages: historyMessages,
      temperature: 0.2,
      max_tokens: 1000,
    });

    if (respuesta) {
      respuesta = cleanRepetitiveResponse(respuesta);
      if (respuesta.length > 1900) {
        respuesta = respuesta.substring(0, 1900) + "...";
      }
      await message.reply({ content: respuesta, allowedMentions: { repliedUser: false } });
    }
  } catch (err: any) {
    console.error("[TICKET_AI] Error procesando respuesta de IA en ticket:", err.message);
    await message.reply({
      content: "¡Hola! En este momento mis sistemas de IA están ajustando su carga, pero he registrado tu consulta. Un miembro del equipo de Staff te atenderá aquí en breve. 🙌",
      allowedMentions: { repliedUser: false },
    }).catch(() => null);
  }
}

// ─── Handler de Auto-respuesta IA Canal General ──────────────────────────────
async function handleAIChannel(message: Message): Promise<void> {
  const pregunta = message.content.trim();
  if (!pregunta || pregunta.length < 1) return;

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
    `Si la duda es completamente ajena a Sonora RP, responde que solo atiendes dudas del servidor.\n` +
    `ÚNICAMENTE si la duda es sobre el servidor pero NO existe información en los documentos cargados, responde la palabra clave: "NO_INFO".`;

  // Construir historial de mensajes recientes (últimos 8)
  const historyMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  try {
    const recent = await message.channel.messages.fetch({ limit: 8 }).catch(() => null);
    if (recent) {
      const sorted = Array.from(recent.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      for (const m of sorted) {
        if (!m.content || m.content.startsWith(":") || m.components?.length > 0) continue;
        const role = m.author.id === message.client.user?.id ? "assistant" : "user";
        historyMessages.push({ role, content: m.content });
      }
    } else {
      historyMessages.push({ role: "user", content: pregunta });
    }
  } catch {
    historyMessages.push({ role: "user", content: pregunta });
  }

  let respuesta = "";
  try {
    respuesta = await queryGroq({
      messages: historyMessages,
      temperature: 0.2,
      max_tokens: 1200,
    });
  } catch (err: any) {
    console.error("[AI_CHANNEL] Error en consulta Groq:", err.message);
    return;
  }

  if (!respuesta) return;

  respuesta = cleanRepetitiveResponse(respuesta);

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

function cleanRepetitiveResponse(text: string): string {
  if (!text) return text;
  // Corregir menciones de canal corruptas como <#1528571127352262866/1528973867362812024> -> <#1528973867362812024>
  let cleaned = text.replace(/<#\d+\/(\d+)>/g, "<#$1>");

  // Evitar bucles repetitivos si la IA duplica líneas o frases
  const lines = cleaned.split("\n");
  const resultLines: string[] = [];
  const seenLines = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (seenLines.has(trimmed) && trimmed.length > 10) {
      continue;
    }
    if (trimmed.length > 10) {
      seenLines.add(trimmed);
    }
    resultLines.push(line);
  }

  return resultLines.join("\n").trim();
}
