// Cache compartido en memoria: guildId → documento cargado via /tryout ia
export const documentCache = new Map<string, { text: string; filename: string }>();
