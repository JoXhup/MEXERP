import mongoose, { Schema, type Document } from "mongoose";

export interface ILockupHistory {
  action: "ENVIAR" | "AGREGAR" | "ACORTAR" | "RETIRAR" | "EXPIRAR";
  moderatorId: string;
  tiempoMs?: number;
  motivo?: string;
  timestamp: Date;
}

export interface ILockup extends Document {
  lockupId: string;        // Ej: LKP-000001
  discordId: string;       // ID de Discord del usuario sancionado
  moderatorId: string;     // ID de Discord del moderador que inició el Lockup
  guildId: string;         // ID del servidor
  motivo: string;          // Motivo inicial
  durationMs: number;      // Duración total acumulada en milisegundos
  startTime: Date;         // Fecha/Hora de inicio
  endTime: Date;           // Fecha/Hora calculada de término
  active: boolean;         // Si la sanción está activa
  pruebasUrl?: string;     // URL de la imagen/evidencia subida
  history: ILockupHistory[];
  retiredBy?: string;      // ID del moderador que retiró manualmente la sanción
  retiredAt?: Date;        // Fecha/Hora de retiro manual
  createdAt: Date;
}

const LockupHistorySchema = new Schema<ILockupHistory>(
  {
    action: { type: String, required: true },
    moderatorId: { type: String, required: true },
    tiempoMs: { type: Number },
    motivo: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LockupSchema = new Schema<ILockup>({
  lockupId: { type: String, required: true, unique: true },
  discordId: { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  guildId: { type: String, required: true },
  motivo: { type: String, required: true },
  durationMs: { type: Number, required: true },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date, required: true, index: true },
  active: { type: Boolean, default: true, index: true },
  pruebasUrl: { type: String },
  history: [LockupHistorySchema],
  retiredBy: { type: String },
  retiredAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const Lockup = mongoose.model<ILockup>("Lockup", LockupSchema);
