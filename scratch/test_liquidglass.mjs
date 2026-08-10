import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

/**
 * Simula distorsión de "Liquid Glass" / refracción de lente convexo
 * Muestrea píxeles del fondo desplazados radialmente desde el centro
 * para crear el efecto de que el vidrio dobla la luz detrás de él.
 */
function applyGlassDistortion(
  ctx,
  bgImageData,
  shape,
  type // "rect" | "circle"
) {
  const { width, height } = bgImageData;
  const src = bgImageData.data;

  // Crear canvas temporal para la región de vidrio
  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext("2d");
  const out = tempCtx.createImageData(width, height);
  const dst = out.data;

  // Copiar fondo original primero
  for (let i = 0; i < src.length; i++) dst[i] = src[i];

  const strength = type === "circle" ? 18 : 12; // px de desplazamiento máximo

  let cx, cy, rx, ry, x0, y0, x1, y1, r;
  if (type === "circle") {
    cx = shape.cx; cy = shape.cy; r = shape.r;
    x0 = Math.max(0, Math.floor(cx - r - 2));
    y0 = Math.max(0, Math.floor(cy - r - 2));
    x1 = Math.min(width - 1, Math.ceil(cx + r + 2));
    y1 = Math.min(height - 1, Math.ceil(cy + r + 2));
  } else {
    x0 = Math.max(0, Math.floor(shape.x));
    y0 = Math.max(0, Math.floor(shape.y));
    x1 = Math.min(width - 1, Math.ceil(shape.x + shape.w));
    y1 = Math.min(height - 1, Math.ceil(shape.y + shape.h));
    cx = shape.x + shape.w / 2;
    cy = shape.y + shape.h / 2;
    rx = shape.w / 2;
    ry = shape.h / 2;
  }

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      let inside = false;
      let t = 0; // normalizado 0..1 desde borde al centro

      if (type === "circle") {
        const ddx = px - cx, ddy = py - cy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist > r) continue;
        inside = true;
        t = 1 - dist / r; // 0 en borde, 1 en centro
      } else {
        const ddx = (px - cx) / rx, ddy = (py - cy) / ry;
        const ellipseDist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (ellipseDist > 1) continue;
        inside = true;
        t = 1 - ellipseDist; // 0 en borde, 1 en centro
      }

      if (!inside) continue;

      // Desplazamiento de refracción — empuja píxeles hacia afuera del centro (lente convexo)
      const ddx = px - cx, ddy = py - cy;
      const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const nx = ddx / len, ny = ddy / len;

      // Curva de refracción: más fuerte cerca del borde (lente edge-refraction)
      const refractStrength = strength * Math.sin(t * Math.PI * 0.9);
      const srcX = Math.round(px + nx * refractStrength);
      const srcY = Math.round(py + ny * refractStrength);

      const clampX = Math.max(0, Math.min(width - 1, srcX));
      const clampY = Math.max(0, Math.min(height - 1, srcY));

      const srcIdx = (clampY * width + clampX) * 4;
      const dstIdx = (py * width + px) * 4;

      // Ligeramente más brillante y fría (simula refracción de vidrio)
      dst[dstIdx + 0] = Math.min(255, src[srcIdx + 0] * 1.08 + 8);
      dst[dstIdx + 1] = Math.min(255, src[srcIdx + 1] * 1.08 + 8);
      dst[dstIdx + 2] = Math.min(255, src[srcIdx + 2] * 1.12 + 12);
      dst[dstIdx + 3] = 255;
    }
  }

  return { tempCanvas, out };
}

