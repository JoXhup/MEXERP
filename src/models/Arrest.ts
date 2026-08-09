import mongoose, { Schema, type Document } from "mongoose";

// ─── MODELO: ARRESTO DE CIUDADANO ──────────────────────────────────────────────
export interface IArrest extends Document {
  citizenId:  string;   // ID de Discord del ciudadano arrestado
  officerId:  string;   // ID de Discord del oficial que arrestó
  partnerId?: string;   // ID de Discord del compañero (opcional)
  tiempoStr:  string;   // Formato de tiempo original (ej: 2h 3m)
  durationMs: number;   // Duración en milisegundos
  expiresAt:  Date;     // Fecha/Hora exacta en que se vence la condena
  cargos:     string;   // Cargos penales
  createdAt:  Date;
}

const ArrestSchema = new Schema<IArrest>({
  citizenId:  { type: String, required: true },
  officerId:  { type: String, required: true },
  partnerId:  { type: String },
  tiempoStr:  { type: String, required: true },
  durationMs: { type: Number, required: true },
  expiresAt:  { type: Date, required: true },
  cargos:     { type: String, required: true },
  createdAt:  { type: Date, default: Date.now },
});

export const Arrest = mongoose.model<IArrest>("Arrest", ArrestSchema);
