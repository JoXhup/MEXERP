import "dotenv/config";

// ─── RESOLUCION FLEXIBLE DE VARIABLES DE ENTORNO ─────────────────────────────
const token     = process.env.TOKEN      ?? process.env.DISCORD_TOKEN ?? process.env.BOT_TOKEN     ?? "";
const clientId  = process.env.CLIENT_ID  ?? process.env.APPLICATION_ID?? process.env.BOT_ID        ?? "";
const guildId   = process.env.GUILD_ID   ?? process.env.SERVER_ID     ?? "";
const mongoUri  = process.env.MONGO_URI  ?? process.env.MONGODB_URI   ?? process.env.MONGO_URL     ?? "";

const faltantes: string[] = [];
if (!token)    faltantes.push("TOKEN (o DISCORD_TOKEN)");
if (!clientId) faltantes.push("CLIENT_ID (o APPLICATION_ID)");
if (!guildId)  faltantes.push("GUILD_ID (o SERVER_ID)");
if (!mongoUri) faltantes.push("MONGO_URI (o MONGODB_URI)");

if (faltantes.length > 0) {
  console.error("════════════════════════════════════════════════════════════════");
  console.error("❌ ERROR CRITICO DE CONFIGURACION DE ENTORNO (.env)");
  console.error("Faltan las siguientes variables de entorno requeridas:");
  for (const f of faltantes) {
    console.error(`  • ${f}`);
  }
  console.error("");
  console.error("Por favor agrega estas variables en tu archivo .env o en el panel Pterodactyl.");
  console.error("════════════════════════════════════════════════════════════════");

  // Esperar 15 segundos antes de salir para que el usuario pueda ver el log en Pterodactyl
  await new Promise((resolve) => setTimeout(resolve, 15_000));
  process.exit(1);
}

export const config = {
  token,
  clientId,
  guildId,
  mongoUri,

  // ─── IDS DEL SERVIDOR ──────────────────────────────────────────────────────
  categoryId:            process.env.CATEGORY_ID             ?? "1528927098641715331",
  adminRoleId:           process.env.ADMIN_ROLE_ID            ?? "1529325329230073986",
  staffRoleId:           "1530650993472180425",
  adminRoleIds:          [
    process.env.ADMIN_ROLE_ID ?? "1529325329230073986",
    "1474200423681228934",        // Rol secundario admin
    "1528876703450136737",        // Rol adicional admin
    "1530650993472180425",        // Rol Staff de tickets
  ],
  panelChannelId:        process.env.PANEL_CHANNEL_ID         ?? "1528868846906114321",
  logChannelId:          process.env.LOG_CHANNEL_ID           ?? null,
  transcriptChannelId:   process.env.TRANSCRIPT_CHANNEL_ID   ?? null,

  // ─── SISTEMA DE VERIFICACION ───────────────────────────────────────────────
  verificationChannelId: process.env.VERIFICATION_CHANNEL_ID ?? "1528973867362812024",
  verifiedRoleIds: [
    "1529584400126181516",
    "1528974991813771304",
    "1531425281502613675",
  ],
  unverifiedRoleId: "1528974924805312562",

  // ─── SISTEMA DE TICKETS ────────────────────────────────────────────────────
  cooldownMs: 30_000,          // 30 segundos entre tickets
  maxOpenTickets: 3,           // Tickets abiertos por usuario
  transcriptDir: "./transcripts/generated",

  // ─── DISEÑO ────────────────────────────────────────────────────────────────
  colors: {
    primary: 0x7c3aed,         // Morado
    success: 0x10b981,         // Verde
    danger: 0xef4444,          // Rojo
    warning: 0xf59e0b,         // Amarillo
    info: 0x6366f1,            // Indigo
    dark: 0x0f0f1a,            // Negro
  },

  // ─── GROQ AI ───────────────────────────────────────────────────────────────
  groqApiKey: process.env.GROQ_API_KEY ?? "",
} as const;
