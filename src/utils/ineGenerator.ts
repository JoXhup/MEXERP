import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

export const ESTADOS_MEXICO = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México (CDMX)",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
] as const;

export const CURP_ESTADO_MAP: Record<string, string> = {
  "Aguascalientes": "AS",
  "Baja California": "BC",
  "Baja California Sur": "BS",
  "Campeche": "CC",
  "Chiapas": "CS",
  "Chihuahua": "CH",
  "Ciudad de México (CDMX)": "DF",
  "Coahuila": "CL",
  "Colima": "CM",
  "Durango": "DG",
  "Estado de México": "MC",
  "Guanajuato": "GT",
  "Guerrero": "GR",
  "Jalisco": "JC",
  "Michoacán": "MN",
  "Morelos": "MS",
  "Nayarit": "NT",
  "Nuevo León": "NL",
  "Oaxaca": "OC",
  "Puebla": "PL",
  "Querétaro": "QT",
  "Quintana Roo": "QR",
  "San Luis Potosí": "SP",
  "Sinaloa": "SL",
  "Sonora": "SR",
};

export const NUM_ESTADO_MAP: Record<string, string> = {
  "Aguascalientes": "01",
  "Baja California": "02",
  "Baja California Sur": "03",
  "Campeche": "04",
  "Chiapas": "05",
  "Chihuahua": "06",
  "Ciudad de México (CDMX)": "09",
  "Coahuila": "07",
  "Colima": "08",
  "Durango": "10",
  "Estado de México": "15",
  "Guanajuato": "11",
  "Guerrero": "12",
  "Jalisco": "14",
  "Michoacán": "16",
  "Morelos": "17",
  "Nayarit": "18",
  "Nuevo León": "19",
  "Oaxaca": "20",
  "Puebla": "21",
  "Querétaro": "22",
  "Quintana Roo": "23",
  "San Luis Potosí": "24",
  "Sinaloa": "25",
  "Sonora": "26",
};

/** Separa un nombre completo en nombre, apellido paterno y materno */
export function splitFullName(fullName: string): {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    const apellidoMaterno = parts.pop()!;
    const apellidoPaterno = parts.pop()!;
    const nombre = parts.join(" ");
    return { nombre, apellidoPaterno, apellidoMaterno };
  } else if (parts.length === 2) {
    return { nombre: parts[0], apellidoPaterno: parts[1], apellidoMaterno: "X" };
  } else {
    return { nombre: parts[0] ?? "X", apellidoPaterno: "X", apellidoMaterno: "X" };
  }
}

/** Limpia texto removiendo acentos y caracteres especiales */
function removeAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "X");
}

/** Obtiene la primera vocal interna a partir del segundo carácter */
function getFirstVowelInternal(str: string): string {
  const vowels = ["A", "E", "I", "O", "U"];
  const clean = removeAccents(str);
  for (let i = 1; i < clean.length; i++) {
    if (vowels.includes(clean[i])) return clean[i];
  }
  return "X";
}

/** Obtiene la primera consonante interna a partir del segundo carácter */
function getFirstConsonantInternal(str: string): string {
  const vowels = ["A", "E", "I", "O", "U"];
  const clean = removeAccents(str);
  for (let i = 1; i < clean.length; i++) {
    if (!vowels.includes(clean[i]) && clean[i] >= "A" && clean[i] <= "Z") {
      return clean[i];
    }
  }
  return "X";
}

/** Genera una CURP ficticia estructurada en TypeScript */
export function generateCURP(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
  fechaNacimiento: string,
  sexo: "H" | "M",
  estado: string
): string {
  const pat = removeAccents(apellidoPaterno);
  const mat = removeAccents(apellidoMaterno);
  const nomParts = removeAccents(nombre).split(" ");

  let nomFirst = nomParts[0] || "X";
  if ((nomFirst === "JOSE" || nomFirst === "MARIA") && nomParts.length > 1) {
    nomFirst = nomParts[1];
  }

  // 1-4: Primeras letras
  const p1 = pat.charAt(0) || "X";
  const p2 = getFirstVowelInternal(pat);
  const p3 = mat.charAt(0) || "X";
  const p4 = nomFirst.charAt(0) || "X";

  // 5-10: Fecha YYMMDD
  const dateParts = fechaNacimiento.split(/[\/\.-]/);
  let yy = "00", mm = "01", dd = "01";
  if (dateParts.length === 3) {
    if (dateParts[0].length === 4) {
      yy = dateParts[0].slice(2);
      mm = dateParts[1].padStart(2, "0");
      dd = dateParts[2].padStart(2, "0");
    } else {
      dd = dateParts[0].padStart(2, "0");
      mm = dateParts[1].padStart(2, "0");
      yy = dateParts[2].slice(2);
    }
  }

  // 11: Sexo ('H' o 'M')
  const sexChar = sexo === "M" ? "M" : "H";

  // 12-13: Estado (Clave CURP de 2 letras)
  const estadoCode = CURP_ESTADO_MAP[estado] ?? "DF";

  // 14-16: Consonantes internas
  const c1 = getFirstConsonantInternal(pat);
  const c2 = getFirstConsonantInternal(mat);
  const c3 = getFirstConsonantInternal(nomFirst);

  // 17-18: 2 caracteres aleatorios únicos
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const r1 = chars.charAt(Math.floor(Math.random() * chars.length));
  const r2 = Math.floor(Math.random() * 10).toString();

  return `${p1}${p2}${p3}${p4}${yy}${mm}${dd}${sexChar}${estadoCode}${c1}${c2}${c3}${r1}${r2}`.toUpperCase();
}

