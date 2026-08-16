import mongoose, { Schema, type Document } from "mongoose";

// ─── INTERFAZ ─────────────────────────────────────────────────────────────────
export interface IStaffStats extends Document {
  userId: string;
  userTag: string;
  guildId: string;
  totalClaimed: number;
  totalClosed: number;
  totalTranscripts: number;
  averageCloseTimeMs: number;
  lastActiveAt: Date;
  hiredAt?: Date;
  hiredBy?: string;
  totalShiftTimeMs?: number;
  categoryCounts: Map<string, number>;
  ratingCount: number;
  ratingSum: number;
}

// ─── SCHEMA ────────────────────────────────────────────────────────────────────
const StaffStatsSchema = new Schema<IStaffStats>({
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
  ratingCount: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: "staff_stats",
});

StaffStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const StaffStats = mongoose.model<IStaffStats>("StaffStats", StaffStatsSchema);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export async function incrementStat(
  guildId: string,
  userId: string,
  userTag: string,
  field: "totalClaimed" | "totalClosed" | "totalTranscripts",
  category?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    $inc: { [field]: 1 },
    $set: { userTag, lastActiveAt: new Date() },
  };

  if (category) {
    update["$inc"] = { ...(update["$inc"] as object), [`categoryCounts.${category}`]: 1 };
  }

  await StaffStats.findOneAndUpdate(
    { guildId, userId },
    update,
    { upsert: true },
  );
}

export async function addStaffRating(
  guildId: string,
  userId: string,
  userTag: string,
  stars: number,
): Promise<{ newAverage: number; totalRatings: number }> {
  const stats = await StaffStats.findOneAndUpdate(
    { guildId, userId },
    {
      $inc: { ratingCount: 1, ratingSum: stars },
      $set: { userTag, lastActiveAt: new Date() },
    },
    { new: true, upsert: true },
  );

  const totalRatings = stats.ratingCount || 1;
  const newAverage = (stats.ratingSum || stars) / totalRatings;
  return { newAverage, totalRatings };
}
