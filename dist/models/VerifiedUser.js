import mongoose, { Schema } from "mongoose";
const VerifiedUserSchema = new Schema({
    discordId: { type: String, required: true, unique: true },
    robloxId: { type: Number, required: true, unique: true },
    robloxName: { type: String, required: true },
    verifiedAt: { type: Date, default: Date.now },
});
export const VerifiedUser = mongoose.model("VerifiedUser", VerifiedUserSchema);
