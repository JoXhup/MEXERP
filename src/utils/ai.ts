import { config } from "../config.js";

// Lista de modelos de Groq por orden de preferencia y fallback
export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
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
 * Consulta a la API de Groq con sistema de Fallback de Modelos y Reintento automático en caso de 429 (Rate Limit).
 */
export async function queryGroq(options: QueryGroqOptions): Promise<string> {
  const apiKey = options.apiKey || config.groqApiKey;
  if (!apiKey) {
    throw new Error("No hay API Key de Groq configurada.");
  }

  const temperature = options.temperature ?? 0.3;
  const max_tokens = options.max_tokens ?? 3500;
  let lastError: any = null;

  // Probar cada modelo en orden de fallback
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
          messages: options.messages,
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
        console.warn(`[GROQ_AI] ⚠️ Rate Limit (429) alcanzado para ${model}. Probando siguiente modelo...`);
        lastError = new Error(`429 Rate Limit en ${model}`);
        continue; // Probar el siguiente modelo inmediatamente
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

  // Si todos los modelos dieron 429 o fallaron, esperar 1.5s y reintentar con llama-3.1-8b-instant
  console.warn("[GROQ_AI] Todos los modelos principales fallaron/429. Aplicando reintento con espera de 1.5s...");
  await new Promise((r) => setTimeout(r, 1500));

  try {
    const res = (await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: options.messages,
        temperature,
        max_tokens,
      }),
    })) as any;

    if (res.ok) {
      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    }
  } catch (reintErr: any) {
    console.error("[GROQ_AI] Falló el reintento secundario:", reintErr);
  }

  throw lastError || new Error("No se pudo obtener respuesta de Groq AI.");
}
