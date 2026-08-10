import mongoose, { Schema } from "mongoose";
const ArrestSchema = new Schema({
    citizenId: { type: String, required: true },
    officerId: { type: String, required: true },
    partnerId: { type: String },
    tiempoStr: { type: String, required: true },
    durationMs: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    cargos: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});
export const Arrest = mongoose.model("Arrest", ArrestSchema);
