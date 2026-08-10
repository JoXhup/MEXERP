import mongoose, { Schema } from "mongoose";
const EconomySchema = new Schema({
    discordId: { type: String, required: true, unique: true, index: true },
    money: { type: Number, default: 0, min: 0 },
    bank: { type: Number, default: 0, min: 0 },
    blackMoney: { type: Number, default: 0, min: 0 },
    lastCobrar: { type: Date, default: null },
    lastCobrarBonus: { type: Date, default: null },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: "" },
}, { timestamps: true });
export const Economy = mongoose.model("Economy", EconomySchema);
