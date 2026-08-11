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
import contratarCommand from "./commands/contratar.js";
import despedirCommand from "./commands/despedir.js";
import { data as jornadaData } from "./commands/jornada.js";
import { data as profileData } from "./commands/profile.js";
import { data as verificarData } from "./commands/verificar.js";
import ineCommand from "./commands/ine.js";
import arrestarCommand from "./commands/arrestar.js";
import estadoCommand from "./commands/estado.js";
import depositarCommand from "./commands/depositar.js";
import retirarCommand from "./commands/retirar.js";
import transferirCommand from "./commands/transferir.js";
import transferenciasCommand from "./commands/transferencias.js";
import cobrarCommand from "./commands/cobrar.js";
import lavarCommand from "./commands/lavar.js";
import historialCommand from "./commands/historial.js";
import economiaCommand from "./commands/economia.js";
import multarCommand from "./commands/multar.js";
import multasCommand from "./commands/multas.js";
import cmdCommand from "./commands/cmd.js";
import bienvenidaCommand from "./commands/bienvenida.js";
import pingCommand from "./commands/ping.js";
import tryoutCommand from "./commands/tryout.js";
import narcopostCommand from "./commands/narcopost.js";
import subirCommand from "./commands/subir.js";

const commands = [
  panelCommand,
  statsCommand,
  contratarCommand,
  despedirCommand,
  ineCommand,
  arrestarCommand,
  estadoCommand,
  depositarCommand,
  retirarCommand,
  transferirCommand,
  transferenciasCommand,
  cobrarCommand,
  lavarCommand,
  historialCommand,
  economiaCommand,
  multarCommand,
  multasCommand,
  cmdCommand,
  bienvenidaCommand,
  pingCommand,
  tryoutCommand,
  narcopostCommand,
  subirCommand,
].map(cmd => cmd.data);
commands.push(jornadaData.toJSON() as any);
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
