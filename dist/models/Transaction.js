import mongoose, { Schema } from "mongoose";
const TransactionSchema = new Schema({
    txId: { type: String, required: true, unique: true, index: true },
    discordId: { type: String, required: true, index: true },
    targetId: { type: String, default: null },
    type: {
        type: String,
        required: true,
        enum: [
            "cobro",
            "deposito",
            "retiro",
            "transferencia_enviada",
            "transferencia_recibida",
            "lavado",
            "admin_add",
            "admin_remove",
            "admin_set",
            "admin_blackmoney",
            "admin_reset",
        ],
    },
    amount: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    balanceMoneyAfter: { type: Number, required: true },
    balanceBankAfter: { type: Number, required: true },
    balanceBlackAfter: { type: Number, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });
export const Transaction = mongoose.model("Transaction", TransactionSchema);
