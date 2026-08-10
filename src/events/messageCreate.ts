import { type Message, Events } from "discord.js";
import { sendErlcApiErrorContainer } from "../handlers/erlcHandler.js";

const erlcCmdNames = new Set([
  "h", "m", "pm", "kill", "down", "refresh", "respawn", "load", "heal",
  "kick", "ban", "unban", "jail", "unjail", "free", "wanted", "unwanted",
  "bring", "to", "tp", "tocar", "toatv", "view", "time", "weather",
  "startfire", "startnearfire", "stopfire", "stopdumpsterfire", "bans",
  "admins", "mods", "helpers", "cmds", "commands", "logs", "mod", "unmod",
  "helper", "unhelper", "admin", "unadmin",
]);

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot || !message.content) return;

  const content = message.content.trim();
  if (!content.startsWith(":")) return;

  const firstWord = content.slice(1).split(/\s+/)[0].toLowerCase();

  if (erlcCmdNames.has(firstWord)) {
    await sendErlcApiErrorContainer(message, firstWord);
  }
}
