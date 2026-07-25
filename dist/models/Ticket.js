import mongoose, { Schema } from "mongoose";
// ─── SCHEMA ────────────────────────────────────────────────────────────────────
const TicketSchema = new Schema({
    ticketId: { type: String, required: true, unique: true },
    number: { type: Number, required: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    ownerId: { type: String, required: true },
    ownerTag: { type: String, required: true },
    category: { type: String, required: true },
    priority: { type: String, enum: ["low", "medium", "high", "critical"], default: "low" },
    status: { type: String, enum: ["open", "claimed", "closed"], default: "open" },
    claimedBy: { type: String },
    claimedByTag: { type: String },
    claimedAt: { type: Date },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    closedBy: { type: String },
    closedByTag: { type: String },
    closeReason: { type: String },
    modalData: { type: Map, of: String, default: {} },
    renamedTitle: { type: String },
    participants: { type: [String], default: [] },
    messageCount: { type: Number, default: 0 },
    transcriptPath: { type: String },
    transcriptChannelMessageId: { type: String },
}, {
    timestamps: true,
    collection: "tickets",
});
// ─── INDICES ───────────────────────────────────────────────────────────────────
TicketSchema.index({ guildId: 1, ownerId: 1 });
TicketSchema.index({ guildId: 1, status: 1 });
TicketSchema.index({ channelId: 1 });
export const Ticket = mongoose.model("Ticket", TicketSchema);
// ─── CONTADOR DE TICKETS ───────────────────────────────────────────────────────
const CounterSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
});
const Counter = mongoose.model("TicketCounter", CounterSchema);
/** Obtiene el proximo numero de ticket (atomico) */
export async function getNextTicketNumber(guildId) {
    const doc = await Counter.findOneAndUpdate({ guildId }, { $inc: { count: 1 } }, { upsert: true, new: true });
    return doc.count;
}
/** Formatea el numero como ticket-0001 */
export function formatTicketId(num) {
    return `ticket-${String(num).padStart(4, "0")}`;
}
