import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

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

function applyAppleGlassDistortion(bgData, shape, type) {
  const { width, height } = bgData;
  const src = bgData.data;
  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext("2d");
  const out = tempCtx.createImageData(width, height);
  const dst = out.data;
  for (let i = 0; i < src.length; i++) dst[i] = src[i];

  const edgeStrength = type === "circle" ? 30 : 22;
  const centerZoom  = type === "circle" ? 0.06 : 0.04;

  let cx, cy, rx, ry, x0, y0, x1, y1, r;
  if (type === "circle") {
    cx = shape.cx; cy = shape.cy; r = shape.r;
    x0 = Math.max(0, Math.floor(cx - r - 2));
    y0 = Math.max(0, Math.floor(cy - r - 2));
    x1 = Math.min(width - 1, Math.ceil(cx + r + 2));
    y1 = Math.min(height - 1, Math.ceil(cy + r + 2));
    rx = r; ry = r;
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
      let normalizedDist;
      if (type === "circle") {
        const ddx = px - cx, ddy = py - cy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist > r) continue;
        normalizedDist = 1 - dist / r;
      } else {
        const ndx = (px - cx) / rx, ndy = (py - cy) / ry;
        const eDist = Math.sqrt(ndx * ndx + ndy * ndy);
        if (eDist > 1) continue;
        normalizedDist = 1 - eDist;
      }

      const ddx = px - cx, ddy = py - cy;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const nx = ddx / dist, ny = ddy / dist;

      const edgeZone   = Math.max(0, 1 - normalizedDist * 2.5);
      const centerZone = Math.max(0, normalizedDist - 0.6) / 0.4;
      const inwardShift  = edgeStrength * Math.pow(edgeZone, 1.5);
      const outwardShift = dist * centerZoom * centerZone;
      const shiftX = -nx * inwardShift + nx * outwardShift;
      const shiftY = -ny * inwardShift + ny * outwardShift;

      const srcX = Math.round(px + shiftX);
      const srcY = Math.round(py + shiftY);
      const clampX = Math.max(0, Math.min(width - 1, srcX));
      const clampY = Math.max(0, Math.min(height - 1, srcY));

      const srcIdx = (clampY * width + clampX) * 4;
      const dstIdx = (py * width + px) * 4;
      const brightBoost = 1 + edgeZone * 0.25;
      dst[dstIdx + 0] = Math.min(255, src[srcIdx + 0] * brightBoost + edgeZone * 15);
      dst[dstIdx + 1] = Math.min(255, src[srcIdx + 1] * brightBoost + edgeZone * 15);
      dst[dstIdx + 2] = Math.min(255, src[srcIdx + 2] * brightBoost + edgeZone * 22);
      dst[dstIdx + 3] = 255;
    }
  }
  return { tempCanvas, out };
}

