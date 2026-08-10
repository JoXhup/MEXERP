import { SlashCommandBuilder, } from "discord.js";
import { sendErlcApiErrorContainer } from "../handlers/erlcHandler.js";
const erlcSpecs = [
    { name: "h", desc: "Comando externo ERLC :h [mensaje]", options: [{ name: "mensaje", desc: "Mensaje a enviar al servidor ERLC", required: true }] },
    { name: "m", desc: "Comando externo ERLC :m [mensaje]", options: [{ name: "mensaje", desc: "Mensaje de moderador a mostrar en pantalla", required: true }] },
    { name: "pm", desc: "Comando externo ERLC :pm [jugador] [mensaje]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }, { name: "mensaje", desc: "Mensaje privado", required: true }] },
    { name: "kill", desc: "Comando externo ERLC :kill [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "down", desc: "Comando externo ERLC :down [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "refresh", desc: "Comando externo ERLC :refresh [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "respawn", desc: "Comando externo ERLC :respawn [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "load", desc: "Comando externo ERLC :load [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "heal", desc: "Comando externo ERLC :heal [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "kick", desc: "Comando externo ERLC :kick [jugador] [razón]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }, { name: "razon", desc: "Motivo de la expulsión", required: true }] },
    { name: "ban", desc: "Comando externo ERLC :ban [jugador/ID]", options: [{ name: "target", desc: "Nombre de usuario o ID de Roblox", required: true }] },
    { name: "unban", desc: "Comando externo ERLC :unban [jugador/ID]", options: [{ name: "target", desc: "Nombre de usuario o ID de Roblox", required: true }] },
    { name: "jail", desc: "Comando externo ERLC :jail [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "unjail", desc: "Comando externo ERLC :unjail [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "free", desc: "Comando externo ERLC :free [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "wanted", desc: "Comando externo ERLC :wanted [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "unwanted", desc: "Comando externo ERLC :unwanted [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "bring", desc: "Comando externo ERLC :bring [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "to", desc: "Comando externo ERLC :to [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "tp", desc: "Comando externo ERLC :tp [jugador1] [jugador2]", options: [{ name: "jugador1", desc: "Jugador a teletransportar", required: true }, { name: "jugador2", desc: "Jugador destino", required: true }] },
    { name: "tocar", desc: "Comando externo ERLC :tocar" },
    { name: "toatv", desc: "Comando externo ERLC :toatv" },
    { name: "view", desc: "Comando externo ERLC :view [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "time", desc: "Comando externo ERLC :time [hora]", options: [{ name: "hora", desc: "Hora a establecer en el servidor", required: true }] },
    { name: "weather", desc: "Comando externo ERLC :weather [tipo]", options: [{ name: "tipo", desc: "Tipo de clima", required: true }] },
    { name: "startfire", desc: "Comando externo ERLC :startfire [tipo]", options: [{ name: "tipo", desc: "Tipo de incendio", required: true }] },
    { name: "startnearfire", desc: "Comando externo ERLC :startnearfire [tipo]", options: [{ name: "tipo", desc: "Tipo de incendio cercano", required: true }] },
    { name: "stopfire", desc: "Comando externo ERLC :stopfire" },
    { name: "stopdumpsterfire", desc: "Comando externo ERLC :stopdumpsterfire" },
    { name: "bans", desc: "Comando externo ERLC :bans — Lista de baneos activos" },
    { name: "admins", desc: "Comando externo ERLC :admins — Lista de administradores" },
    { name: "mods", desc: "Comando externo ERLC :mods — Lista de moderadores" },
    { name: "helpers", desc: "Comando externo ERLC :helpers — Lista de helpers" },
    { name: "cmds", desc: "Comando externo ERLC :cmds — Lista de comandos disponibles" },
    { name: "commands", desc: "Comando externo ERLC :commands — Lista de comandos disponibles" },
    { name: "logs", desc: "Comando externo ERLC :logs — Registros del servidor ERLC" },
    { name: "mod", desc: "Comando externo ERLC :mod [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "unmod", desc: "Comando externo ERLC :unmod [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "helper", desc: "Comando externo ERLC :helper [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "unhelper", desc: "Comando externo ERLC :unhelper [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "admin", desc: "Comando externo ERLC :admin [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
    { name: "unadmin", desc: "Comando externo ERLC :unadmin [jugador]", options: [{ name: "jugador", desc: "Nombre de usuario Roblox / In-game", required: true }] },
];
export const erlcCommands = erlcSpecs.map((spec) => {
    const builder = new SlashCommandBuilder()
        .setName(spec.name)
        .setDescription(spec.desc);
    if (spec.options) {
        for (const opt of spec.options) {
            builder.addStringOption((o) => o.setName(opt.name).setDescription(opt.desc).setRequired(opt.required ?? false));
        }
    }
    return {
        data: builder,
        async execute(interaction) {
            await sendErlcApiErrorContainer(interaction, spec.name);
        },
    };
});
