/**
 * Gera public/favicon.png a partir da logo: mantém o alpha, aplica #0E370C,
 * remove bordas vazias (trim), zoom leve e canvas 512px (melhor na aba / retina).
 */
import sharp from 'sharp';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const COFFEE_DARK = { r: 14, g: 55, b: 12 }; // --color-coffee-dark
const OUT = 512;
const ZOOM = 1.14;

const srcPath = resolve(root, 'public/logo-jccoffee.png');

const trimmed = await sharp(srcPath).trim({ threshold: 2 }).toBuffer();
const meta = await sharp(trimmed).metadata();
if (!meta.width || !meta.height) throw new Error('Metadados inválidos após trim');

const zw = Math.round(meta.width * ZOOM);
const zh = Math.round(meta.height * ZOOM);

const enlarged = await sharp(trimmed)
  .resize(zw, zh, {
    fit: 'inside',
    withoutEnlargement: false,
  })
  .toBuffer();

const { data, info } = await sharp(enlarged)
  .resize(OUT, OUT, {
    fit: 'cover',
    position: 'centre',
  })
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

console.log(`OK: public/favicon.png (${info.width}x${info.height})`);
