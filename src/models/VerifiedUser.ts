import mongoose, { Schema, type Document } from "mongoose";

// ─── MODELO: USUARIOS VERIFICADOS ─────────────────────────────────────────────
export interface IVerifiedUser extends Document {
  discordId:   string;   // ID de Discord (único)
  robloxId:    number;   // ID de Roblox   (único)
  robloxName:  string;   // @username de Roblox
  verifiedAt:  Date;
}

const VerifiedUserSchema = new Schema<IVerifiedUser>({
  discordId:  { type: String, required: true, unique: true },
  robloxId:   { type: Number, required: true, unique: true },
  robloxName: { type: String, required: true },
  verifiedAt: { type: Date,   default: Date.now },
});

export const VerifiedUser = mongoose.model<IVerifiedUser>(
  "VerifiedUser",
  VerifiedUserSchema,
);
