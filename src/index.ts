import "dotenv/config";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import mongoose from "mongoose";
import { config } from "./config.js";
import type { Command } from "./types/index.js";
import { startFineService } from "./utils/fineService.js";
import { registerRawListener } from "./utils/rawInteractionStore.js";
import { startOAuthServer } from "./services/robloxOAuthServer.js";

// SNRP Bot v1.1.0 - Staff management, shifts & aperturas panel

// ─── IMPORTAR COMANDOS ─────────────────────────────────────────────────────────
import panelCommand from "./commands/panel.js";
import statsCommand from "./commands/stats.js";
import contratarCommand from "./commands/contratar.js";
import despedirCommand from "./commands/despedir.js";
import * as jornadaModule from "./commands/jornada.js";
import * as profileModule from "./commands/profile.js";
import * as verificarModule from "./commands/verificar.js";
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
import lockupCommand from "./commands/lockup.js";
import warnCommand from "./commands/warn.js";
import sancionCommand from "./commands/sancion.js";
import ckCommand from "./commands/ck.js";

// ─── IMPORTAR EVENTOS ─────────────────────────────────────────────────────────
import * as readyEvent from "./events/ready.js";
import * as interactionEvent from "./events/interactionCreate.js";
import * as messageCreateEvent from "./events/messageCreate.js";
import * as guildMemberAddEvent from "./events/guildMemberAdd.js";
import * as guildMemberUpdateEvent from "./events/guildMemberUpdate.js";

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
  { data: jornadaModule.data, execute: jornadaModule.execute } as unknown as Command,
  { data: profileModule.data, execute: profileModule.execute } as unknown as Command,
  { data: verificarModule.data, execute: verificarModule.execute } as unknown as Command,
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
  lockupCommand as unknown as Command,
  warnCommand as unknown as Command,
  sancionCommand as unknown as Command,
  ckCommand as unknown as Command,
];
for (const cmd of commands) {
  const name = (cmd.data as { name: string }).name;
  client.commands.set(name, cmd);
  console.log(`[COMMANDS] Cargado: /${name}`);
}

// ─── REGISTRAR EVENTOS ────────────────────────────────────────────────────────
client.once("clientReady", () => {
  readyEvent.execute(client);
  startFineService(client);
  startOAuthServer(client);
});

client.on(interactionEvent.name, async (...args) => {
  await interactionEvent.execute(args[0] as any, client);
});

client.on(messageCreateEvent.name, async (...args) => {
  await messageCreateEvent.execute(args[0] as any);
});

client.on(guildMemberAddEvent.name, async (...args) => {
  await guildMemberAddEvent.execute(args[0] as any);
});

client.on(guildMemberUpdateEvent.name, async (...args) => {
  await guildMemberUpdateEvent.execute(args[0] as any, args[1] as any);
});

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
client.on("error", err => console.error("[CLIENT] Error:", err));
client.on("warn", msg => console.warn("[CLIENT] Warn:", msg));
client.on("shardDisconnect", (event, id) => console.warn(`[CLIENT] Shard ${id} desconectado, codigo: ${event.code}`));
client.on("shardReconnecting", id => console.log(`[CLIENT] Shard ${id} reconectando...`));
client.on("shardResume", (id, replayed) => console.log(`[CLIENT] Shard ${id} reconectado. Eventos: ${replayed}`));
process.on("unhandledRejection", err => console.error("[PROCESS] Unhandled rejection:", err));
process.on("uncaughtException", err => {
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

// Registrar listener RAW para capturar resolved.attachments de modals V2
registerRawListener(client);

setInterval(() => {
  if (!client.isReady()) {
    console.warn("[KEEPALIVE] Cliente no listo, intentando reconectar...");
  }
}, 60_000);

process.on("SIGINT", () => console.log("[PROCESS] Recibida senal SIGINT (detencion solicitada por el servidor/panel)"));
process.on("SIGTERM", () => console.log("[PROCESS] Recibida senal SIGTERM (detencion solicitada por el servidor/panel)"));
process.on("beforeExit", (code) => console.warn(`[PROCESS] El event loop se vacio. Codigo de salida: ${code}`));
process.on("exit", (code) => console.log(`[PROCESS] Proceso finalizado con codigo: ${code}`));
