import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import type { Command } from "../types/index.js";
import { sendErlcApiErrorContainer } from "../handlers/erlcHandler.js";

const data = new SlashCommandBuilder()
  .setName("cmd")
  .setDescription("Comandos externos de administración e integración para servidor ERLC.")

  // ─── GRUPO 1: /cmd ext (25 subcomandos principales de moderación y jugadores) ────
  .addSubcommandGroup((group) =>
    group
      .setName("ext")
      .setDescription("Comandos de administración, moderación y control de jugadores ERLC.")
      .addSubcommand((sub) =>
        sub
          .setName("unmod")
          .setDescription("Comando externo ERLC :unmod [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("mod")
          .setDescription("Comando externo ERLC :mod [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("admin")
          .setDescription("Comando externo ERLC :admin [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("unadmin")
          .setDescription("Comando externo ERLC :unadmin [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("helper")
          .setDescription("Comando externo ERLC :helper [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("unhelper")
          .setDescription("Comando externo ERLC :unhelper [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("kill")
          .setDescription("Comando externo ERLC :kill [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("heal")
          .setDescription("Comando externo ERLC :heal [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("kick")
          .setDescription("Comando externo ERLC :kick [jugador] [razón]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
          .addStringOption((o) => o.setName("razon").setDescription("Motivo de expulsión").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("ban")
          .setDescription("Comando externo ERLC :ban [jugador/ID]")
          .addStringOption((o) => o.setName("target").setDescription("Jugador o ID de Roblox").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("unban")
          .setDescription("Comando externo ERLC :unban [jugador/ID]")
          .addStringOption((o) => o.setName("target").setDescription("Jugador o ID de Roblox").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("jail")
          .setDescription("Comando externo ERLC :jail [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("unjail")
          .setDescription("Comando externo ERLC :unjail [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("free")
          .setDescription("Comando externo ERLC :free [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("bring")
          .setDescription("Comando externo ERLC :bring [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("to")
          .setDescription("Comando externo ERLC :to [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("tp")
          .setDescription("Comando externo ERLC :tp [jugador1] [jugador2]")
          .addStringOption((o) => o.setName("jugador1").setDescription("Jugador origen").setRequired(true))
          .addStringOption((o) => o.setName("jugador2").setDescription("Jugador destino").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("pm")
          .setDescription("Comando externo ERLC :pm [jugador] [mensaje]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
          .addStringOption((o) => o.setName("mensaje").setDescription("Mensaje privado").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("h")
          .setDescription("Comando externo ERLC :h [mensaje]")
          .addStringOption((o) => o.setName("mensaje").setDescription("Mensaje global").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("m")
          .setDescription("Comando externo ERLC :m [mensaje]")
          .addStringOption((o) => o.setName("mensaje").setDescription("Mensaje de moderador").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("wanted")
          .setDescription("Comando externo ERLC :wanted [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("unwanted")
          .setDescription("Comando externo ERLC :unwanted [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("Comando externo ERLC :view [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("refresh")
          .setDescription("Comando externo ERLC :refresh [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("respawn")
          .setDescription("Comando externo ERLC :respawn [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
  )

  // ─── GRUPO 2: /cmd server (Comandos de servidor, entorno y utilidades) ───────────
  .addSubcommandGroup((group) =>
    group
      .setName("server")
      .setDescription("Comandos de control del servidor ERLC, clima, fuegos y consultas.")
      .addSubcommand((sub) =>
        sub
          .setName("down")
          .setDescription("Comando externo ERLC :down [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("load")
          .setDescription("Comando externo ERLC :load [jugador]")
          .addStringOption((o) => o.setName("jugador").setDescription("Nombre de usuario Roblox / In-game").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("tocar")
          .setDescription("Comando externo ERLC :tocar")
      )
      .addSubcommand((sub) =>
        sub
          .setName("toatv")
          .setDescription("Comando externo ERLC :toatv")
      )
      .addSubcommand((sub) =>
        sub
          .setName("time")
          .setDescription("Comando externo ERLC :time [hora]")
          .addStringOption((o) => o.setName("hora").setDescription("Hora del servidor ERLC").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("weather")
          .setDescription("Comando externo ERLC :weather [tipo]")
          .addStringOption((o) => o.setName("tipo").setDescription("Tipo de clima").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("startfire")
          .setDescription("Comando externo ERLC :startfire [tipo]")
          .addStringOption((o) => o.setName("tipo").setDescription("Tipo de incendio").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("startnearfire")
          .setDescription("Comando externo ERLC :startnearfire [tipo]")
          .addStringOption((o) => o.setName("tipo").setDescription("Tipo de incendio cercano").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("stopfire")
          .setDescription("Comando externo ERLC :stopfire")
      )
      .addSubcommand((sub) =>
        sub
          .setName("stopdumpsterfire")
          .setDescription("Comando externo ERLC :stopdumpsterfire")
      )
      .addSubcommand((sub) =>
        sub
          .setName("bans")
          .setDescription("Comando externo ERLC :bans — Consulta de baneos activos")
      )
      .addSubcommand((sub) =>
        sub
          .setName("admins")
          .setDescription("Comando externo ERLC :admins — Consulta de administradores")
      )
      .addSubcommand((sub) =>
        sub
          .setName("mods")
          .setDescription("Comando externo ERLC :mods — Consulta de moderadores")
      )
      .addSubcommand((sub) =>
        sub
          .setName("helpers")
          .setDescription("Comando externo ERLC :helpers — Consulta de helpers")
      )
      .addSubcommand((sub) =>
        sub
          .setName("cmds")
          .setDescription("Comando externo ERLC :cmds — Lista de comandos")
      )
      .addSubcommand((sub) =>
        sub
          .setName("commands")
          .setDescription("Comando externo ERLC :commands — Lista de comandos")
      )
      .addSubcommand((sub) =>
        sub
          .setName("logs")
          .setDescription("Comando externo ERLC :logs — Registros del servidor")
      )
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subCmd = interaction.options.getSubcommand();
    await sendErlcApiErrorContainer(interaction, subCmd);
  },
};

export default command;
