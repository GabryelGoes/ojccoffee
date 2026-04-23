/**
 * Gera public/favicon.png a partir da logo: mantém o alpha, aplica #0E370C,
 * trim, canvas 512px e margem interna para a arte não “estourar” na aba.
 */
import sharp from 'sharp';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const COFFEE_DARK = { r: 14, g: 55, b: 12 }; // --color-coffee-dark
const OUT = 512;
/** Quanto da caixa o desenho pode ocupar (margem ao redor ≈ metade de 1 − INSET_SCALE). */
const INSET_SCALE = 0.68;

const srcPath = resolve(root, 'public/logo-jccoffee.png');

const trimmed = await sharp(srcPath).trim({ threshold: 2 }).toBuffer();

const maxInner = Math.floor(OUT * INSET_SCALE);

const inner = await sharp(trimmed)
  .resize(maxInner, maxInner, {
    fit: 'inside',
    withoutEnlargement: false,
  })
  .ensureAlpha()
  .png()
  .toBuffer();

const { data, info } = await sharp({
  create: {
    width: OUT,
    height: OUT,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: inner, gravity: 'centre' }])
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const outBuf = Buffer.from(data);
for (let i = 0; i < outBuf.length; i += 4) {
  const a = outBuf[i + 3];
  if (a === 0) continue;
  outBuf[i] = COFFEE_DARK.r;
  outBuf[i + 1] = COFFEE_DARK.g;
  outBuf[i + 2] = COFFEE_DARK.b;
}

await sharp(outBuf, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
})
  .png()
  .toFile(resolve(root, 'public/favicon.png'));

console.log(`OK: public/favicon.png (${info.width}x${info.height}), inset ~${Math.round((1 - INSET_SCALE) * 50)}% margem`);
