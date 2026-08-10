import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

/** Helper para dibujar rectángulos redondeados en Canvas */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function renderFormalWelcomeCard({ username, memberCount, avatarUrl }) {
  const width = 1024;
  const height = 576;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Cargar imagen de fondo oficial
  const bgPath = path.join(process.cwd(), "assets", "BienvenidasSinaloaRP.png");
  if (fs.existsSync(bgPath)) {
    const bgImage = await loadImage(bgPath);
    ctx.drawImage(bgImage, 0, 0, width, height);
  } else {
    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Viñeta y sombra cinematográfica sutil
  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, 200,
    width / 2, height / 2, 600
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0.2)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.75)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 3. Tarjeta Glassmorphic Translucida para el Texto (Centro - Izquierda)
  const cardX = 50;
  const cardY = 160;
  const cardWidth = 600;
  const cardHeight = 256;
  const cardRadius = 32;

  // Sombra proyectada del panel
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.fillStyle = "rgba(12, 15, 24, 0.75)"; // Fondo vidrio oscuro
  ctx.fill();
  ctx.restore();

  // Borde fino de cristal metálico para el panel (Estilo Glassmorphism Formal)
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  const borderGradient = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
  borderGradient.addColorStop(0, "rgba(255, 255, 255, 0.4)");
  borderGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.1)");
  borderGradient.addColorStop(1, "rgba(255, 255, 255, 0.3)");
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderGradient;
  ctx.stroke();
  ctx.restore();

  // Badge/Pill "SONORA RP · BIENVENIDA"
  const badgeX = cardX + 35;
  const badgeY = cardY + 35;
  const badgeW = 260;
  const badgeH = 34;
  const badgeR = 17;

  ctx.save();
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeR);
  ctx.fillStyle = "rgba(241, 196, 15, 0.15)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(241, 196, 15, 0.4)";
  ctx.stroke();
  ctx.restore();

  // Texto del Badge
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#F1C40F";
  ctx.textAlign = "center";
  ctx.fillText("SONORA RP · BIENVENIDA", badgeX + badgeW / 2, badgeY + 22);

  // Texto 1: Nombre completo de usuario (arriba)
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  let displayUsername = username;
  if (displayUsername.length > 22) {
    displayUsername = displayUsername.slice(0, 20) + "...";
  }

  ctx.font = "bold 40px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(displayUsername, cardX + 35, cardY + 125);

  // Texto 2: "Es el miembro #(Número)" (abajo)
  const formattedCount = typeof memberCount === "number"
    ? memberCount.toLocaleString("es-MX")
    : memberCount;

  ctx.font = "600 26px sans-serif";
  ctx.fillStyle = "#D1D5DB"; // Gris elegante / Plata
  ctx.fillText(`Es el miembro `, cardX + 35, cardY + 185);

  // Resaltar el número en dorado metálico
  const prefixWidth = ctx.measureText("Es el miembro ").width;
  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#F1C40F";
  ctx.fillText(`#${formattedCount}`, cardX + 35 + prefixWidth, cardY + 185);

  // 4. Avatar Formal Vidrio Templado (Parte Derecha Centrada)
  const avatarCenterX = 800;
  const avatarCenterY = height / 2;
  const avatarRadius = 110;

  let avatarImg;
  try {
    avatarImg = await loadImage(avatarUrl);
  } catch {
    const fallbackCanvas = createCanvas(220, 220);
    const fctx = fallbackCanvas.getContext("2d");
    fctx.fillStyle = "#2ecc71";
    fctx.fillRect(0, 0, 220, 220);
    avatarImg = await loadImage(fallbackCanvas.toBuffer("image/png"));
  }

  // Anillo Glassmorphic Exterior (Frosted Glass Rim)
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 14, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.stroke();
  ctx.restore();

  // Recorte circular del Avatar
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

  // Borde Doble Formal de Plata / Oro para el Avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  const avatarBorderGrad = ctx.createLinearGradient(
    avatarCenterX - avatarRadius, avatarCenterY - avatarRadius,
    avatarCenterX + avatarRadius, avatarCenterY + avatarRadius
  );
  avatarBorderGrad.addColorStop(0, "#FFFFFF");
  avatarBorderGrad.addColorStop(0.5, "#F1C40F");
  avatarBorderGrad.addColorStop(1, "rgba(255, 255, 255, 0.8)");
  ctx.strokeStyle = avatarBorderGrad;
  ctx.stroke();
  ctx.restore();

  // Reflejo de cristal superior (Curved Glass Reflection)
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius - 2, Math.PI * 1.1, Math.PI * 1.9);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.stroke();
  ctx.restore();

  return canvas.toBuffer("image/png");
}

async function runFormalTest() {
  const buf = await renderFormalWelcomeCard({
    username: "!JoXhu",
    memberCount: "1,250",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
  });
  fs.writeFileSync(path.join(process.cwd(), "scratch", "test_welcome_formal.png"), buf);
  console.log("Formal welcome card rendered to scratch/test_welcome_formal.png");
}

runFormalTest().catch(console.error);
