// Regenerates every brand image from apps/web/src/app/icon.svg.
// Usage: node scripts/generate-brand-assets.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const VIOLET = '#6C3BFF';
const svg = readFileSync('apps/web/src/app/icon.svg');
const mark = () => sharp(svg, { density: 1200 });

// The same drawing without its background tile, for places that supply their own.
const face = Buffer.from(svg.toString().replace(/<rect[^>]*\/>/, ''));

mkdirSync('apps/mobile/assets', { recursive: true });

await mark().resize(180, 180).png().toFile('apps/web/src/app/apple-icon.png');

// Stores require square icons with no transparency: the tile fills the whole image.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: VIOLET } })
  .composite([{ input: await sharp(face, { density: 1200 }).resize(1024, 1024).png().toBuffer() }])
  .flatten({ background: VIOLET })
  .png()
  .toFile('apps/mobile/assets/icon.png');

// Android masks adaptive icons, so the artwork stays inside the central safe zone.
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(face, { density: 1200 }).resize(640, 640).png().toBuffer(), gravity: 'center' }])
  .png()
  .toFile('apps/mobile/assets/adaptive-icon.png');

await sharp(face, { density: 1200 }).resize(512, 512).png().toFile('apps/mobile/assets/splash-icon.png');
await mark().resize(48, 48).png().toFile('apps/mobile/assets/favicon.png');

// Rendered in a browser because Thai text needs proper shaping.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(`<!doctype html><html lang="th"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@600;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; display: flex; align-items: center; gap: 56px; padding: 0 90px;
    box-sizing: border-box; font-family: Prompt, sans-serif; color: #fff;
    background: linear-gradient(135deg, #4A22C9, ${VIOLET}); }
  svg { width: 260px; height: 260px; flex: none; border-radius: 60px; box-shadow: 0 0 0 10px #FFD23F; }
  h1 { font-size: 92px; line-height: 1.05; margin: 0; letter-spacing: -2px; }
  h2 { font-size: 44px; margin: 6px 0 22px; color: #FFD23F; }
  p { font-size: 38px; margin: 0; }
</style></head><body>${svg}<div><h1>HONGMUNG</h1><h2>ห้องมึง</h2><p>ห้องใครก็หา ห้องเราก็เลือก</p></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: 'apps/web/src/app/opengraph-image.png' });
await browser.close();
console.info('brand assets written');
