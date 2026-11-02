/**
 * Foto delle figurine (giocatori e staff): ritaglio 4:5 come il riquadro della pagina Squadra,
 * qualunque sia la foto di partenza. Solo lato server (sharp).
 *
 * - foto più larga del riquadro (es. orizzontale 3:2): si tagliano i lati tenendo la persona,
 *   trovata con la strategia "attention" di sharp (pelle, contrasto, saturazione);
 * - foto più alta (es. verticale da telefono): si taglia sopra e sotto con il centro a un terzo
 *   dell'altezza, dove di solito sta il viso, invece che a metà (che taglierebbe la testa).
 */
import sharp from "sharp";

export const FIGURINA = { width: 900, height: 1125 } as const;
const RATIO = FIGURINA.width / FIGURINA.height;
/** Altezza (in frazione) del centro del ritaglio sulle foto verticali. */
const FACE_LINE = 0.36;

export async function toFigurina(input: Buffer | ArrayBuffer): Promise<Buffer> {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  // orientamento EXIF applicato prima di misurare
  const upright = await sharp(source).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  let img = sharp(upright.data);
  if (width / height > RATIO) {
    img = img.resize({ ...FIGURINA, fit: "cover", position: sharp.strategy.attention });
  } else {
    const cropH = Math.round(width / RATIO);
    const top = Math.min(height - cropH, Math.max(0, Math.round(height * FACE_LINE - cropH / 2)));
    img = img.extract({ left: 0, top, width, height: cropH }).resize({ ...FIGURINA, withoutEnlargement: true });
  }
  return img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}
