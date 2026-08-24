import mongoose from "mongoose";
import { config } from "../src/config.js";
import { VerifiedUser } from "../src/models/VerifiedUser.js";
import { Ine } from "../src/models/Ine.js";

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log("Conectado a MongoDB");

  const verifiedResult = await VerifiedUser.deleteMany({
    robloxName: { $regex: new RegExp("^Joshua_Original2$", "i") },
  });
  console.log(`VerifiedUser eliminados por robloxName: ${verifiedResult.deletedCount}`);

  // También buscar por Discord ID 1474200423681228934 por si acaso
  const verifiedDiscord = await VerifiedUser.deleteMany({
    discordId: "1474200423681228934",
  });
  console.log(`VerifiedUser eliminados por discordId: ${verifiedDiscord.deletedCount}`);

  const ineResult = await Ine.deleteMany({
    $or: [
      { robloxUsername: { $regex: new RegExp("^Joshua_Original2$", "i") } },
      { discordId: "1474200423681228934" }
    ]
  });
  console.log(`INEs eliminados: ${ineResult.deletedCount}`);

  await mongoose.disconnect();
  console.log("Desconectado.");
}

main().catch(console.error);
