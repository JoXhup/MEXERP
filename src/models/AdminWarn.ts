import mongoose, { Schema, type Document } from "mongoose";

export interface IAdminWarn extends Document {
  warnId: string;          // ADW-000001
  discordId: string;       // Staff sancionado
  moderatorId: string;     // Moderador que emitió la advertencia
  guildId: string;
  falta: string;           // Descripción de la falta
  pruebasUrls: string[];   // Hasta 5 imágenes de prueba
  active: boolean;         // Si está activa (no retirada)
  retiredBy?: string;
  retiredAt?: Date;
  createdAt: Date;
}

const AdminWarnSchema = new Schema<IAdminWarn>({
  warnId:      { type: String, required: true, unique: true },
  discordId:   { type: String, required: true, index: true },
  moderatorId: { type: String, required: true },
  guildId:     { type: String, required: true },
  falta:       { type: String, required: true },
  pruebasUrls: [{ type: String }],
  active:      { type: Boolean, default: true, index: true },
  retiredBy:   { type: String },
  retiredAt:   { type: Date },
  createdAt:   { type: Date, default: Date.now },
});

export const AdminWarn = mongoose.model<IAdminWarn>("AdminWarn", AdminWarnSchema);
