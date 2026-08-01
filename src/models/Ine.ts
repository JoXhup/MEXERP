import mongoose, { Schema, type Document } from "mongoose";

// ─── MODELO: REGISTRO DE INE ──────────────────────────────────────────────────
export interface IIne extends Document {
  discordId:        string;   // ID de Discord del usuario
  nombre:           string;   // Nombre completo IC
  domicilio:        string;   // Domicilio IC + Estado
  fechaNacimiento:  string;   // DD/MM/YYYY
  sexo:             string;   // "HOMBRE" | "MUJER"
  estado:           string;   // Estado seleccionado
  robloxUsername:   string;   // Roblox username vinculado
  curp:             string;   // CURP generada
  claveElector:     string;   // Clave de Elector generada
  seccion:          string;   // Sección electoral (4 dígitos)
  vigencia:         string;   // Vigencia (2028)
  numIne:           string;   // N.º de INE (ej: 0482019482)
  createdAt:        Date;
}

const IneSchema = new Schema<IIne>({
  discordId:        { type: String, required: true, unique: true },
  nombre:           { type: String, required: true },
  domicilio:        { type: String, required: true },
  fechaNacimiento:  { type: String, required: true },
  sexo:             { type: String, required: true },
  estado:           { type: String, required: true },
  robloxUsername:   { type: String, required: true, default: "Sin vincular" },
  curp:             { type: String, required: true },
  claveElector:     { type: String, required: true },
  seccion:          { type: String, required: true },
  vigencia:         { type: String, required: true, default: "2028" },
  numIne:           { type: String, required: true },
  createdAt:        { type: Date,   default: Date.now },
});

export const Ine = mongoose.model<IIne>("Ine", IneSchema);
