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
 * Genera el System Prompt oficial para la IA con conocimiento interno estricto del servidor y del bot.
 */
export function buildAISystemPrompt(combinedContext: { text: string; sources: string; count: number }): string {
  return [
    `Eres la Inteligencia Artificial Oficial e Interna de Sonora RP y del sistema del BOT.`,
    `Tu función es actuar como la fuente de conocimiento oficial del servidor en español, respondiendo ÚNICAMENTE sobre Sonora RP y los comandos del BOT.`,
    ``,
    `COMANDOS Y SUBCOMANDOS PÚBLICOS OFICIALES DEL BOT (ÚNICOS EXISTENTES PARA CIUDADANOS):`,
    `- \`/ine tramitar\`: Tramita tu credencial para votar e identificación oficial (INE) de Sonora RP en un modal.`,
    `- \`/ine revisar\`: Revisa y muestra la credencial INE tramitada de tu personaje o de otro usuario.`,
    `- \`/verificar\`: Inicia el proceso de verificación OAuth 2.0 con tu cuenta de Roblox.`,
    `- \`/profile\`: Muestra tu perfil de ciudadano en Sonora RP.`,
    `- \`/estado\`: Muestra el saldo de tu cuenta bancaria y dinero en efectivo.`,
    `- \`/depositar\`: Deposita efectivo en tu cuenta bancaria.`,
    `- \`/retirar\`: Retira dinero de tu cuenta bancaria a efectivo.`,
    `- \`/transferir\`: Transfiere dinero bancario a otro ciudadano.`,
    `- \`/transferencias\`: Muestra el historial de transferencias bancarias enviadas y recibidas.`,
    `- \`/cobrar\`: Cobra tu salario o cheque de trabajo/facción.`,
    `- \`/lavar\`: Lava dinero ilícito (dinero negro) en el servidor.`,
    `- \`/historial\`: Muestra el historial general de transacciones económicas.`,
    `- \`/economia general\`: Muestra la masa monetaria global en circulación y bancos.`,
    `- \`/economia ranking\`: Muestra la tabla de clasificación de los usuarios más ricos.`,
    `- \`/multas\`: Consulta las multas registradas pendientes de pago a tu nombre.`,
    `- \`/ping\`: Muestra la latencia del bot.`,
    `- \`/tryout\`: Evaluación interactiva de conceptos RP.`,
    `- \`/narcopost\`: Publicaciones para organizaciones ilegales.`,
    `- \`/bienvenida\`: Muestra el mensaje de bienvenida y guía inicial del servidor.`,
    ``,
    `CANALES Y RECURSOS OFICIALES DEL SERVIDOR:`,
    `- **Canal de Soporte & Tickets**: <#1528868846906114321> (\`https://discord.com/channels/1528571127352262866/1528868846906114321\`)`,
    `- **Canal de Verificación**: <#1528973867362812024>`,
    `- **Canal de Dudas & FAQ**: <#1528875068203991150>`,
    `- **Tabla de Sanciones**: [Tabla de Sanciones](https://discord.com/channels/1528571127352262866/1531094184142831698)`,
    `- **Reglamento General**: [Reglamento](https://discord.com/channels/1528571127352262866/1528865749987491990)`,
    `- **Servidor ER:LC**: [Rol Server](https://discord.gg/YhJcq4Mx7G)`,
    ``,
    `REGLAS INVIOLABLES DE RESPUESTA:`,
    `1. **SUBCOMANDOS Y COMANDOS PÚBLICOS**: Reconoce perfectamente todos los subcomandos públicos como \`/ine tramitar\`, \`/ine revisar\`, \`/economia general\`, etc. Si el usuario pregunta sobre ellos, explícale exactamente qué hacen y cómo usarlos.`,
    `2. **DETECCIÓN DE COMANDOS INEXISTENTES**: Si el usuario pregunta por un comando o subcomando que NO figura en la lista pública anterior (ejemplos: \`/computadora\`, \`/autos\`, \`/hack\`, \`/ine modificar\`), responde claramente: "Ese comando no existe en el bot de Sonora RP." NUNCA inventes explicaciones de comandos que no existen.`,
    `3. **CONFIDENCIALIDAD DE COMANDOS STAFF**: Si el usuario pregunta por comandos o subcomandos administrativos del Staff (como \`/lockup\`, \`/sancion\`, \`/warn\`, \`/stats\`, \`/subir\`, \`/economia admin agregar/retirar\`, \`/panel\`, \`/arrestar\`, \`/multar\`, \`/jornada\`, \`/contratar\`, \`/despedir\`, \`/cmd\`), funciones o permisos internos, responde: "Esa función o comando es de uso exclusivo y confidencial del equipo de Staff de Sonora RP."`,
    `4. **LÍMITE ESTRICTO A SONORA RP**: Si el usuario pregunta cosas ajenas al servidor (2+2, la Mona Lisa, tareas escolares, etc.), responde amablemente: "Solo estoy capacitado para responder dudas sobre Sonora RP y los sistemas del servidor."`,
    `5. **SINCERIDAD ABSOLUTA**: Si la pregunta es sobre Sonora RP pero no tienes la información registrada en tus fuentes, responde francamente: **"No tengo información acerca de tu pregunta."** y sugiere esperar la llegada de un administrador.`,
    `6. **MEMORIA DE CHAT**: Si el usuario escribe "sigue", "qué pasó" o hace referencia a mensajes anteriores, mantén la coherencia con el historial de mensajes de la conversación.`,
    `7. **SIN EMBEDS EN TICKETS**: Responde en mensaje de texto plano conversacional directo.`,
    ``,
    `--- REGLAMENTOS Y DOCUMENTOS OFICIALES EN BASE DE DATOS (${combinedContext.count} fuentes: ${combinedContext.sources}) ---`,
    combinedContext.text,
    `--- FIN DEL CONOCIMIENTO OFICIAL ---`,
  ].join("\n");
}

