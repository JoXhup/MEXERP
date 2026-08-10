import mongoose, { Schema } from "mongoose";
const FineSchema = new Schema({
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
}, { timestamps: false });
export const Fine = mongoose.model("Fine", FineSchema);
