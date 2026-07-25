// ─── SISTEMA DE COOLDOWN EN MEMORIA ───────────────────────────────────────────
// Usa un Map simple en memoria para cooldowns sin depender de Redis
const cooldownMap = new Map();
/**
 * Verifica si un usuario esta en cooldown.
 * @returns Milisegundos restantes (0 si no hay cooldown).
 */
export function getCooldownRemaining(userId, action) {
    const key = `${action}:${userId}`;
    const expiresAt = cooldownMap.get(key);
    if (!expiresAt)
        return 0;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
        cooldownMap.delete(key);
        return 0;
    }
    return remaining;
}
/**
 * Establece un cooldown para un usuario.
 */
export function setCooldown(userId, action, ms) {
    const key = `${action}:${userId}`;
    cooldownMap.set(key, Date.now() + ms);
}
/**
 * Limpia todos los cooldowns expirados (llamar periodicamente).
 */
export function cleanExpiredCooldowns() {
    const now = Date.now();
    for (const [key, expiresAt] of cooldownMap.entries()) {
        if (expiresAt <= now)
            cooldownMap.delete(key);
    }
}
/** Formatea ms en formato legible */
export function formatMs(ms) {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60)
        return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
}
