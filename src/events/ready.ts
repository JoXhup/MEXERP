import type { Client } from "discord.js";
import { ActivityType } from "discord.js";
import { cleanExpiredCooldowns } from "../utils/cooldown.js";
import { restoreActiveArrests } from "../handlers/arrestHandler.js";
import { initLockupExpirationChecker } from "../handlers/lockupHandler.js";
import { documentCache } from "../utils/documentCache.js";

export const name = "clientReady";
export const once = true;

export async function execute(client: Client): Promise<void> {
  console.log(`[READY] Conectado como ${client.user?.tag}`);

  // Presencia del bot — rotacion entre actividades
  const activities = [
    { name: "SORP", type: ActivityType.Playing },
    { name: "Code: SORPA", type: ActivityType.Watching },
  ];

  let activityIndex = 0;
  const updatePresence = () => {
    const act = activities[activityIndex];
    if (act) {
      client.user?.setPresence({
        activities: [{ name: act.name, type: act.type }],
        status: "dnd",
      });
    }
    activityIndex = (activityIndex + 1) % activities.length;
  };

  updatePresence();
  setInterval(updatePresence, 30_000);

  // Limpiar cooldowns expirados cada 5 minutos
  setInterval(cleanExpiredCooldowns, 5 * 60 * 1000);

  // 1. Restaurar arrestos activos, inicializar expirador de lockups y base de datos de conocimiento
  await restoreActiveArrests(client);
  initLockupExpirationChecker(client);
  await documentCache.loadAllFromDb();

  // 4. Auto-registrar comandos slash en la API de Discord
  try {
    const { REST, Routes } = await import("discord.js");
    const { config } = await import("../config.js");
    const { default: panelCommand } = await import("../commands/panel.js");
    const { default: statsCommand } = await import("../commands/stats.js");
    const { default: contratarCommand } = await import("../commands/contratar.js");
    const { default: despedirCommand } = await import("../commands/despedir.js");
    const { data: jornadaData } = await import("../commands/jornada.js");
    const { data: profileData } = await import("../commands/profile.js");
    const { data: verificarData } = await import("../commands/verificar.js");
    const { default: ineCommand } = await import("../commands/ine.js");
    const { default: arrestarCommand } = await import("../commands/arrestar.js");
    const { default: estadoCommand } = await import("../commands/estado.js");
    const { default: depositarCommand } = await import("../commands/depositar.js");
    const { default: retirarCommand } = await import("../commands/retirar.js");
    const { default: transferirCommand } = await import("../commands/transferir.js");
    const { default: transferenciasCommand } = await import("../commands/transferencias.js");
    const { default: cobrarCommand } = await import("../commands/cobrar.js");
    const { default: lavarCommand } = await import("../commands/lavar.js");
    const { default: historialCommand } = await import("../commands/historial.js");
    const { default: economiaCommand } = await import("../commands/economia.js");
    const { default: multarCommand } = await import("../commands/multar.js");
    const { default: multasCommand } = await import("../commands/multas.js");
    const { default: cmdCommand } = await import("../commands/cmd.js");
    const { default: bienvenidaCommand } = await import("../commands/bienvenida.js");
    const { default: pingCommand } = await import("../commands/ping.js");
    const { default: tryoutCommand } = await import("../commands/tryout.js");
    const { default: narcopostCommand } = await import("../commands/narcopost.js");
    const { default: subirCommand } = await import("../commands/subir.js");
    const { default: lockupCommand } = await import("../commands/lockup.js");
    const { default: warnCommand } = await import("../commands/warn.js");
    const { default: sancionCommand } = await import("../commands/sancion.js");
    const { default: ckCommand } = await import("../commands/ck.js");
    const { default: narcoCommand } = await import("../commands/narco.js");
    const { default: periodicoCommand } = await import("../commands/periodico.js");
    const { default: asignarCommand } = await import("../commands/asignar.js");

    const commandsPayload = [
      panelCommand, statsCommand, contratarCommand, despedirCommand, ineCommand,
      arrestarCommand, estadoCommand, depositarCommand, retirarCommand, transferirCommand,
      transferenciasCommand, cobrarCommand, lavarCommand, historialCommand, economiaCommand,
      multarCommand, multasCommand, cmdCommand, bienvenidaCommand, pingCommand,
      tryoutCommand, narcopostCommand, subirCommand, lockupCommand,
      warnCommand, sancionCommand, ckCommand, narcoCommand, periodicoCommand,
      asignarCommand
    ].map(c => c.data);
    commandsPayload.push(jornadaData.toJSON() as any);
    commandsPayload.push(profileData.toJSON() as any);
    commandsPayload.push(verificarData.toJSON() as any);

    const rest = new REST({ version: "10" }).setToken(config.token);
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commandsPayload }
    );
    console.log(`[READY] ✅ Slash commands registrados automáticamente (${commandsPayload.length} comandos).`);
  } catch (deployErr) {
    console.error("[READY] Error registrando slash commands automáticamente:", deployErr);
  }

  console.log(`[READY] Sonora RP System listo. ${new Date().toLocaleString("es-ES")}`);
}
