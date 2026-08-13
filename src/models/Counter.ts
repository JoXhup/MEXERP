import mongoose, { Schema } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { _id: false, versionKey: false }
);

export const Counter = mongoose.model<ICounter>("Counter", CounterSchema);

/**
 * Genera de forma atómica y segura contra carreras el siguiente ID de multa (ej: MLT-000001)
 */
export async function getNextFineId(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: "fine_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const formattedNum = (counter?.seq ?? 1).toString().padStart(6, "0");
  return `MLT-${formattedNum}`;
}

/**
 * Genera de forma atómica y segura el siguiente ID de Lockup (ej: LKP-000001)
 */
export async function getNextLockupId(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: "lockup_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const formattedNum = (counter?.seq ?? 1).toString().padStart(6, "0");
  return `LKP-${formattedNum}`;
}

/**
 * Genera de forma atómica y segura el siguiente ID de Advertencia (ej: ADW-000001)
 */
export async function getNextWarnId(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: "warn_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const formattedNum = (counter?.seq ?? 1).toString().padStart(6, "0");
  return `ADW-${formattedNum}`;
}
