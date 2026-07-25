import type { GuildMember } from "discord.js";
import { config } from "../config.js";

/**
 * Verifica si un miembro tiene algun rol de admin configurado.
 * Cubre todos los roles en config.adminRoleIds.
 */
export function isAdmin(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  return config.adminRoleIds.some(roleId => member.roles.cache.has(roleId));
}
