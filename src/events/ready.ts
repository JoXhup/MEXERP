import type { Client, TextChannel } from "discord.js";
import { ActivityType, MessageFlags } from "discord.js";
import { cleanExpiredCooldowns } from "../utils/cooldown.js";
import { buildJornadasPanelContainer, buildAperturasPanelContainer } from "../utils/components.js";
import { restoreActiveArrests } from "../handlers/arrestHandler.js";

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

  // 3. Restaurar arrestos activos
  await restoreActiveArrests(client);

  console.log(`[READY] Sonora RP System listo. ${new Date().toLocaleString("es-ES")}`);
}
