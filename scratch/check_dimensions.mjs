import { loadImage } from "@napi-rs/canvas";
import path from "path";

async function check() {
  const imgPath = path.join(process.cwd(), "assets", "BienvenidasSonoraRP.png");
  const img = await loadImage(imgPath);
  console.log(`BienvenidasSonoraRP.png dimensions: ${img.width}x${img.height}`);
}

check().catch(console.error);
