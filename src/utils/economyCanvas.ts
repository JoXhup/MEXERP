import { createCanvas, loadImage } from "@napi-rs/canvas";

export interface EconomyCardData {
  username: string;
  avatarUrl: string;
  money: number;
  bank: number;
  total: number;
  blackMoney: number;
  recentTx: Array<{
    type: string;
    amount: number;
    createdAt: Date;
  }>;
}

/** Formatea números como moneda MXN (ej: $25,000 MXN) */
export function formatCurrency(val: number): string {
  return `$${val.toLocaleString("es-MX")} MXN`;
}

/** Formatea números abreviados (ej: $25k, $1.5M) */
export function formatShortCurrency(val: number): string {
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`;
  }
  if (val >= 1_000) {
    return `$${(val / 1_000).toFixed(0)}k`;
  }
  return `$${val}`;
}

/** Genera la infografía y gráfica canvas de Estado Monetario */
export async function renderEconomyCard(data: EconomyCardData): Promise<Buffer> {
  const width = 850;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Fondo principal con degradado elegante
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#0b0e14");
  bgGrad.addColorStop(0.5, "#121824");
  bgGrad.addColorStop(1, "#0a0c10");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Patrón decorativo de rejilla sutil
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // 2. Encabezado
  // Cargar Avatar
  let avatarImg;
  try {
    avatarImg = await loadImage(data.avatarUrl);
  } catch {
    avatarImg = null;
  }

  // Dibujar Avatar circular
  const avatarX = 40;
  const avatarY = 35;
  const avatarRadius = 32;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
  } else {
    ctx.fillStyle = "#2c3e50";
    ctx.fillRect(avatarX, avatarY, avatarRadius * 2, avatarRadius * 2);
  }
  ctx.restore();

  // Borde neón al avatar
  ctx.beginPath();
  ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "#00f2fe";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Texto del Encabezado
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("ESTADO MONETARIO", avatarX + avatarRadius * 2 + 18, avatarY + 26);

  ctx.fillStyle = "#4facfe";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(`SONORA RP · @${data.username}`, avatarX + avatarRadius * 2 + 18, avatarY + 48);

  // Insignia Oficial
  const badgeText = "ESTADO OFICIAL";
  ctx.font = "bold 11px sans-serif";
  const badgeWidth = ctx.measureText(badgeText).width + 20;
  const badgeX = width - badgeWidth - 40;
  const badgeY = avatarY + 12;

  ctx.fillStyle = "rgba(0, 242, 254, 0.15)";
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, 26, 13);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 242, 254, 0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#00f2fe";
  ctx.fillText(badgeText, badgeX + 10, badgeY + 17);

  // 3. Tarjetas de Saldos (4 columnas)
  const cardY = 120;
  const cardWidth = 175;
  const cardHeight = 90;
  const cardGap = 16;
  const startX = 40;

  const stats = [
    { label: "EFECTIVO", val: data.money, icon: "💵", color: "#2ecc71", bgGrad: ["rgba(46, 204, 113, 0.12)", "rgba(46, 204, 113, 0.02)"] },
    { label: "BANCO", val: data.bank, icon: "🏦", color: "#3498db", bgGrad: ["rgba(52, 152, 219, 0.12)", "rgba(52, 152, 219, 0.02)"] },
    { label: "MONEY TOTAL", val: data.total, icon: "💰", color: "#f1c40f", bgGrad: ["rgba(241, 196, 15, 0.12)", "rgba(241, 196, 15, 0.02)"] },
    { label: "BLACK MONEY", val: data.blackMoney, icon: "🕶️", color: "#e74c3c", bgGrad: ["rgba(231, 76, 60, 0.12)", "rgba(231, 76, 60, 0.02)"] },
  ];

  stats.forEach((s, idx) => {
    const x = startX + idx * (cardWidth + cardGap);

    // Fondo tarjeta
    const cGrad = ctx.createLinearGradient(x, cardY, x, cardY + cardHeight);
    cGrad.addColorStop(0, s.bgGrad[0]);
    cGrad.addColorStop(1, s.bgGrad[1]);
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.roundRect(x, cardY, cardWidth, cardHeight, 10);
    ctx.fill();

    // Borde
    ctx.strokeStyle = s.color + "44";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Barra superior neón
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.roundRect(x + 10, cardY, cardWidth - 20, 3, 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "#8b949e";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(s.label, x + 14, cardY + 28);

    // Valor
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    const valText = `$${s.val.toLocaleString("es-MX")}`;
    // Ajustar font size si es muy largo
    if (valText.length > 13) {
      ctx.font = "bold 13px sans-serif";
    }
    ctx.fillText(valText, x + 14, cardY + 56);

    // Subetiqueta "MXN"
    ctx.fillStyle = s.color;
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("MXN", x + 14, cardY + 74);
  });

  // 4. Sección de la Gráfica de Actividad Financiera
  const chartX = 40;
  const chartY = 240;
  const chartWidth = 770;
  const chartHeight = 230;

  // Fondo contenedor de gráfica
  const chartBoxGrad = ctx.createLinearGradient(chartX, chartY, chartX, chartY + chartHeight);
  chartBoxGrad.addColorStop(0, "rgba(22, 27, 34, 0.8)");
  chartBoxGrad.addColorStop(1, "rgba(13, 17, 23, 0.9)");
  ctx.fillStyle = chartBoxGrad;
  ctx.beginPath();
  ctx.roundRect(chartX, chartY, chartWidth, chartHeight, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Título de la Gráfica
  ctx.fillStyle = "#c9d1d9";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("📊 ACTIVIDAD FINANCIERA RECIENTE", chartX + 20, chartY + 30);

  // Leyenda de colores
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(chartX + 540, chartY + 26, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8b949e";
  ctx.font = "11px sans-serif";
  ctx.fillText("Ingresos", chartX + 550, chartY + 30);

  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(chartX + 630, chartY + 26, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8b949e";
  ctx.font = "11px sans-serif";
  ctx.fillText("Gastos / Transf.", chartX + 640, chartY + 30);

  // Dibujar ejes de la gráfica
  const plotX = chartX + 50;
  const plotY = chartY + 55;
  const plotW = chartWidth - 70;
  const plotH = chartHeight - 85;

  // Líneas de cuadrícula horizontales
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = plotY + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();
  }

  // Si hay datos recientes, procesar gráfica
  const points = data.recentTx.length > 0
    ? data.recentTx.slice(0, 7).reverse()
    : [
        { type: "cobro", amount: Math.round(data.total * 0.3), createdAt: new Date() },
        { type: "deposito", amount: Math.round(data.total * 0.5), createdAt: new Date() },
        { type: "retiro", amount: Math.round(data.total * 0.2), createdAt: new Date() },
        { type: "saldo_actual", amount: data.total, createdAt: new Date() },
      ];

  const maxVal = Math.max(...points.map((p) => p.amount), 10000);
  const minVal = 0;

  // Coordenadas de los puntos
  const coords: Array<{ x: number; y: number; isIncome: boolean; amount: number }> = points.map((p, idx) => {
    const x = plotX + (plotW / Math.max(points.length - 1, 1)) * idx;
    const normY = (p.amount - minVal) / (maxVal - minVal);
    const y = plotY + plotH - normY * plotH;
    const isIncome = ["cobro", "transferencia_recibida", "admin_add"].includes(p.type);
    return { x, y, isIncome, amount: p.amount };
  });

  // Área sombreada debajo de la curva (Gradiente Verde/Azul)
  if (coords.length > 1) {
    const fillGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
    fillGrad.addColorStop(0, "rgba(46, 204, 113, 0.25)");
    fillGrad.addColorStop(1, "rgba(46, 204, 113, 0.0)");

    ctx.beginPath();
    ctx.moveTo(coords[0].x, plotY + plotH);
    coords.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, plotY + plotH);
    ctx.closePath();
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Línea principal de tendencia
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    coords.forEach((pt) => ctx.lineTo(pt.x, pt.y));
    ctx.strokeStyle = "#2ecc71";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Puntos individuales con glow
  coords.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = pt.isIncome ? "#2ecc71" : "#e74c3c";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Etiqueta de valor sobre el punto
    ctx.fillStyle = "#8b949e";
    ctx.font = "bold 10px sans-serif";
    const lbl = formatShortCurrency(pt.amount);
    ctx.fillText(lbl, pt.x - ctx.measureText(lbl).width / 2, pt.y - 10);
  });

  // 5. Pie de página
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.font = "11px sans-serif";
  ctx.fillText("Sonora RP System · Economía Oficial", 40, height - 15);

  const dateStr = new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  ctx.fillText(`Actualizado: ${dateStr}`, width - 180, height - 15);

  return canvas.toBuffer("image/png");
}
