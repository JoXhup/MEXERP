/**
 * rawInteractionStore.ts
 *
 * discord.js v14 NO parsea resolved.attachments en ModalSubmitInteraction
 * cuando se usa Components V2 con FILE_UPLOAD (type 19).
 *
 * Este módulo intercepta el paquete WebSocket RAW de Discord y guarda
 * los datos de `resolved` antes de que discord.js los descarte, usando
 * el interactionId como clave.
 *
 * Uso:
 *   1. Registrar el listener: registerRawListener(client)
 *   2. En el modal submit handler: getRawResolved(interaction.id)
 */

import type { Client } from "discord.js";

// Mapa: interactionId → resolved (attachments, etc.)
const resolvedStore = new Map<
  string,
  {
    attachments?: Record<
      string,
      { id: string; filename: string; url: string; proxy_url: string; content_type?: string; size: number }
    >;
  }
>();

// TTL: 5 minutos. Modals deben responderse en 3s pero esto da margen de sobra.
const TTL_MS = 5 * 60 * 1000;

/**
 * Registra el listener en el evento 'raw' del cliente Discord.
 * Debe llamarse UNA vez después de que el cliente se conecte.
 */
export function registerRawListener(client: Client): void {
  client.on("raw", (packet: any) => {
    // Solo nos interesan INTERACTION_CREATE de tipo 5 (MODAL_SUBMIT)
    if (packet.t !== "INTERACTION_CREATE") return;
    const d = packet.d;
    if (!d || d.type !== 5) return; // 5 = MODAL_SUBMIT

    const interactionId: string = d.id;
    const resolved = d.data?.resolved;

    if (resolved && Object.keys(resolved).length > 0) {
      console.log(
        `[RAW_STORE] Guardando resolved para interaction ${interactionId}:`,
        JSON.stringify(resolved, null, 2).substring(0, 800)
      );
      resolvedStore.set(interactionId, resolved);

      // Auto-limpiar después del TTL
      setTimeout(() => resolvedStore.delete(interactionId), TTL_MS);
    } else {
      // Guardar también components para buscar snowflake IDs
      const components = d.data?.components ?? [];
      console.log(
        `[RAW_STORE] No hay resolved para interaction ${interactionId}. Components:`,
        JSON.stringify(components, null, 2).substring(0, 500)
      );
    }
  });

  console.log("[RAW_STORE] Listener raw de interacciones registrado.");
}

/**
 * Retorna el objeto resolved guardado para un interactionId dado.
 * Retorna undefined si no se encontró (interacción sin archivos o ya expirada).
 */
export function getRawResolved(
  interactionId: string
): ReturnType<typeof resolvedStore.get> {
  return resolvedStore.get(interactionId);
}
