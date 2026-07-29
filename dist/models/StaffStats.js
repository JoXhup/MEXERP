import mongoose, { Schema } from "mongoose";
// ─── SCHEMA ────────────────────────────────────────────────────────────────────
const StaffStatsSchema = new Schema({
    userId: { type: String, required: true },
    userTag: { type: String, required: true },
    guildId: { type: String, required: true },
    totalClaimed: { type: Number, default: 0 },
    totalClosed: { type: Number, default: 0 },
    totalTranscripts: { type: Number, default: 0 },
    averageCloseTimeMs: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    hiredAt: { type: Date },
    hiredBy: { type: String },
    totalShiftTimeMs: { type: Number, default: 0 },
    categoryCounts: { type: Map, of: Number, default: {} },
}, {
    timestamps: true,
    collection: "staff_stats",
});
StaffStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });
export const StaffStats = mongoose.model("StaffStats", StaffStatsSchema);
// ─── HELPERS ──────────────────────────────────────────────────────────────────
export async function incrementStat(guildId, userId, userTag, field, category) {
    const update = {
        $inc: { [field]: 1 },
        $set: { userTag, lastActiveAt: new Date() },
    };
    if (category) {
        update["$inc"] = { ...update["$inc"], [`categoryCounts.${category}`]: 1 };
    }
    await StaffStats.findOneAndUpdate({ guildId, userId }, update, { upsert: true });
}
