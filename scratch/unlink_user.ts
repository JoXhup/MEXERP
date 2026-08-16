import mongoose from "mongoose";
import { config } from "../src/config.js";
import { VerifiedUser } from "../src/models/VerifiedUser.js";

async function unlink() {
  await mongoose.connect(config.mongoUri);
  console.log("Conectado a MongoDB.");

  const discordId = "1474200423681228934";
  const robloxName = "Joshua_Original2";

  const result1 = await VerifiedUser.deleteMany({
    $or: [
      { discordId: discordId },
      { robloxUsername: new RegExp(`^${robloxName}$`, "i") }
    ]
  });

  console.log(`Registros desvinculados de VerifiedUser: ${result1.deletedCount}`);

  await mongoose.disconnect();
  console.log("Desconexión completada.");
}

unlink().catch(console.error);
