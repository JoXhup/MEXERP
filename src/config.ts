import "dotenv/config";

// ─── VALIDACION DE VARIABLES DE ENTORNO ────────────────────────────────────────
const required = ["TOKEN", "CLIENT_ID", "GUILD_ID", "MONGO_URI"] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[CONFIG] Falta la variable de entorno: ${key}`);
    process.exit(1);
  }
}

export const config = {
  token: process.env.TOKEN!,
  clientId: process.env.CLIENT_ID!,
  guildId: process.env.GUILD_ID!,
  mongoUri: process.env.MONGO_URI!,

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
  // Roles que se asignan al verificarse
  verifiedRoleIds: [
    "1529584400126181516",
    "1528974991813771304",
    "1531425281502613675",
  ],
  // Rol que se retira al verificarse
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

  // ─── GROQ AI ──────────────────────────────────────────────────────────────────────────
  groqApiKey: process.env.GROQ_API_KEY ?? "",
} as const;
