import { Schema, model, type Document } from "mongoose";

export interface IKnowledgeDocument extends Document {
  guildId: string;
  docId: string;
  name: string;
  type: "PDF" | "Word" | "Excel" | "Imagen" | "Texto";
  text: string;
  addedAt: Date;
}

const knowledgeDocumentSchema = new Schema<IKnowledgeDocument>({
  guildId: { type: String, required: true, index: true },
  docId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  text: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
});

export const KnowledgeDocument = model<IKnowledgeDocument>(
  "KnowledgeDocument",
  knowledgeDocumentSchema
);
