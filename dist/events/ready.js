import { ActivityType } from "discord.js";
import { cleanExpiredCooldowns } from "../utils/cooldown.js";
export const name = "clientReady";
export const once = true;
export async function execute(client) {
    console.log(`[READY] Conectado como ${client.user?.tag}`);
    // Presencia del bot (rotación entre MEXERP y Code: MEXERPA)
    const activities = [
        { name: "MEXERP", type: ActivityType.Playing },
        { name: "Code: MEXERPA", type: ActivityType.Watching },
    ];
    let activityIndex = 0;
    const updatePresence = () => {
        const act = activities[activityIndex];
        if (act) {
            client.user?.setPresence({
                activities: [act],
                status: "online",
            });
        }
        activityIndex = (activityIndex + 1) % activities.length;
    };
    updatePresence();
    setInterval(updatePresence, 30_000);
    // Limpiar cooldowns expirados cada 5 minutos
    setInterval(cleanExpiredCooldowns, 5 * 60 * 1000);
    console.log(`[READY] MEXERP System listo. ${new Date().toLocaleString("es-ES")}`);
}
