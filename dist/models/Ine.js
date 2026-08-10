import mongoose, { Schema } from "mongoose";
const IneSchema = new Schema({
    discordId: { type: String, required: true, unique: true },
    nombre: { type: String, required: true },
    domicilio: { type: String, required: true },
    fechaNacimiento: { type: String, required: true },
    sexo: { type: String, required: true },
    estado: { type: String, required: true },
    robloxUsername: { type: String, required: true, default: "Sin vincular" },
    curp: { type: String, required: true },
    claveElector: { type: String, required: true },
    seccion: { type: String, required: true },
    vigencia: { type: String, required: true, default: "2028" },
    numIne: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});
export const Ine = mongoose.model("Ine", IneSchema);
