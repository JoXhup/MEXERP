import "dotenv/config";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import mongoose from "mongoose";
import { config } from "./config.js";
import type { Command } from "./types/index.js";

// MEXERP Bot v1.1.0 - Staff management, shifts & aperturas panel

// ─── IMPORTAR COMANDOS ─────────────────────────────────────────────────────────
import panelCommand from "./commands/panel.js";
import statsCommand from "./commands/stats.js";
import contratarCommand from "./commands/contratar.js";
import despedirCommand from "./commands/despedir.js";
import * as jornadaCommand from "./commands/jornada.js";
import * as profileCommand from "./commands/profile.js";
import * as verificarCommand from "./commands/verificar.js";
import ineCommand from "./commands/ine.js";

// ─── IMPORTAR EVENTOS ─────────────────────────────────────────────────────────
import * as readyEvent from "./events/ready.js";
import * as interactionEvent from "./events/interactionCreate.js";

import { DefaultWebSocketManagerOptions } from "@discordjs/ws";

// Forzar identificacion de Gateway como Discord Android en @discordjs/ws
(DefaultWebSocketManagerOptions as any).identifyProperties = {
  $os: "android",
  $browser: "Discord Android",
  $device: "Discord Android",
};

// ─── CREAR CLIENTE ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ─── COLECCION DE COMANDOS ────────────────────────────────────────────────────
client.commands = new Collection<string, Command>();

const commands: Command[] = [
  panelCommand,
  statsCommand,
  contratarCommand,
  despedirCommand,
  jornadaCommand as unknown as Command,
  profileCommand as unknown as Command,
  verificarCommand as unknown as Command,
  ineCommand,
];
for (const cmd of commands) {
  const name = (cmd.data as { name: string }).name;
  client.commands.set(name, cmd);
  console.log(`[COMMANDS] Cargado: /${name}`);
}

// ─── REGISTRAR EVENTOS ────────────────────────────────────────────────────────
client.once("clientReady", () => readyEvent.execute(client));

client.on(interactionEvent.name, async (...args) => {
  await interactionEvent.execute(args[0] as any, client);
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
client.on("error", err => console.error("[CLIENT] Error:", err));
client.on("warn", msg => console.warn("[CLIENT] Warn:", msg));
client.on("shardDisconnect", (event, id) => console.warn(`[CLIENT] Shard ${id} desconectado, codigo: ${event.code}`));
client.on("shardReconnecting", id => console.log(`[CLIENT] Shard ${id} reconectando...`));
client.on("shardResume", (id, replayed) => console.log(`[CLIENT] Shard ${id} reconectado. Eventos: ${replayed}`));
process.on("unhandledRejection", err => console.error("[PROCESS] Unhandled rejection:", err));
process.on("uncaughtException", err => {
  // Logear el error pero NO salir — Pterodactyl mataría el proceso
  console.error("[PROCESS] Uncaught exception (no-exit):", err);
});

// ─── CONECTAR A MONGODB ───────────────────────────────────────────────────────
console.log("[DB] Conectando a MongoDB...");
await mongoose.connect(config.mongoUri, {
  serverSelectionTimeoutMS: 10_000,
});
console.log("[DB] Conectado a MongoDB exitosamente.");

// ─── LOGIN & KEEPALIVE ────────────────────────────────────────────────────────
console.log("[BOT] Iniciando sesion...");
await client.login(config.token);

// Mantener el event loop activo indefinidamente para evitar que Bun o Node.js cierren el proceso
setInterval(() => {
  if (!client.isReady()) {
    console.warn("[KEEPALIVE] Cliente no listo, intentando reconectar...");
  }
}, 60_000);

// Capturar senales de cierre para depuracion
process.on("SIGINT", () => console.log("[PROCESS] Recibida senal SIGINT (detencion solicitada por el servidor/panel)"));
process.on("SIGTERM", () => console.log("[PROCESS] Recibida senal SIGTERM (detencion solicitada por el servidor/panel)"));
process.on("beforeExit", (code) => console.warn(`[PROCESS] El event loop se vacio. Codigo de salida: ${code}`));
process.on("exit", (code) => console.log(`[PROCESS] Proceso finalizado con codigo: ${code}`));

