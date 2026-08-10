import { Events } from "discord.js";
import { processWelcomeFlow } from "../utils/welcomeService.js";
export const name = Events.GuildMemberAdd;
export async function execute(member) {
    try {
        await processWelcomeFlow(member);
    }
    catch (err) {
        console.error("[GUILD_MEMBER_ADD] Error procesando bienvenida:", err);
    }
}
