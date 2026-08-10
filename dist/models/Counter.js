import mongoose, { Schema } from "mongoose";
const CounterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
}, { _id: false, versionKey: false });
export const Counter = mongoose.model("Counter", CounterSchema);
/**
 * Genera de forma atómica y segura contra carreras el siguiente ID de multa (ej: MLT-000001)
 */
export async function getNextFineId() {
    const counter = await Counter.findOneAndUpdate({ _id: "fine_id" }, { $inc: { seq: 1 } }, { new: true, upsert: true });
    const formattedNum = (counter?.seq ?? 1).toString().padStart(6, "0");
    return `MLT-${formattedNum}`;
}
