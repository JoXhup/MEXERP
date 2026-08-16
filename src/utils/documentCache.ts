import { KnowledgeDocument, type IKnowledgeDocument } from "../models/KnowledgeDocument.js";

export interface KnowledgeItem {
  id: string;
  name: string;
  type: "PDF" | "Word" | "Excel" | "Imagen" | "Texto";
  text: string;
  addedAt: number;
}

export class GuildKnowledgeCache {
  private cache = new Map<string, KnowledgeItem[]>();
  private loadedGuilds = new Set<string>();

  /**
   * Carga desde MongoDB para un servidor si aún no se ha cargado en memoria
   */
  async ensureLoaded(guildId: string): Promise<KnowledgeItem[]> {
    if (this.loadedGuilds.has(guildId)) {
      return this.cache.get(guildId) ?? [];
    }

    try {
      const docs = await KnowledgeDocument.find({ guildId }).lean();
      const items: KnowledgeItem[] = docs.map((doc: any) => ({
        id: doc.docId,
        name: doc.name,
        type: doc.type as any,
        text: doc.text,
        addedAt: doc.addedAt ? new Date(doc.addedAt).getTime() : Date.now(),
      }));

      this.cache.set(guildId, items);
      this.loadedGuilds.add(guildId);
      return items;
    } catch (err) {
      console.error(`[DOCUMENT_CACHE] Error cargando desde DB para guild ${guildId}:`, err);
      return this.cache.get(guildId) ?? [];
    }
  }

  /**
   * Carga síncrona/in-memory para lectura rápida
   */
  getItems(guildId: string): KnowledgeItem[] {
    return this.cache.get(guildId) ?? [];
  }

  /**
   * Carga todo desde MongoDB en el evento ready
   */
  async loadAllFromDb(): Promise<void> {
    try {
      const docs = await KnowledgeDocument.find({}).lean();
      this.cache.clear();
      this.loadedGuilds.clear();

      for (const doc of docs as any[]) {
        const items = this.cache.get(doc.guildId) ?? [];
        items.push({
          id: doc.docId,
          name: doc.name,
          type: doc.type,
          text: doc.text,
          addedAt: doc.addedAt ? new Date(doc.addedAt).getTime() : Date.now(),
        });
        this.cache.set(doc.guildId, items);
        this.loadedGuilds.add(doc.guildId);
      }
      console.log(`[DOCUMENT_CACHE] Base de datos cargada: ${docs.length} documento(s) restaurados.`);
    } catch (err) {
      console.error("[DOCUMENT_CACHE] Error cargando todos los documentos desde DB:", err);
    }
  }

  /**
   * Guarda un nuevo documento en la DB y en la memoria
   */
  async addItem(
    guildId: string,
    item: Omit<KnowledgeItem, "id" | "addedAt">
  ): Promise<KnowledgeItem> {
    await this.ensureLoaded(guildId);

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const newItem: KnowledgeItem = {
      ...item,
      id: docId,
      addedAt: now,
    };

    // Actualizar cache local
    const items = this.getItems(guildId);
    items.push(newItem);
    this.cache.set(guildId, items);

    // Persistir en MongoDB
    try {
      await KnowledgeDocument.create({
        guildId,
        docId,
        name: item.name,
        type: item.type,
        text: item.text,
        addedAt: new Date(now),
      });
    } catch (err) {
      console.error("[DOCUMENT_CACHE] Error guardando documento en MongoDB:", err);
    }

    return newItem;
  }

  /**
   * Elimina varios documentos por ID de la DB y de la memoria
   */
  async deleteItems(guildId: string, ids: string[]): Promise<number> {
    await this.ensureLoaded(guildId);

    const items = this.getItems(guildId);
    const initialLen = items.length;
    const filtered = items.filter((it) => !ids.includes(it.id));
    this.cache.set(guildId, filtered);

    try {
      await KnowledgeDocument.deleteMany({ guildId, docId: { $in: ids } });
    } catch (err) {
      console.error("[DOCUMENT_CACHE] Error eliminando documentos de MongoDB:", err);
    }

    return initialLen - filtered.length;
  }

