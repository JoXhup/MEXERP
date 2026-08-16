import { config } from "../config.js";

export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen-2.5-coder-32b",
  "llama-3.2-3b-preview",
];

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QueryGroqOptions {
  messages: GroqChatMessage[];
  temperature?: number;
  max_tokens?: number;
  apiKey?: string;
}

/**
 * Consulta a la API de Groq con sistema de Fallback de Modelos activos,
 * auto-ajuste de tamaño por cuota TPM (413) y reintento en 429 (Rate Limit).
 */
export async function queryGroq(options: QueryGroqOptions): Promise<string> {
  const apiKey = options.apiKey || config.groqApiKey;
  if (!apiKey) {
    throw new Error("No hay API Key de Groq configurada.");
  }

  const temperature = options.temperature ?? 0.3;
  const max_tokens = options.max_tokens ?? 1200;
  let lastError: any = null;

  // Clone de mensajes para poder ajustar tamaño en caso de 413
  let messages = options.messages.map((m) => ({ ...m }));

  for (const model of GROQ_MODELS) {
    try {
      console.log(`[GROQ_AI] Intentando consulta con modelo: ${model}`);
      const res = (await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens,
        }),
      })) as any;

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log(`[GROQ_AI] ✅ Éxito con modelo ${model}`);
          return text;
        }
      }

      if (res.status === 429) {
        console.warn(`[GROQ_AI] ⚠️ Rate Limit (429) en ${model}. Probando siguiente modelo...`);
        lastError = new Error(`429 Rate Limit en ${model}`);
        continue;
      }

      if (res.status === 413) {
        console.warn(`[GROQ_AI] ⚠️ 413 Request Too Large en ${model} (Límite TPM). Ajustando contexto...`);
        // Recortar el mensaje system a un tamaño seguro de 12,000 chars
        if (messages[0] && messages[0].content.length > 12000) {
          messages[0].content = messages[0].content.substring(0, 12000) + "\n\n[... contexto ajustado por límite TPM ...]";
        }
        lastError = new Error(`413 Request Too Large en ${model}`);
        continue;
      }

      const errData = (await res.json().catch(() => ({}))) as any;
      const errMsg = errData?.error?.message ?? res.statusText ?? res.status;
      console.warn(`[GROQ_AI] Error con modelo ${model} (${res.status}): ${errMsg}`);
      lastError = new Error(errMsg);
    } catch (err: any) {
      console.error(`[GROQ_AI] Error de red/fetch con ${model}:`, err.message);
      lastError = err;
    }
  }

  // Reintento final de emergencia con llama-3.1-8b-instant y contexto acotado
  console.warn("[GROQ_AI] Todos los modelos fallaron. Aplicando reintento de emergencia (1.5s)...");
  await new Promise((r) => setTimeout(r, 1500));

  try {
    // Asegurar contexto acotado para no exceder 6,000 TPM
    if (messages[0] && messages[0].content.length > 10000) {
      messages[0].content = messages[0].content.substring(0, 10000) + "\n\n[... contexto recortado ...] ";
    }

    const res = (await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature,
        max_tokens: 1000,
      }),
    })) as any;

    if (res.ok) {
      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    }
  } catch (reintErr: any) {
    console.error("[GROQ_AI] Falló el reintento final:", reintErr);
  }

  throw lastError || new Error("No se pudo obtener respuesta de Groq AI.");
}
