export class GuildKnowledgeCache {
    cache = new Map();
    getItems(guildId) {
        return this.cache.get(guildId) ?? [];
    }
    addItem(guildId, item) {
        const items = this.getItems(guildId);
        const newItem = {
            ...item,
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            addedAt: Date.now(),
        };
        items.push(newItem);
        this.cache.set(guildId, items);
        return newItem;
    }
    deleteItems(guildId, ids) {
        const items = this.getItems(guildId);
        const initialLen = items.length;
        const filtered = items.filter((it) => !ids.includes(it.id));
        this.cache.set(guildId, filtered);
        return initialLen - filtered.length;
    }
    clear(guildId) {
        const existed = (this.cache.get(guildId)?.length ?? 0) > 0;
        this.cache.delete(guildId);
        return existed;
    }
    getCombined(guildId, maxLen = 12000) {
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