/** Genera una Clave de Elector ficticia estructurada de 18 caracteres */
export function generateClaveElector(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
  fechaNacimiento: string,
  sexo: "H" | "M",
  estado: string,
  _anoRegistro: number = 2026
): string {
  const pat = removeAccents(apellidoPaterno);
  const mat = removeAccents(apellidoMaterno);
  const nom = removeAccents(nombre);

  // 1-6: 6 Letras (2 paterno, 2 materno, 2 nombre)
  const l1 = (pat.substring(0, 2) + "XX").substring(0, 2);
  const l2 = (mat.substring(0, 2) + "XX").substring(0, 2);
  const l3 = (nom.substring(0, 2) + "XX").substring(0, 2);

  // 7-12: Fecha YYMMDD
  const dateParts = fechaNacimiento.split(/[\/\.-]/);
  let yy = "00", mm = "01", dd = "01";
  if (dateParts.length === 3) {
    if (dateParts[0].length === 4) {
      yy = dateParts[0].slice(2);
      mm = dateParts[1].padStart(2, "0");
      dd = dateParts[2].padStart(2, "0");
    } else {
      dd = dateParts[0].padStart(2, "0");
      mm = dateParts[1].padStart(2, "0");
      yy = dateParts[2].slice(2);
    }
  }

  // 13-14: Estado (2 dígitos)
  const estNum = NUM_ESTADO_MAP[estado] ?? "09";

  // 15: Sexo
  const sexChar = sexo === "M" ? "M" : "H";

  // 16-18: 3 dígitos aleatorios
  const homoclave = Math.floor(100 + Math.random() * 900).toString();

  return `${l1}${l2}${l3}${yy}${mm}${dd}${estNum}${sexChar}${homoclave}`.toUpperCase();
}

export interface IneRenderOptions {
  nombre: string;
  domicilio: string;
  estado: string;
  fechaNacimiento: string;
  sexo: "HOMBRES" | "MUJERES" | "HOMBRE" | "MUJER" | "H" | "M";
  curp: string;
  claveElector: string;
  seccion: string;
  vigencia: string;
  anoRegistro?: string;
  avatarUrl?: string;
}

/** Renderiza la imagen de la INE sobre la plantilla INE TMRP.jpg con Canvas */
export async function renderIneImage(options: IneRenderOptions): Promise<Buffer> {
  const assetPath = path.join(process.cwd(), "src/utils/Assets/INE TMRP.jpg");
  let imageBuffer: Buffer;
  
  if (fs.existsSync(assetPath)) {
    imageBuffer = fs.readFileSync(assetPath);
  } else {
    // Fallback si no está en process.cwd()
    const altPath = path.resolve(__dirname, "./Assets/INE TMRP.jpg");
    imageBuffer = fs.readFileSync(altPath);
  }

  const bgImage = await loadImage(imageBuffer);
  const canvas = createCanvas(bgImage.width, bgImage.height);
  const ctx = canvas.getContext("2d");

  // Dibujar plantilla de fondo
  ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height);

  // Cargar y dibujar avatar de usuario si existe (Centrado en el recuadro blanco de la izquierda)
  if (options.avatarUrl) {
    try {
      const avatarRes = (await fetch(options.avatarUrl)) as any;
      if (avatarRes.ok) {
        const avatarArrayBuf = await avatarRes.arrayBuffer();
        const avatarImg = await loadImage(Buffer.from(avatarArrayBuf));
        ctx.drawImage(avatarImg, 75, 300, 390, 530);
      }
    } catch (err) {
      console.error("[INE] Error cargando avatar de usuario:", err);
    }
  }

  // Estilo de texto
  ctx.fillStyle = "#111111";

  // Normalizar sexo
  const sexChar = options.sexo.toUpperCase().startsWith("M") ? "M" : "H";
  const domicilioCompleto = `${options.domicilio.toUpperCase()}, ${options.estado.toUpperCase()}`;

  // 1. NOMBRE (Debajo del texto "NOMBRE", y=375)
  ctx.font = "bold 32px Arial";
  const nombreTxt = options.nombre.toUpperCase();
  if (ctx.measureText(nombreTxt).width > 700) {
    ctx.font = "bold 26px Arial";
  }
  ctx.fillText(nombreTxt, 550, 375);

  // 2. SEXO (Más a la derecha y un poco abajo, x=1440, y=355)
  ctx.font = "bold 36px Arial";
  ctx.fillText(sexChar, 1440, 355);

  // 3. DOMICILIO (Debajo del texto "DOMICILIO", y=545)
  ctx.font = "bold 24px Arial";
  if (ctx.measureText(domicilioCompleto).width > 700) {
    ctx.font = "bold 20px Arial";
  }
  ctx.fillText(domicilioCompleto, 550, 545);

  // 4. CLAVE DE ELECTOR
  ctx.font = "bold 32px Arial";
  ctx.fillText(options.claveElector.toUpperCase(), 550, 715);

  // 5. AÑO DE REGISTRO (Valor 2026, y=710)
  ctx.font = "bold 32px Arial";
  ctx.fillText(options.anoRegistro ?? "2026", 1220, 710);

  // 6. CURP
  ctx.font = "bold 32px Arial";
  ctx.fillText(options.curp.toUpperCase(), 550, 820);

  // 7. FECHA DE NACIMIENTO
  ctx.font = "bold 32px Arial";
  ctx.fillText(options.fechaNacimiento, 550, 925);

  // 8. SECCIÓN
  ctx.font = "bold 32px Arial";
  ctx.fillText(options.seccion, 1000, 925);

  // 9. VIGENCIA
  ctx.font = "bold 32px Arial";
  ctx.fillText(options.vigencia, 1220, 925);

  return canvas.toBuffer("image/png");
}
