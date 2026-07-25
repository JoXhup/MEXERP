/**
 * deploy.ts — Registra los slash commands en Discord
 * Ejecutar con: bun run src/deploy.ts
 */

import "dotenv/config";
import { REST, Routes } from "discord.js";
import { config } from "./config.js";

// Importar datos de los comandos
import panelCommand from "./commands/panel.js";
import statsCommand from "./commands/stats.js";
import { data as profileData } from "./commands/profile.js";
import { data as verificarData } from "./commands/verificar.js";

const commands = [panelCommand, statsCommand].map(cmd => cmd.data);
commands.push(profileData.toJSON() as any);
commands.push(verificarData.toJSON() as any);

const rest = new REST({ version: "10" }).setToken(config.token);

console.log("[DEPLOY] Registrando slash commands...");

try {
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands },
  );
  console.log("[DEPLOY] Comandos registrados exitosamente:");
  for (const cmd of commands) {
    console.log(`  /${(cmd as { name: string }).name}`);
  }
} catch (err) {
  console.error("[DEPLOY] Error al registrar comandos:", err);
  process.exit(1);
}
