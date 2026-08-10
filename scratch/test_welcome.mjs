import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

async function renderWelcomeCard({ username, memberCount, avatarUrl }) {
  const width = 1024;
  const height = 576;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Cargar y dibujar imagen de fondo
  const bgPath = path.join(process.cwd(), "assets", "BienvenidasSinaloaRP.png");
  const bgImage = await loadImage(bgPath);
  ctx.drawImage(bgImage, 0, 0, width, height);

  // 2. Capa sutil de sombreado en el área derecha/centro para maximizar legibilidad
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.15)");
  gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.45)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 3. Posiciones de Avatar
  const avatarRadius = 100;
  const avatarCenterX = 820;
  const avatarCenterY = height / 2; // 288

  // Cargar Avatar
  let avatarImg;
  try {
    avatarImg = await loadImage(avatarUrl);
  } catch {
    // Fallback si falla el avatar
    const fallbackCanvas = createCanvas(200, 200);
    const fctx = fallbackCanvas.getContext("2d");
    fctx.fillStyle = "#2ecc71";
    fctx.fillRect(0, 0, 200, 200);
    avatarImg = await loadImage(fallbackCanvas.toBuffer("image/png"));
  }

  // Sombra exterior / Resplandor Neón para el Avatar
  ctx.save();
  ctx.shadowColor = "#00E5FF";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // Recorte circular para el avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(
    avatarImg,
    avatarCenterX - avatarRadius,
    avatarCenterY - avatarRadius,
    avatarRadius * 2,
    avatarRadius * 2
  );
  ctx.restore();

  // Borde brillante sobre el avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#00E5FF";
  ctx.stroke();
  ctx.restore();

  // 4. Textos alineados a la izquierda del avatar (alineados a la derecha terminando en X = 680)
  const textRightX = 690;

  // Configuración de sombra de texto para contraste perfecto
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Texto 1: "¡BIENVENIDO A SONORA RP!"
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = "#00E5FF";
  ctx.textAlign = "right";
  ctx.fillText("¡BIENVENIDO A SONORA RP!", textRightX, avatarCenterY - 45);

  // Texto 2: Nombre de Usuario Completo (arriba)
  ctx.font = "bold 44px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "right";
  ctx.fillText(username, textRightX, avatarCenterY + 10);

  // Texto 3: "Es el miembro #(Número)" (abajo)
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#F1C40F";
  ctx.textAlign = "right";
  ctx.fillText(`Es el miembro #${memberCount}`, textRightX, avatarCenterY + 55);

  return canvas.toBuffer("image/png");
}

// Probar con datos ficticios
async function runTest() {
  const buf = await renderWelcomeCard({
    username: "JoXhu#0001",
    memberCount: "1,250",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
  });
  fs.writeFileSync(path.join(process.cwd(), "scratch", "test_welcome.png"), buf);
  console.log("Welcome card rendered to scratch/test_welcome.png");
}

runTest().catch(console.error);
