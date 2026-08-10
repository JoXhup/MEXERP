import {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { Command } from "../types/index.js";
import { processWelcomeFlow } from "../utils/welcomeService.js";
import { ECO_ADMIN_ROLE_ID } from "../handlers/economyHandler.js";

const data = new SlashCommandBuilder()
  .setName("bienvenida")
  .setDescription("Comandos de administración para el sistema de bienvenidas de Sonora RP.")
  .addSubcommand((sub) =>
    sub
      .setName("test")
      .setDescription("Prueba el flujo de bienvenida completo (Envía mensaje al canal y DM).")
      .addUserOption((opt) =>
        opt
          .setName("usuario")
          .setDescription("Usuario a simular (Opcional, por defecto tú).")
          .setRequired(false)
      )
  );

const command: Command = {
  data,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // 1. Verificar Permisos de Administrador
    const member = interaction.member as GuildMember;
    const isAdmin =
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.roles.cache.has(ECO_ADMIN_ROLE_ID);

    if (!isAdmin) {
      await interaction.reply({
        content: "❌ **Permisos Insuficientes:** Solo los administradores pueden probar el sistema de bienvenida.",
        flags: MessageFlags.Ephemeral, // flags: 64
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // flags: 64

    const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
    const targetMember = interaction.guild?.members.cache.get(targetUser.id)
      ?? (await interaction.guild?.members.fetch(targetUser.id).catch(() => null));

    if (!targetMember) {
      await interaction.editReply({
        content: "❌ **Error:** No se pudo encontrar a ese miembro en el servidor.",
      });
      return;
    }

    // Ejecutar flujo completo simulando su entrada
    const { welcomeSent, dmSent } = await processWelcomeFlow(targetMember);

    let statusText = `✅ **Prueba de Bienvenida Ejecutada Correctamente** (\`flags: 64\` / Ephemeral)\n`;
    statusText += `› 👤 **Usuario Simulado:** <@${targetMember.id}>\n`;
    statusText += `› 📢 **Canal de Bienvenidas (<#1528571135678087340>):** ${welcomeSent ? "✅ Enviado" : "❌ Error al enviar"}\n`;
    statusText += `› 📩 **DM de Verificación:** ${dmSent ? "✅ Enviado" : "⚠️ DMs cerrados por el usuario"}`;

    await interaction.editReply({
      content: statusText,
    });
  },
};

export default command;
