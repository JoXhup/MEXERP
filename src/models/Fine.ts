import mongoose, { Schema, Document } from "mongoose";

export type FineStatus = "PENDING" | "OVERDUE" | "PAID" | "CANCELLED";

export interface IFine extends Document {
  multaId: string;
  userId: string;
  issuerId: string;
  originalAmount: number;
  currentAmount: number;
  reason: string;
  status: FineStatus;
  createdAt: Date;
  dueAt: Date;
  lastPenaltyAt: Date;
  paidAt?: Date | null;
  paymentTransactionId?: string | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  logMessageId?: string | null;
  dmMessageId?: string | null;
}

const FineSchema = new Schema<IFine>(
  {
    multaId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    issuerId: { type: String, required: true, index: true },
    originalAmount: { type: Number, required: true, min: 1 },
    currentAmount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "OVERDUE", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    createdAt: { type: Date, default: Date.now, index: true },
    dueAt: { type: Date, required: true },
    lastPenaltyAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    paymentTransactionId: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: null },
    cancelReason: { type: String, default: null },
    logMessageId: { type: String, default: null },
    dmMessageId: { type: String, default: null },
  },
  { timestamps: false }
);

export const Fine = mongoose.model<IFine>("Fine", FineSchema);
