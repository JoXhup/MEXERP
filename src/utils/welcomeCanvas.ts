import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

export interface RenderWelcomeOptions {
  username: string;
  memberCount: number | string;
  avatarUrl: string;
}

function roundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renderiza la tarjeta de bienvenida oficial de Sonora RP con diseño Liquid Glass refinado.
 */
export async function renderWelcomeCard(options: RenderWelcomeOptions): Promise<Buffer> {
  const width = 1024;
  const height = 576;

  // 1. Cargar fondo en canvas separado
  const bgCanvas = createCanvas(width, height);
  const bgCtx = bgCanvas.getContext("2d");

  const bgPath = path.join(process.cwd(), "assets", "BienvenidasSinaloaRP.png");
  if (fs.existsSync(bgPath)) {
    const bgImage = await loadImage(bgPath);
    bgCtx.drawImage(bgImage, 0, 0, width, height);
  } else {
    bgCtx.fillStyle = "#0c0d1a";
    bgCtx.fillRect(0, 0, width, height);
  }

  // 2. Canvas Principal
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(bgCanvas, 0, 0);

  // Viñeta cinematográfica sutil
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 180, width / 2, height / 2, 590);
  vignette.addColorStop(0, "rgba(0,0,0,0.08)");
  vignette.addColorStop(1, "rgba(0,0,0,0.70)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 3. Panel de Texto de Información (Blanco semi-transparente 0.10 sin distorsión)
  const cardX = 48, cardY = 158, cardW = 590, cardH = 258, cardR = 52;

  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();
  ctx.restore();

  // Reflejo superior de luz en el panel
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.clip();
  const glowTop = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  glowTop.addColorStop(0.00, "rgba(255,255,255,0.25)");
  glowTop.addColorStop(0.20, "rgba(255,255,255,0.08)");
  glowTop.addColorStop(1.00, "rgba(255,255,255,0.00)");
  ctx.fillStyle = glowTop;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  // Borde luminoso top -> bottom
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const panelBorder = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  panelBorder.addColorStop(0.00, "rgba(255,255,255,0.85)");
  panelBorder.addColorStop(0.12, "rgba(255,255,255,0.50)");
  panelBorder.addColorStop(0.55, "rgba(255,255,255,0.15)");
  panelBorder.addColorStop(1.00, "rgba(255,255,255,0.08)");
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = panelBorder;
  ctx.stroke();
  ctx.restore();

  // Badge pill
  const bx = cardX + 30, by = cardY + 30, bw = 258, bh = 32, br = 16;
  ctx.save();
  roundedRect(ctx, bx, by, bw, bh, br);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fillText("SONORA RP  ·  BIENVENIDA", bx + bw / 2, by + 21);
  ctx.restore();

  // Textos del Panel
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  const displayName = options.username.length > 21
    ? options.username.slice(0, 19) + "…"
    : options.username;

  ctx.font = "bold 42px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(displayName, cardX + 30, cardY + 130);

  const formatted = typeof options.memberCount === "number"
    ? options.memberCount.toLocaleString("es-MX")
    : options.memberCount;

  ctx.font = "600 25px sans-serif";
  ctx.fillStyle = "rgba(220,228,245,0.95)";
  ctx.fillText("Es el miembro ", cardX + 30, cardY + 188);

  const prefW = ctx.measureText("Es el miembro ").width;
  ctx.font = "bold 27px sans-serif";
  ctx.fillStyle = "#F5D269";
  ctx.fillText(`#${formatted}`, cardX + 30 + prefW, cardY + 188);
  ctx.restore();

  // 4. Círculo del Avatar (Liquid Glass Ampliado)
  const avX = 820, avY = height / 2, avR = 140;
  const avAvatarR = Math.round(avR * 0.84); // Avatar grande 84%

  // Fondo recortado en círculo
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.restore();

  // Frosted glass rim oscuro degradado suavemente desde adentro
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  const circBase = ctx.createRadialGradient(avX, avY, avAvatarR * 0.55, avX, avY, avR);
  circBase.addColorStop(0,    "rgba(10, 14, 30, 0.00)");
  circBase.addColorStop(0.42, "rgba(10, 14, 30, 0.00)");
  circBase.addColorStop(0.72, "rgba(12, 18, 40, 0.45)");
  circBase.addColorStop(1,    "rgba(20, 30, 60, 0.78)");
  ctx.fillStyle = circBase;
  ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  ctx.restore();

  // Brillo azul-blanco translucido rim exterior
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  const rimGlass = ctx.createRadialGradient(avX, avY, avAvatarR * 0.55, avX, avY, avR);
  rimGlass.addColorStop(0,    "rgba(200, 215, 255, 0.00)");
  rimGlass.addColorStop(0.70, "rgba(200, 215, 255, 0.00)");
  rimGlass.addColorStop(0.88, "rgba(220, 235, 255, 0.20)");
  rimGlass.addColorStop(1,    "rgba(255, 255, 255, 0.14)");
  ctx.fillStyle = rimGlass;
  ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  ctx.restore();

  // Avatar centrado
  let avatarImg: any;
  try {
    avatarImg = await loadImage(options.avatarUrl);
  } catch {
    const fb = createCanvas(256, 256);
    const fc = fb.getContext("2d");
    fc.fillStyle = "#3498db";
    fc.fillRect(0, 0, 256, 256);
    avatarImg = await loadImage(fb.toBuffer("image/png"));
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avAvatarR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImg, avX - avAvatarR, avY - avAvatarR, avAvatarR * 2, avAvatarR * 2);
  ctx.restore();

  // Brillo superior dentro del círculo
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  const circHighlight = ctx.createLinearGradient(avX, avY - avR, avX, avY - avR * 0.2);
  circHighlight.addColorStop(0.00, "rgba(255,255,255,0.32)");
  circHighlight.addColorStop(0.60, "rgba(255,255,255,0.08)");
  circHighlight.addColorStop(1.00, "rgba(255,255,255,0.00)");
  ctx.fillStyle = circHighlight;
  ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  ctx.restore();

  // Borde único top-brillante -> bottom-tenue
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  const circleBorder = ctx.createLinearGradient(avX, avY - avR, avX, avY + avR);
  circleBorder.addColorStop(0.00, "rgba(255,255,255,0.95)");
  circleBorder.addColorStop(0.20, "rgba(255,255,255,0.55)");
  circleBorder.addColorStop(0.55, "rgba(255,255,255,0.18)");
  circleBorder.addColorStop(1.00, "rgba(255,255,255,0.06)");
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = circleBorder;
  ctx.stroke();
  ctx.restore();

  // Reflejo especular cristal curvo
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY - 3, avR - 5, Math.PI * 1.12, Math.PI * 1.88);
  ctx.lineWidth = 5;
  const specular = ctx.createLinearGradient(avX - avR * 0.5, avY - avR, avX + avR * 0.5, avY - avR * 0.55);
  specular.addColorStop(0,    "rgba(255,255,255,0.00)");
  specular.addColorStop(0.25, "rgba(255,255,255,0.88)");
  specular.addColorStop(0.75, "rgba(255,255,255,0.88)");
  specular.addColorStop(1,    "rgba(255,255,255,0.00)");
  ctx.strokeStyle = specular;
  ctx.stroke();
  ctx.restore();

  return canvas.toBuffer("image/png");
}
