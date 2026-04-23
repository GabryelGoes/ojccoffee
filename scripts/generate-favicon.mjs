/**
 * Gera public/favicon.png a partir da logo: mantém o alpha e aplica o verde escuro do tema (#0E370C).
 */
import sharp from 'sharp';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

const COFFEE_DARK = { r: 14, g: 55, b: 12 }; // --color-coffee-dark

const { data, info } = await sharp(resolve(root, 'public/logo-jccoffee.png'))
  .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const out = Buffer.from(data);
for (let i = 0; i < out.length; i += 4) {
  const a = out[i + 3];
  if (a === 0) continue;
  out[i] = COFFEE_DARK.r;
  out[i + 1] = COFFEE_DARK.g;
  out[i + 2] = COFFEE_DARK.b;
}

await sharp(out, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  },
})
  .png()
  .toFile(resolve(root, 'public/favicon.png'));

console.log(`OK: public/favicon.png (${info.width}x${info.height})`);
