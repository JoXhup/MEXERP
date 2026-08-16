import type { Client, TextChannel } from "discord.js";
import { ActivityType, MessageFlags, AttachmentBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { cleanExpiredCooldowns } from "../utils/cooldown.js";
import { buildPanelContainer, buildJornadasPanelContainer, buildAperturasPanelContainer } from "../utils/components.js";
import { config } from "../config.js";
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

  // 0. Inicializar Panel Principal de Tickets en el canal 1528868846906114321
  try {
    const PANEL_CHANNEL_ID = config.panelChannelId || "1528868846906114321";
    const panelChan = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);

    if (panelChan && panelChan.isTextBased()) {
      const textChan = panelChan as TextChannel;
      const messages = await textChan.messages.fetch({ limit: 20 }).catch(() => null);
      const existingPanel = messages?.find(m => m.author.id === client.user?.id && m.components.length > 0);
      if (existingPanel) {
        await existingPanel.delete().catch(() => null);
        console.log("[READY] Panel antiguo de Tickets eliminado.");
      }

      const guildIconUrl = textChan.guild?.iconURL({ size: 256 }) ?? undefined;

      // Buscar si existe imagen banner en src/utils/Assets/ticketsupport.png o assets/ticketsupport.png
      let bannerUrl: string | undefined = undefined;
      const attachments: AttachmentBuilder[] = [];

      const candidatePaths = [
        path.join(process.cwd(), "src", "utils", "Assets", "ticketsupport.png"),
        path.join(process.cwd(), "assets", "ticketsupport.png"),
        path.join(process.cwd(), "src", "utils", "Assets", "BienvenidasSonoraRP.png"),
        path.join(process.cwd(), "assets", "BienvenidasSonoraRP.png"),
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          attachments.push(new AttachmentBuilder(p, { name: "ticketsupport.png" }));
          bannerUrl = "attachment://ticketsupport.png";
          console.log(`[READY] Banner de tickets encontrado en: ${p}`);
          break;
        }
      }

      await textChan.send({
        components: [buildPanelContainer(client, guildIconUrl, bannerUrl)],
        files: attachments,
        // @ts-ignore — Components V2 flag required
        flags: MessageFlags.IsComponentsV2,
      });
      console.log("[READY] Panel de Tickets Soporte publicado automáticamente en el canal.");
    }
  } catch (panelErr) {
    console.error("[READY] Error enviando panel de Tickets Soporte:", panelErr);
  }

  // 1. Inicializar Panel de Jornadas Staff en el canal 1528869236687110215
  try {
    const JORNADAS_CHANNEL_ID = "1528869236687110215";
    const jornadasChan = await client.channels.fetch(JORNADAS_CHANNEL_ID).catch(() => null);

    if (jornadasChan && jornadasChan.isTextBased()) {
      const textChan = jornadasChan as TextChannel;
      const messages = await textChan.messages.fetch({ limit: 20 }).catch(() => null);
      const existingPanel = messages?.find(m => m.author.id === client.user?.id && m.components.length > 0);
      if (existingPanel) {
        await existingPanel.delete().catch(() => null);
        console.log("[READY] Panel antiguo de Jornadas eliminado.");
      }

      const guildIconUrl = textChan.guild?.iconURL({ size: 256 }) ?? undefined;
      await textChan.send({
        components: [buildJornadasPanelContainer(client, guildIconUrl)],
        // @ts-ignore — Components V2 flag required
        flags: MessageFlags.IsComponentsV2,
      });
      console.log("[READY] Panel de Jornadas Staff publicado en el canal.");
    }
  } catch (jornadasErr) {
    console.error("[READY] Error enviando panel de Jornadas Staff:", jornadasErr);
  }

  // 2. Inicializar Panel de Gestión de Aperturas en el canal 1532163697559208027
  try {
    const APERTURAS_CHANNEL_ID = "1532163697559208027";
    const aperturasChan = await client.channels.fetch(APERTURAS_CHANNEL_ID).catch(() => null);

    if (aperturasChan && aperturasChan.isTextBased()) {
      const textChan = aperturasChan as TextChannel;
      const messages = await textChan.messages.fetch({ limit: 20 }).catch(() => null);
      const existingPanel = messages?.find(m => m.author.id === client.user?.id && m.components.length > 0);
      if (existingPanel) {
        await existingPanel.delete().catch(() => null);
        console.log("[READY] Panel antiguo de Aperturas eliminado.");
      }

      const guildIconUrl = textChan.guild?.iconURL({ size: 256 }) ?? undefined;
      await textChan.send({
        components: [buildAperturasPanelContainer(client, guildIconUrl)],
        // @ts-ignore — Components V2 flag required
        flags: MessageFlags.IsComponentsV2,
      });
      console.log("[READY] Panel de Gestión de Aperturas publicado en el canal.");
    }
  } catch (aperturasErr) {
    console.error("[READY] Error enviando panel de Gestión de Aperturas:", aperturasErr);
  }

  // 3. Restaurar arrestos activos, inicializar expirador de lockups y base de datos de conocimiento
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

    const commandsPayload = [
      panelCommand, statsCommand, contratarCommand, despedirCommand, ineCommand,
      arrestarCommand, estadoCommand, depositarCommand, retirarCommand, transferirCommand,
      transferenciasCommand, cobrarCommand, lavarCommand, historialCommand, economiaCommand,
      multarCommand, multasCommand, cmdCommand, bienvenidaCommand, pingCommand,
      tryoutCommand, narcopostCommand, subirCommand, lockupCommand,
      warnCommand, sancionCommand, ckCommand
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