  /**
   * Borra todo el conocimiento de un servidor de la DB y de la memoria
   */
  async clear(guildId: string): Promise<boolean> {
    const items = this.getItems(guildId);
    const existed = items.length > 0;
    this.cache.delete(guildId);
    this.loadedGuilds.delete(guildId);

    try {
      await KnowledgeDocument.deleteMany({ guildId });
    } catch (err) {
      console.error("[DOCUMENT_CACHE] Error limpiando MongoDB para guild:", err);
    }

    return existed;
  }

  /**
   * Obtiene la combinación del conocimiento almacenado.
   * Si se provee una consulta de búsqueda, filtra y prioriza los párrafos y secciones más relevantes.
   * Límite predeterminado: 18,000 caracteres (~4,000 tokens) para garantizar compatibilidad con límites TPM de Groq.
   */
  getCombined(
    guildId: string,
    searchQuery?: string,
    maxLen = 7500
  ): { text: string; sources: string; count: number } {
    const items = this.getItems(guildId);
    if (items.length === 0) {
      return { text: "", sources: "", count: 0 };
    }

    const sources = items.map((it) => `${it.type}: ${it.name}`).join(", ");
    let combined = "";

    if (searchQuery && searchQuery.trim().length > 2) {
      // Extraer palabras clave de la pregunta del usuario
      const keywords = searchQuery
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const relevantSections: string[] = [];

      for (const item of items) {
        // Dividir el documento en secciones o párrafos
        const paragraphs = item.text.split(/(?=\n(?:\#{1,3}\s|TÍTULO|CAPÍTULO|ARTÍCULO|\d+\.))/i);

        const scored = paragraphs.map((p) => {
          const normP = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          let score = 0;
          for (const kw of keywords) {
            if (normP.includes(kw)) score += 2;
          }
          return { p, score };
        });

        // Ordenar párrafos por puntuación de relevancia
        scored.sort((a, b) => b.score - a.score);

        const topParagraphs = scored.filter((s) => s.score > 0).map((s) => s.p);

        if (topParagraphs.length > 0) {
          relevantSections.push(
            `--- FUENTE: ${item.name} (${item.type}) [Secciones Relevantes] ---\n${topParagraphs.join("\n\n")}`
          );
        } else {
          relevantSections.push(`--- FUENTE: ${item.name} (${item.type}) ---\n${item.text}`);
        }
      }

      combined = relevantSections.join("\n\n");
    } else {
      combined = items
        .map((it, idx) => `--- FUENTE #${idx + 1}: ${it.name} (${it.type}) ---\n${it.text}`)
        .join("\n\n");
    }

    if (combined.length > maxLen) {
      combined = combined.substring(0, maxLen) + "\n\n[... contexto priorizado por límite de tokens ...]";
    }

    return { text: combined, sources, count: items.length };
  }
}

export const documentCache = new GuildKnowledgeCache();

/**
 * Genera el System Prompt oficial para la IA con personalidad carismática, directa y conocimiento interno del servidor.
 */
export function buildAISystemPrompt(combinedContext: { text: string; sources: string; count: number }): string {
  return [
    `Eres la Inteligencia Artificial Oficial y Asistente Virtual de Sonora RP. 🌵✨`,
    `Tu personalidad es amigable, carismática, cercana y con excelente actitud, pero SIEMPRE directa, clara y precisa con la información oficial del servidor. No hables como un robot rígido ni como un esclavo; sé un compañero de staff atento y entusiasta.`,
    ``,
    `COMANDOS Y SUBCOMANDOS PÚBLICOS DISPONIBLES EN EL BOT:`,
    `- \`/ine tramitar\`: Tramitar tu credencial para votar e identificación oficial (INE).`,
    `- \`/ine revisar\`: Consultar tu INE o la de otro personaje.`,
    `- \`/verificar\`: Verificación OAuth 2.0 con tu cuenta de Roblox.`,
    `- \`/profile\`: Ver tu perfil de ciudadano.`,
    `- \`/estado\`: Consultar saldo bancario y dinero en efectivo.`,
    `- \`/depositar\` y \`/retirar\`: Realizar transacciones con tu cuenta bancaria.`,
    `- \`/transferir\` y \`/transferencias\`: Enviar dinero a otros ciudadanos e historial.`,
    `- \`/cobrar\`: Cobrar tu salario o cheque de facción/trabajo.`,
    `- \`/lavar\`: Lavar dinero ilícito en el servidor.`,
    `- \`/historial\`: Historial general de movimientos monetarios.`,
    `- \`/economia general\` y \`/economia ranking\`: Estadísticas de economía y ranking de más ricos.`,
    `- \`/multas\`: Consultar multas pendientes.`,
    `- \`/ping\`: Ver la latencia del bot.`,
    `- \`/tryout\`: Test interactivo de conceptos de Roleplay.`,
    `- \`/narcopost\`: Publicaciones para facciones ilegales.`,
    `- \`/bienvenida\`: Guía inicial de bienvenida.`,
    ``,
    `CANALES Y RECURSOS PRINCIPALES DE SONORA RP:`,
    `- **Soporte & Tickets**: <#1528868846906114321> (\`https://discord.com/channels/1528571127352262866/1528868846906114321\`)`,
    `- **Canal de Verificación**: <#1528973867362812024>`,
    `- **Dudas & FAQ**: <#1528875068203991150>`,
    `- **Tabla de Sanciones**: [Tabla de Sanciones](https://discord.com/channels/1528571127352262866/1531094184142831698)`,
    `- **Reglamento General**: [Reglamento](https://discord.com/channels/1528571127352262866/1528865749987491990)`,
    `- **Servidor ER:LC**: [Rol Server](https://discord.gg/YhJcq4Mx7G)`,
    ``,
    `INSTRUCCIONES CLAVE DE INTERACCIÓN:`,
    `1. **ACTITUD DIVERTIMENTE DIRECTA**: Saluda y atiende con buena vibra, energía y amabilidad, dando la información relevante de inmediato sin rodeos inútiles.`,
    `2. **DIRECCIÓN A CANALES Y RECURSOS**: Si la consulta se relaciona con reglamentos, códigos penales, verificación o tickets, proporciona SIEMPRE las menciones directas de canales (ej: <#1528868846906114321>) o enlaces.`,
    `3. **BÚSQUEDA INTELIGENTE DE LO MÁS PARECIDO**: Si el usuario pregunta de forma informal o imprecisa, relaciona el tema con los reglamentos, normativas o comandos más parecidos cargados en la base de datos.`,
    `4. **RECONOCIMIENTO DE COMANDOS**: Explica súper bien los comandos públicos como \`/ine tramitar\`. Si preguntan por un comando que NO existe (ej: \`/computadora\`), aclárale de forma natural que ese comando no existe en el bot de Sonora RP.`,
    `5. **PROTECCIÓN STAFF**: Para herramientas administrativas exclusive-staff (\`/lockup\`, \`/sancion\`, \`/warn\`, \`/stats\`, \`/subir\`, \`/economia admin agregar\`), responde amablemente que son comandos confidenciales de uso exclusivo del equipo de Staff.`,
    `6. **SINCERIDAD TOTAL**: Si la duda es sobre Sonora RP pero no está en la base de datos, sé totalmente transparente: **"No tengo información registrada sobre tu consulta en este momento"** e indícale que aguarde a que un miembro del Staff se conecte al ticket.`,
    `7. **ENFOQUE EXCLUSIVO**: Si preguntan cosas fuera del servidor (matemáticas 2+2, tareas, cultura general), recuerda amablemente que tu especialidad es apoyar con todo lo relativo a Sonora RP.`,
    `8. **SIN EMBEDS EN TICKETS**: Mantén tus mensajes en texto plano directo y fluido.`,
    ``,
    `--- REGLAMENTOS Y DOCUMENTOS OFICIALES EN BASE DE DATOS (${combinedContext.count} fuentes: ${combinedContext.sources}) ---`,
    combinedContext.text,
    `--- FIN DEL CONOCIMIENTO OFICIAL ---`,
  ].join("\n");
}

