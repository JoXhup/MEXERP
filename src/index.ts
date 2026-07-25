import "dotenv/config";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import mongoose from "mongoose";
import { config } from "./config.js";
import type { Command } from "./types/index.js";

// ─── IMPORTAR COMANDOS ─────────────────────────────────────────────────────────
import panelCommand from "./commands/panel.js";
import statsCommand from "./commands/stats.js";
import * as profileCommand from "./commands/profile.js";
import * as verificarCommand from "./commands/verificar.js";

// ─── IMPORTAR EVENTOS ─────────────────────────────────────────────────────────
import * as readyEvent from "./events/ready.js";
import * as interactionEvent from "./events/interactionCreate.js";

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
  profileCommand as unknown as Command,
  verificarCommand as unknown as Command,
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
process.on("unhandledRejection", err => console.error("[PROCESS] Unhandled rejection:", err));
process.on("uncaughtException", err => {
  console.error("[PROCESS] Uncaught exception:", err);
  process.exit(1);
});

// ─── CONECTAR A MONGODB ───────────────────────────────────────────────────────
console.log("[DB] Conectando a MongoDB...");
await mongoose.connect(config.mongoUri, {
  serverSelectionTimeoutMS: 10_000,
});
console.log("[DB] Conectado a MongoDB exitosamente.");

// ─── LOGIN ────────────────────────────────────────────────────────────────────
console.log("[BOT] Iniciando sesion...");
await client.login(config.token);