/** Dibuja rectángulo redondeado */
function roundedRect(ctx, x, y, w, h, r) {
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

async function renderLiquidGlassWelcome({ username, memberCount, avatarUrl }) {
  const width = 1024;
  const height = 576;

  // ── PASO 1: Renderizar fondo en canvas separado ──────────────────────────────
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

  // Obtener píxeles del fondo para distorsión
  const bgImageData = bgCtx.getImageData(0, 0, width, height);

  // ── PASO 2: Canvas principal ─────────────────────────────────────────────────
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Dibujar fondo base
  ctx.drawImage(bgCanvas, 0, 0);

  // Viñeta cinematográfica
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 180, width / 2, height / 2, 590);
  vignette.addColorStop(0, "rgba(0,0,0,0.1)");
  vignette.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // ── PASO 3: Distorsión Liquid Glass en el Panel de Texto ─────────────────────
  const cardX = 48, cardY = 158, cardW = 590, cardH = 258, cardR = 52;

  // Aplicar distorsión al área del panel
  const { tempCanvas: panelCanvas, out: panelData } = applyGlassDistortion(
    ctx, bgImageData,
    { x: cardX, y: cardY, w: cardW, h: cardH },
    "rect"
  );
  const panelCtx = panelCanvas.getContext("2d");
  panelCtx.putImageData(panelData, 0, 0);

  // Recortar y dibujar solo la región distorsionada del panel
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.clip();
  ctx.drawImage(panelCanvas, 0, 0);
  ctx.restore();

  // ── Capa de Vidrio sobre el Panel (Liquid Glass iOS style) ───────────────────
  // Tinte translucido — muy tenue, blanco-azulado como el Liquid Glass de Apple
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = "rgba(210, 220, 255, 0.10)";
  ctx.fill();
  ctx.restore();

  // Reflejo especular interno superior (luz entrando por arriba) — gradiente blanco
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.clip();
  const innerHighlight = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH * 0.55);
  innerHighlight.addColorStop(0, "rgba(255,255,255,0.22)");
  innerHighlight.addColorStop(0.4, "rgba(255,255,255,0.06)");
  innerHighlight.addColorStop(1, "rgba(255,255,255,0.00)");
  ctx.fillStyle = innerHighlight;
  ctx.fill();
  ctx.restore();

  // Borde exterior Liquid Glass — línea fina luminosa degradada
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const panelBorder = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  panelBorder.addColorStop(0, "rgba(255,255,255,0.75)");
  panelBorder.addColorStop(0.35, "rgba(255,255,255,0.25)");
  panelBorder.addColorStop(0.65, "rgba(255,255,255,0.10)");
  panelBorder.addColorStop(1, "rgba(255,255,255,0.55)");
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = panelBorder;
  ctx.stroke();
  ctx.restore();

  // ── PASO 4: Badge "SONORA RP · BIENVENIDA" ───────────────────────────────────
  const bx = cardX + 30, by = cardY + 30, bw = 255, bh = 32, br = 16;
  ctx.save();
  roundedRect(ctx, bx, by, bw, bh, br);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.40)";
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.fillText("SONORA RP  ·  BIENVENIDA", bx + bw / 2, by + 21);
  ctx.restore();

  // ── PASO 5: Textos en el Panel ───────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;

  let displayName = username.length > 21 ? username.slice(0, 19) + "…" : username;

  // Nombre usuario
  ctx.font = "bold 42px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(displayName, cardX + 30, cardY + 130);

  // "Es el miembro #XXX"
  const formattedCount = typeof memberCount === "number"
    ? memberCount.toLocaleString("es-MX") : memberCount;

  ctx.font = "600 25px sans-serif";
  ctx.fillStyle = "rgba(220,225,240,0.95)";
  ctx.fillText("Es el miembro ", cardX + 30, cardY + 188);

  const prefW = ctx.measureText("Es el miembro ").width;
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = "#F5D269"; // Dorado suave
  ctx.fillText(`#${formattedCount}`, cardX + 30 + prefW, cardY + 188);

  ctx.restore();

  // ── PASO 6: Distorsión Liquid Glass en el Círculo del Avatar ─────────────────
  // Círculo más grande, avatar más chico adentro para que se vea el borde
  const avX = 808, avY = height / 2, avR = 128;
  const avAvatarR = avR * 0.80; // Avatar ocupa solo el 80% del radio → borde visible

  const { tempCanvas: circCanvas, out: circData } = applyGlassDistortion(
    ctx, bgImageData,
    { cx: avX, cy: avY, r: avR },
    "circle"
  );
  const circCtx = circCanvas.getContext("2d");
  circCtx.putImageData(circData, 0, 0);

  // Recortar y dibujar región circular distorsionada (el fondo refractado llena el círculo completo)
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(circCanvas, 0, 0);
  ctx.restore();

  // ── PASO 7: Avatar del usuario centrado, más chico ───────────────────────────
  let avatarImg;
  try {
    avatarImg = await loadImage(avatarUrl);
  } catch {
    const fb = createCanvas(256, 256);
    const fc = fb.getContext("2d");
    fc.fillStyle = "#3498db";
    fc.fillRect(0, 0, 256, 256);
    avatarImg = await loadImage(fb.toBuffer("image/png"));
  }

  // Avatar recortado en círculo más chico → el borde glass queda visible alrededor
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avAvatarR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImg, avX - avAvatarR, avY - avAvatarR, avAvatarR * 2, avAvatarR * 2);
  ctx.restore();

  // Tinte Glass muy sutil sobre el avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avAvatarR, 0, Math.PI * 2);
  ctx.clip();
  const avatarGlass = ctx.createLinearGradient(avX - avAvatarR, avY - avAvatarR, avX + avAvatarR, avY + avAvatarR);
  avatarGlass.addColorStop(0, "rgba(255,255,255,0.07)");
  avatarGlass.addColorStop(0.5, "rgba(255,255,255,0.00)");
  avatarGlass.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = avatarGlass;
  ctx.fillRect(avX - avAvatarR, avY - avAvatarR, avAvatarR * 2, avAvatarR * 2);
  ctx.restore();

  // Borde del círculo glass (UNO solo, sobre el borde real del círculo grande)
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  const circleBorder = ctx.createLinearGradient(avX - avR, avY - avR, avX + avR, avY + avR);
  circleBorder.addColorStop(0,   "rgba(255,255,255,0.95)");
  circleBorder.addColorStop(0.3, "rgba(255,255,255,0.45)");
  circleBorder.addColorStop(0.6, "rgba(255,255,255,0.10)");
  circleBorder.addColorStop(1,   "rgba(255,255,255,0.65)");
  ctx.lineWidth = 3;
  ctx.strokeStyle = circleBorder;
  ctx.stroke();
  ctx.restore();

  // Reflejo especular arco superior (luz entrando por arriba como cristal curvo)
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY - 4, avR - 5, Math.PI * 1.15, Math.PI * 1.85);
  ctx.lineWidth = 4;
  const specular = ctx.createLinearGradient(avX - avR * 0.55, avY - avR, avX + avR * 0.55, avY - avR * 0.5);
  specular.addColorStop(0,   "rgba(255,255,255,0.00)");
  specular.addColorStop(0.3, "rgba(255,255,255,0.80)");
  specular.addColorStop(0.7, "rgba(255,255,255,0.80)");
  specular.addColorStop(1,   "rgba(255,255,255,0.00)");
  ctx.strokeStyle = specular;
  ctx.stroke();
  ctx.restore();

  return canvas.toBuffer("image/png");
}

// Probar
async function runTest() {
  const buf = await renderLiquidGlassWelcome({
    username: "!JoXhu",
    memberCount: "1,250",
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
  });
  fs.writeFileSync(path.join(process.cwd(), "scratch", "test_liquidglass.png"), buf);
  console.log("Liquid glass welcome rendered → scratch/test_liquidglass.png");
}

runTest().catch(console.error);
