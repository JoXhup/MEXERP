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
   * Obtiene la combinación de todo el conocimiento almacenado
   */
  getCombined(guildId: string, maxLen = 120000): { text: string; sources: string; count: number } {
    const items = this.getItems(guildId);
    if (items.length === 0) {
      return { text: "", sources: "", count: 0 };
    }

    const sources = items.map((it) => `${it.type}: ${it.name}`).join(", ");
    let combined = items
      .map((it, idx) => `--- FUENTE #${idx + 1}: ${it.name} (${it.type}) ---\n${it.text}`)
      .join("\n\n");

    if (combined.length > maxLen) {
      combined = combined.substring(0, maxLen) + "\n\n[... contexto truncado por límite de tokens ...]";
    }

    return { text: combined, sources, count: items.length };
  }
}

export const documentCache = new GuildKnowledgeCache();

/**
 * Genera el System Prompt oficial para la IA con reglas de flexibilidad,
 * síntesis inteligente, formato en Discord y precisión de información.
 */
export function buildAISystemPrompt(combinedContext: { text: string; sources: string; count: number }): string {
  return [
    `Eres la Inteligencia Artificial Oficial del servidor Sonora RP.`,
    `Tu misión es responder las consultas de la comunidad de forma profesional, atenta, bien redactada, pulida y estructurada en español.`,
    ``,
    `REGLAS OBLIGATORIAS DE RESPUESTA Y SÍNTESIS:`,
    `1. **Búsqueda Flexible e Inteligente**: Comprende la intención de la duda aunque el usuario utilice términos informales o coloquiales (ejemplo: 'articulo penal', 'titulo II', 'multa por choque', 'sanción'). Relaciona estos conceptos con los títulos, capítulos, artículos o secciones de los documentos oficiales cargados (Códigos Penales, Reglamentos, Guías).`,
    `2. **Desarrollo Sintético y Claro**: Explica las normas, sanciones y procedimientos con un estilo propio, organizado y fácil de entender. NUNCA menciones etiquetas internas como "[OCR PDF...]" ni repitas fragmentos sin sentido.`,
    `3. **Formato Atractivo y Estructurado**: Organiza tus respuestas usando markdown limpio de Discord (titulares en negrita, listas, bloques de cita y emojis descriptivos).`,
    `4. **Fidelidad al Conocimiento Almacenado**: Preserva el 100% de la veracidad y precisión de las sanciones, tiempos de celda, multas y reglas guardadas.`,
    `5. **Búsqueda exhaustiva**: Si la información sobre la consulta está presente en cualquiera de las fuentes cargadas, explica en detalle qué establece.`,
    ``,
    `--- BASE DE DATOS DE CONOCIMIENTO OFICIAL (${combinedContext.count} fuentes activas: ${combinedContext.sources}) ---`,
    combinedContext.text,
    `--- FIN DEL CONOCIMIENTO OFICIAL ---`,
  ].join("\n");
}

