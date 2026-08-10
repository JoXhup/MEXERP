import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Entry Point universal para Pterodactyl, Node.js y Bun
if (existsSync("./dist/index.js")) {
  import(pathToFileURL("./dist/index.js").href);
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await import("./src/index.ts");
  } catch (err) {
    console.error("[ENTRY] Error al iniciar el bot:", err);
  }
}
