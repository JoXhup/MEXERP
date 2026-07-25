import mongoose, { Schema, type Document } from "mongoose";

// ─── INTERFAZ ─────────────────────────────────────────────────────────────────
export interface IPanelMessage extends Document {
  guildId: string;
  channelId: string;
  messageId: string;
}

const PanelSchema = new Schema<IPanelMessage>({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
}, { collection: "panel_messages" });

export const PanelMessage = mongoose.model<IPanelMessage>("PanelMessage", PanelSchema);
