import { loadImage, createCanvas } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

async function testImage() {
  const imgPath = path.join(process.cwd(), "assets", "BienvenidasSinaloaRP.png");
  const img = await loadImage(imgPath);
  console.log(`Dimensions: ${img.width}x${img.height}`);
}

testImage().catch(console.error);
