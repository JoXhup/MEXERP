import mongoose, { Schema } from "mongoose";
const PanelSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
}, { collection: "panel_messages" });
export const PanelMessage = mongoose.model("PanelMessage", PanelSchema);
