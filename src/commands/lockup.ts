import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import {
  buildLockupModal,
  handleLockupAgregarCommand,
  handleLockupAcortarCommand,
  handleLockupRetirarCommand,
  handleLockupHistorialCommand,
  checkLockupPermission,
  buildNoPermissionContainer,
} from "../handlers/lockupHandler.js";
import { MessageFlags } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("lockup")
  .setDescription("Sistema de gestión de sanciones de Lockup — Sonora RP")

  // Subcomando 1: enviar (Abre Modal V2)
  .addSubcommand((sub) =>
    sub
      .setName("enviar")
      .setDescription("Sanciona a un usuario enviándolo a Lockup (Abre modal V2)")
  )

  // Subcomando 2: agregar (Extiende tiempo)
  .addSubcommand((sub) =>
    sub
      .setName("agregar")
      .setDescription("Agrega más tiempo a un Lockup activo")
      .addUserOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("El usuario sancionado")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("tiempo")
          .setDescription("Tiempo a agregar (Ej: 30m, 2h, 1d, 2meses)")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("motivo")
          .setDescription("Motivo de la extensión")
          .setRequired(true)
      )
  )

  // Subcomando 3: acortar (Reduce tiempo)
  .addSubcommand((sub) =>
    sub
      .setName("acortar")
      .setDescription("Reduce el tiempo de un Lockup activo")
      .addUserOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("El usuario sancionado")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("tiempo")
          .setDescription("Tiempo a acortar (Ej: 15m, 1h)")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("motivo")
          .setDescription("Motivo de la reducción")
          .setRequired(true)
      )
  )

  // Subcomando 4: retirar (Quita el Lockup con confirmación)
  .addSubcommand((sub) =>
    sub
      .setName("retirar")
      .setDescription("Retira la sanción de Lockup a un usuario")
      .addUserOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("El usuario a quien se le retirará el Lockup")
          .setRequired(true)
      )
  )

  // Subcomando 5: historial (Cualquiera puede ejecutarlo)
  .addSubcommand((sub) =>
    sub
      .setName("historial")
      .setDescription("Muestra el historial de sanciones de Lockup de un usuario")
      .addUserOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("El usuario a consultar (Opcional, por defecto tú)")
          .setRequired(false)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "enviar") {
    if (!checkLockupPermission(interaction)) {
      await interaction.reply({
        components: [buildNoPermissionContainer()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      return;
    }
    await interaction.showModal(buildLockupModal());
    return;
  }

  if (subcommand === "agregar") {
    await handleLockupAgregarCommand(interaction);
    return;
  }

  if (subcommand === "acortar") {
    await handleLockupAcortarCommand(interaction);
    return;
  }

  if (subcommand === "retirar") {
    await handleLockupRetirarCommand(interaction);
    return;
  }

  if (subcommand === "historial") {
    await handleLockupHistorialCommand(interaction);
    return;
  }
}

export default { data, execute };
