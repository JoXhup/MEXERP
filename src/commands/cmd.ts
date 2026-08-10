import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type Client,
} from "discord.js";
import type { Command } from "../types/index.js";
import { sendErlcApiErrorContainer } from "../handlers/erlcHandler.js";

// Lista completa de los 42 comandos externos ERLC con sus descripciones y parámetros
export const ERLC_COMMAND_LIST = [
  { name: "h", desc: ":h [mensaje] — Enviar mensaje global", params: "[mensaje]" },
  { name: "m", desc: ":m [mensaje] — Mensaje de moderador en pantalla", params: "[mensaje]" },
  { name: "pm", desc: ":pm [jugador] [mensaje] — Mensaje privado", params: "[jugador] [mensaje]" },
  { name: "kill", desc: ":kill [jugador] — Eliminar personaje", params: "[jugador]" },
  { name: "down", desc: ":down [jugador] — Derribar personaje", params: "[jugador]" },
  { name: "refresh", desc: ":refresh [jugador] — Refrescar personaje", params: "[jugador]" },
  { name: "respawn", desc: ":respawn [jugador] — Reaparecer personaje", params: "[jugador]" },
  { name: "load", desc: ":load [jugador] — Cargar datos de personaje", params: "[jugador]" },
  { name: "heal", desc: ":heal [jugador] — Curar salud de personaje", params: "[jugador]" },
  { name: "kick", desc: ":kick [jugador] [razón] — Expulsar del servidor", params: "[jugador] [razón]" },
  { name: "ban", desc: ":ban [jugador/ID] — Banear del servidor", params: "[jugador/ID]" },
  { name: "unban", desc: ":unban [jugador/ID] — Desbanear del servidor", params: "[jugador/ID]" },
  { name: "jail", desc: ":jail [jugador] — Encarcelar personaje", params: "[jugador]" },
  { name: "unjail", desc: ":unjail [jugador] — Liberar de cárcel", params: "[jugador]" },
  { name: "free", desc: ":free [jugador] — Liberar personaje", params: "[jugador]" },
  { name: "wanted", desc: ":wanted [jugador] — Poner en búsqueda policiaca", params: "[jugador]" },
  { name: "unwanted", desc: ":unwanted [jugador] — Quitar búsqueda policiaca", params: "[jugador]" },
  { name: "bring", desc: ":bring [jugador] — Traer personaje a tu posición", params: "[jugador]" },
  { name: "to", desc: ":to [jugador] — Ir a la posición del personaje", params: "[jugador]" },
  { name: "tp", desc: ":tp [jugador1] [jugador2] — Teletransportar entre personajes", params: "[jugador1] [jugador2]" },
  { name: "tocar", desc: ":tocar — Traer vehículo asignado", params: "" },
  { name: "toatv", desc: ":toatv — Traer ATV asignado", params: "" },
  { name: "view", desc: ":view [jugador] — Observar vista del personaje", params: "[jugador]" },
  { name: "time", desc: ":time [hora] — Cambiar hora del servidor", params: "[hora]" },
  { name: "weather", desc: ":weather [tipo] — Cambiar clima del servidor", params: "[tipo]" },
  { name: "startfire", desc: ":startfire [tipo] — Iniciar incendio", params: "[tipo]" },
  { name: "startnearfire", desc: ":startnearfire [tipo] — Iniciar incendio cercano", params: "[tipo]" },
  { name: "stopfire", desc: ":stopfire — Apagar todos los incendios", params: "" },
  { name: "stopdumpsterfire", desc: ":stopdumpsterfire — Apagar incendios en contenedores", params: "" },
  { name: "bans", desc: ":bans — Consultar lista de baneados", params: "" },
  { name: "admins", desc: ":admins — Consultar lista de administradores", params: "" },
  { name: "mods", desc: ":mods — Consultar lista de moderadores", params: "" },
  { name: "helpers", desc: ":helpers — Consultar lista de helpers", params: "" },
  { name: "cmds", desc: ":cmds — Consultar comandos disponibles", params: "" },
  { name: "commands", desc: ":commands — Consultar comandos disponibles", params: "" },
  { name: "logs", desc: ":logs — Consultar registros del servidor ERLC", params: "" },
  { name: "mod", desc: ":mod [jugador] — Asignar rango Moderador", params: "[jugador]" },
  { name: "unmod", desc: ":unmod [jugador] — Quitar rango Moderador", params: "[jugador]" },
  { name: "helper", desc: ":helper [jugador] — Asignar rango Helper", params: "[jugador]" },
  { name: "unhelper", desc: ":unhelper [jugador] — Quitar rango Helper", params: "[jugador]" },
  { name: "admin", desc: ":admin [jugador] — Asignar rango Administrador", params: "[jugador]" },
  { name: "unadmin", desc: ":unadmin [jugador] — Quitar rango Administrador", params: "[jugador]" },
];

const data = new SlashCommandBuilder()
  .setName("cmd")
  .setDescription("Comandos externos de integración ERLC (Emergency Response: Liberty County).")
  .addSubcommand((sub) =>
    sub
      .setName("ext")
      .setDescription("Ejecutar un comando externo en el servidor de ERLC.")
      .addStringOption((opt) =>
        opt
          .setName("comando")
          .setDescription("Nombre del comando ERLC a ejecutar (ej: unmod, kill, ban, h, m).")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("jugador")
          .setDescription("Nombre de usuario de Roblox / Jugador in-game (Opcional).")
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName("parametro")
          .setDescription("Mensaje, Razón, Hora, Clima o Segundo Jugador (Opcional).")
          .setRequired(false)
      )
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === "ext") {
      const rawCmd = interaction.options.getString("comando", true).trim().toLowerCase();
      const cleanCmd = rawCmd.startsWith(":") ? rawCmd.slice(1) : rawCmd;
      await sendErlcApiErrorContainer(interaction, cleanCmd);
    }
  },
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = ERLC_COMMAND_LIST.filter(
      (c) => c.name.toLowerCase().includes(focusedValue) || c.desc.toLowerCase().includes(focusedValue)
    ).slice(0, 25);

    await interaction.respond(
      filtered.map((c) => ({
        name: `${c.name} ${c.params}`.trim(),
        value: c.name,
      }))
    );
  },
};

export default command;