async function renderLiquidGlassV3({ username, memberCount, avatarUrl }) {
  const width = 1024, height = 576;

  // ── Fondo en canvas separado ──
  const bgCanvas = createCanvas(width, height);
  const bgCtx = bgCanvas.getContext("2d");
  const bgPath = path.join(process.cwd(), "assets", "BienvenidasSonoraRP.png");
  if (fs.existsSync(bgPath)) {
    const bgImg = await loadImage(bgPath);
    // Recortar la máscara de óvalo negra exterior tomando el área central útil (16:9 limpia)
    const cropX = Math.round(bgImg.width * 0.11);
    const cropY = Math.round(bgImg.height * 0.08);
    const cropW = Math.round(bgImg.width * 0.78);
    const cropH = Math.round(bgImg.height * 0.84);
    bgCtx.drawImage(bgImg, cropX, cropY, cropW, cropH, 0, 0, width, height);
  } else {
    bgCtx.fillStyle = "#0c0d1a";
    bgCtx.fillRect(0, 0, width, height);
  }
  const bgImageData = bgCtx.getImageData(0, 0, width, height);

  // ── Canvas principal ──
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bgCanvas, 0, 0);

  // Viñeta
  const vignette = ctx.createRadialGradient(width / 2, height / 2, 180, width / 2, height / 2, 590);
  vignette.addColorStop(0, "rgba(0,0,0,0.08)");
  vignette.addColorStop(1, "rgba(0,0,0,0.70)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // ════════════════════════════════
  // PANEL DE TEXTO — Liquid Glass
  // ════════════════════════════════
  const cardX = 48, cardY = 158, cardW = 590, cardH = 258, cardR = 52;

  // Panel de info — blanco casi transparente (0.10 opacidad = 0.9 transparencia)
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();
  ctx.restore();

  // Reflejo superior de luz
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.clip();
  const glowTop = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  glowTop.addColorStop(0.00, "rgba(255,255,255,0.30)");
  glowTop.addColorStop(0.18, "rgba(255,255,255,0.10)");
  glowTop.addColorStop(0.50, "rgba(255,255,255,0.02)");
  glowTop.addColorStop(1.00, "rgba(255,255,255,0.00)");
  ctx.fillStyle = glowTop;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  // Borde luminoso top→bottom
  ctx.save();
  roundedRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const panelBorder = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  panelBorder.addColorStop(0.00, "rgba(255,255,255,0.85)");
  panelBorder.addColorStop(0.10, "rgba(255,255,255,0.55)");
  panelBorder.addColorStop(0.50, "rgba(255,255,255,0.15)");
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
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fillText("SONORA RP  ·  BIENVENIDA", bx + bw / 2, by + 21);

  // Textos
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;
  const displayName = username.length > 21 ? username.slice(0, 19) + "…" : username;
  ctx.font = "bold 42px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(displayName, cardX + 30, cardY + 130);
  const formatted = typeof memberCount === "number" ? memberCount.toLocaleString("es-MX") : memberCount;
  ctx.font = "600 25px sans-serif";
  ctx.fillStyle = "rgba(220,228,245,0.95)";
  ctx.fillText("Es el miembro ", cardX + 30, cardY + 188);
  const prefW = ctx.measureText("Es el miembro ").width;
  ctx.font = "bold 27px sans-serif";
  ctx.fillStyle = "#F5D269";
  ctx.fillText(`#${formatted}`, cardX + 30 + prefW, cardY + 188);
  ctx.restore();

  // ════════════════════════════════
  // CÍRCULO DEL AVATAR — Liquid Glass limpio
  // ════════════════════════════════
  const avX = 820, avY = height / 2, avR = 140;
  const avAvatarR = Math.round(avR * 0.84); // Avatar 84% → más grande, borde glass visible pero menos

  // 1. Fondo normal recortado en círculo
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(bgCanvas, 0, 0);
  ctx.restore();

  // 2. Frosted glass rim oscuro — empieza antes del borde del avatar para que difumine suavemente
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();
  // Empezar en 0.55 del radio (bien adentro) para que el fade sea largo y no muestre línea
  const circBase = ctx.createRadialGradient(avX, avY, avAvatarR * 0.55, avX, avY, avR);
  circBase.addColorStop(0,    "rgba(10, 14, 30, 0.00)");
  circBase.addColorStop(0.42, "rgba(10, 14, 30, 0.00)");  // Transparente hasta el 42% del radio del rim
  circBase.addColorStop(0.72, "rgba(12, 18, 40, 0.45)");  // Empieza el oscuro suavemente
  circBase.addColorStop(1,    "rgba(20, 30, 60, 0.78)");  // Borde exterior oscuro
  ctx.fillStyle = circBase;
  ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  ctx.restore();

  // 3. Brillo translucido azul-blanco en el rim exterior
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

  // 4. Avatar centrado recortado en círculo más pequeño
  let avatarImg;
  try { avatarImg = await loadImage(avatarUrl); }
  catch {
    const fb = createCanvas(256, 256);
    const fc = fb.getContext("2d");
    fc.fillStyle = "#3498db"; fc.fillRect(0, 0, 256, 256);
    avatarImg = await loadImage(fb.toBuffer("image/png"));
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avAvatarR, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(avatarImg, avX - avAvatarR, avY - avAvatarR, avAvatarR * 2, avAvatarR * 2);
  ctx.restore();

  // 5. Brillo superior dentro del círculo (reflejo de luz por arriba)
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

  // 6. Borde único top-brillante → bottom-tenue
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

  // 7. Arco especular superior (reflejo curvo de cristal)
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

async function runTest() {
  const buf = await renderLiquidGlassV3({
    username: "joxhu",
    memberCount: 92,
    avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
  });
  fs.writeFileSync(path.join(process.cwd(), "scratch", "test_glass_v3.png"), buf);
  console.log("Liquid glass v3 → scratch/test_glass_v3.png");
}

runTest().catch(console.error);
