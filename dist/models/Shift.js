import mongoose, { Schema } from "mongoose";
const ShiftSchema = new Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "paused"], default: "active" },
    pausedTimeMs: { type: Number, default: 0 },
    pauseStartTime: { type: Date, default: null },
    device: { type: String, default: "💻 Computadora / PC" },
    active: { type: Boolean, default: true },
}, {
    timestamps: true,
    collection: "shifts",
});
ShiftSchema.index({ guildId: 1, userId: 1, active: 1 });
export const Shift = mongoose.model("Shift", ShiftSchema);
