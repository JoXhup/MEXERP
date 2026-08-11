import { type Message, Events } from "discord.js";
import { sendErlcApiErrorContainer } from "../handlers/erlcHandler.js";
import { documentCache, buildAISystemPrompt } from "../utils/documentCache.js";
import { config } from "../config.js";

// ─── Canal de IA Auto-respuesta ───────────────────────────────────────────────
const AI_CHANNEL_ID = "1528875068203991150";
const TICKET_CHANNEL_URL = "https://discord.com/channels/1528571127352262866/1528868846906114321";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

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

  // ─── Canal de IA ────────────────────────────────────────────────────────────
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

// ─── Handler de Auto-respuesta IA ─────────────────────────────────────────────
async function handleAIChannel(message: Message): Promise<void> {
  const pregunta = message.content.trim();
  if (!pregunta || pregunta.length < 2) return;

  const guildId = message.guildId ?? "global";

  // Mostrar "escribiendo..."
  if ("sendTyping" in message.channel) {
    await (message.channel as any).sendTyping().catch(() => {});
  }

  // Asegurar que la cache de MongoDB esté cargada
  await documentCache.ensureLoaded(guildId);

  const combined = documentCache.getCombined(guildId);

  // Si no hay conocimiento cargado
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
    `REGLA ADICIONAL PARA CANAL DE TEXTO:\n` +
    `Si la duda NO se puede responder con el conocimiento de la base de datos o no hay suficientes datos fidedignos, responde ÚNICAMENTE con la palabra: "NO_INFO".`;

  let respuesta = "";
  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: pregunta },
        ],
        max_tokens: 1200,
        temperature: 0.25,
      }),
    }) as any;

    if (!res.ok) {
      console.error("[AI_CHANNEL] Error Groq:", res.status);
      return;
    }

    const data = (await res.json()) as any;
    respuesta = data?.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[AI_CHANNEL] Error fetch Groq:", err);
    return;
  }

  if (!respuesta) return;

  // Si la IA no encontró la info en el conocimiento
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

  // Truncar si supera el límite de Discord
  if (respuesta.length > 1900) {
    respuesta = respuesta.substring(0, 1900) + "\n\n*(Respuesta truncada por longitud)*";
  }

  await message.reply({
    content: respuesta,
  });
}
