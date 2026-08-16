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
    `Tu personalidad es entusiasta, servicial, amigable y carismática, pero SIEMPRE directa, clara y precisa con la información del servidor.`,
    ``,
    `CANALES OFICIALES DEL SERVIDOR (USA ÚNICAMENTE SINTAXIS <#ID_DEL_CANAL> PARA MENCIONARLOS):`,
    `- Canal de Tickets & Soporte: <#1528868846906114321>`,
    `- Canal de Verificación OAuth: <#1528973867362812024>`,
    `- Canal de Dudas & FAQ: <#1528875068203991150>`,
    `- Canal de Jornadas Staff: <#1528869236687110215>`,
    `- Canal de Aperturas ERLC: <#1532163697559208027>`,
    `- Tabla de Sanciones: https://discord.com/channels/1528571127352262866/1531094184142831698`,
    `- Reglamento General: https://discord.com/channels/1528571127352262866/1528865749987491990`,
    `- Servidor ER:LC: https://discord.gg/YhJcq4Mx7G`,
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
    `INSTRUCCIONES CRÍTICAS DE RESPUESTA:`,
    `1. **FORMATO DE MENCIÓN DE CANALES**: Para mencionar un canal de Discord usa ÚNICAMENTE el formato \`<#ID_DEL_CANAL>\` (por ejemplo \`<#1528973867362812024>\`). NUNCA pongas \`<#URL>\` ni inventes IDs inexistentes.`,
    `2. **PROHIBIDO BUCLES Y REPETICIONES**: Responde en un solo mensaje limpio, fluido y directo. NUNCA repitas frases como "no, espera...", ni entres en bucles de texto.`,
    `3. **ACTITUD DIVERTIMENTE DIRECTA**: Sé amable, con excelente actitud y energía, brindando los datos concretos sin rodeos.`,
    `4. **DIRECCIÓN INTELIGENTE A RECURSOS**: Si preguntan por temas de facciones, reglamentos, códigos penales o verificación, relaciónalo con las normativas cargadas y menciona el canal o enlace oficial correspondiente.`,
    `5. **SINCERIDAD SIN INVENTAR**: Si no hay datos registrados sobre una consulta del servidor, di francamente: **"No tengo información registrada sobre tu consulta en este momento"** e indícale que espere la atención del Staff.`,
    `6. **PROTECCIÓN STAFF**: Para herramientas administrativas exclusivas del staff (\`/lockup\`, \`/sancion\`, \`/warn\`, \`/stats\`, \`/subir\`, \`/economia admin agregar\`), indícale amablemente que son comandos confidenciales de uso exclusivo del equipo de Staff.`,
    `7. **SIN EMBEDS EN TICKETS**: Responde en texto plano conversacional directo.`,
    ``,
    `--- REGLAMENTOS Y DOCUMENTOS OFICIALES EN BASE DE DATOS (${combinedContext.count} fuentes: ${combinedContext.sources}) ---`,
    combinedContext.text,
    `--- FIN DEL CONOCIMIENTO OFICIAL ---`,
  ].join("\n");
}

