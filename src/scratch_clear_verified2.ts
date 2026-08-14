import mongoose from "mongoose";
import { config } from "./config.js";
import { VerifiedUser } from "./models/VerifiedUser.js";

async function clearDB() {
  await mongoose.connect(config.mongoUri);
  console.log("[DB] Conectado a MongoDB.");

  const deleted = await VerifiedUser.deleteMany({});
  console.log(`[OK] Eliminados ${deleted.deletedCount} registro(s) de VerifiedUser.`);

  await mongoose.disconnect();
}

clearDB().catch(console.error);
