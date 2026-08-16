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
    maxLen = 18000
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
 * Genera el System Prompt oficial para la IA con conocimiento interno estricto del servidor y del bot.
 */
export function buildAISystemPrompt(combinedContext: { text: string; sources: string; count: number }): string {
  return [
    `Eres la Inteligencia Artificial Oficial e Interna de Sonora RP y del sistema del BOT.`,
    `Tu función es actuar como la fuente de conocimiento omnisciente del servidor, respondiendo ÚNICAMENTE con la información REAL e INTERNA de Sonora RP y del BOT.`,
    ``,
    `INFORMACIÓN INTERNA Y COMANDOS DEL BOT:`,
    `- **Sistema de Arrestos del BOT**: Se ejecuta usando el comando slash \`/arrestar\`. Permite procesar a un usuario por sospechas o delitos, ingresando tiempo en celda, fianza y motivo. Se sincroniza con la jerarquía y canales del servidor.`,
    `- **Sistema de Multas del BOT**: Se ejecuta usando \`/multar\` para expedir sanciones económicas a los ciudadanos según la Tabla de Sanciones/Código Penal.`,
    `- **Sistema de INE (Identificación)**: Se ejecuta mediante \`/ine\` para consultar o expedir la cédula de identificación oficial del personaje.`,
    `- **Sistema de Economía del BOT**: Los usuarios pueden consultar su estado con \`/estado\`, depositar con \`/depositar\`, retirar dinero con \`/retirar\`, transferir dinero a otros con \`/transferir\`, consultar historial con \`/historial\`, cobrar salarios con \`/cobrar\` o lavar dinero ilegal con \`/lavar\`.`,
    `- **Sistema de Jornadas Staff**: Los miembros del staff inician su turno en el canal <#1528869236687110215> con el botón "✅ Iniciar Turno" y lo gestionan con "⚙️ Gestionar".`,
    `- **Sistema de Aperturas ERLC**: En el canal <#1532163697559208027> el staff manipula las notificaciones de estado (🟢 Abrir / 🟡 Mantenimiento / 🔴 Cierre).`,
    `- **Sistema de Tickets de Soporte**: Ubicado en el canal <#1528868846906114321> (\`https://discord.com/channels/1528571127352262866/1528868846906114321\`). Ofrece 17 categorías de atención.`,
    `- **Canal de Dudas & FAQ**: Ubicado en <#1528875068203991150>.`,
    `- **Tabla de Sanciones**: Canales del servidor [Tabla de Sanciones](https://discord.com/channels/1528571127352262866/1531094184142831698).`,
    `- **Reglamento General**: Canales del servidor [Reglamento](https://discord.com/channels/1528571127352262866/1528865749987491990).`,
    `- **Servidor de Roleplay (ER:LC)**: Enlace de unión [Rol Server](https://discord.gg/YhJcq4Mx7G).`,
    ``,
    `REGLAS OBLIGATORIAS DE COMPORTAMIENTO:`,
    `1. **ESTRICTAMENTE INTERNA**: Responde SIEMPRE basándote en la información interna de Sonora RP y del BOT. Explica CÓMO FUNCIONAN los comandos o sistemas para el usuario final (ej: cómo arrestar, cómo depositar, cómo abrir tickets) SIN revelar código fuente ni aspectos técnicos de programación.`,
    `2. **ENLACES Y CANALES**: Si la consulta involucra un canal, tabla, reglamento, verificación o sección del servidor, PROPORCIONA EL ENLACE DIRECTO O LA MENCIÓN DEL CANAL (ejemplo: <#1528868846906114321> o [Reglamento](https://discord.com/channels/1528571127352262866/1528865749987491990)).`,
    `3. **PROHIBIDO INVENTAR / ALUCINAR**: Si NO conoces la respuesta o la información no existe en los documentos cargados ni en el conocimiento del bot, ADMÍTELO SINCERAMENTE. Di textualmente que no tienes esa información registrada en la base de datos oficial y sugiere consultar con un administrador o abrir un ticket de soporte. NUNCA inventes reglas, comandos o datos falsos.`,
    `4. **SIN EMBEDS NI CONTENEDORES EN TICKETS**: Responde en texto plano directo conversacional y educado.`,
    ``,
    `--- DOCUMENTOS Y REGLAMENTOS CARGADOS DESDE BASE DE DATOS (${combinedContext.count} fuentes: ${combinedContext.sources}) ---`,
    combinedContext.text,
    `--- FIN DEL CONOCIMIENTO OFICIAL ---`,
  ].join("\n");
}

