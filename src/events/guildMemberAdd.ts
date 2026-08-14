import { Events, type GuildMember } from "discord.js";
import { processWelcomeFlow } from "../utils/welcomeService.js";
import { VerifiedUser } from "../models/VerifiedUser.js";
import { config } from "../config.js";

export const name = Events.GuildMemberAdd;

export async function execute(member: GuildMember): Promise<void> {
  try {
    // 1. Auto-restaurar verificación si el usuario ya está registrado en MongoDB
    const verifiedUser = await VerifiedUser.findOne({ discordId: member.id });
    if (verifiedUser) {
      for (const roleId of config.verifiedRoleIds) {
        await member.roles.add(roleId).catch((err) =>
          console.error(`[GUILD_MEMBER_ADD] Error asignando rol verificado ${roleId}:`, err.message)
        );
      }

      if (config.unverifiedRoleId) {
        await member.roles.remove(config.unverifiedRoleId).catch(() => undefined);
      }

      await member.setNickname(verifiedUser.robloxName).catch((err) =>
        console.log(`[GUILD_MEMBER_ADD] No se pudo cambiar apodo a ${verifiedUser.robloxName}:`, err.message)
      );

      console.log(`[GUILD_MEMBER_ADD] ✅ Roles de verificado restaurados automáticamente para ${member.user.tag} (@${verifiedUser.robloxName})`);
    }

    // 2. Procesar flujo de bienvenida estándar
    await processWelcomeFlow(member);
  } catch (err) {
    console.error("[GUILD_MEMBER_ADD] Error procesando bienvenida:", err);
  }
}
