import mongoose, { Schema, Document } from "mongoose";

export interface IEconomy extends Document {
  discordId: string;
  money: number;
  bank: number;
  blackMoney: number;
  lastCobrar?: Date | null;
  lastCobrarBonus?: Date | null;
  isBlocked: boolean;
  blockReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EconomySchema = new Schema<IEconomy>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    money: { type: Number, default: 0, min: 0 },
    bank: { type: Number, default: 0, min: 0 },
    blackMoney: { type: Number, default: 0, min: 0 },
    lastCobrar: { type: Date, default: null },
    lastCobrarBonus: { type: Date, default: null },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Economy = mongoose.model<IEconomy>("Economy", EconomySchema);
