// Draws the app icon and splash screen (EWX over a strip of hazard tape) at every size the Android and iPhone
// projects use, in the game's own font, by rendering in Chrome. Run after changing the design:
//   node scripts/make-icons.mjs
// It redraws each existing image at that image's own size, and adds the Android icon's background layer.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(app, 'android/app/src/main/res');
const ios = join(app, 'ios/App/App/Assets.xcassets');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// embedded, because a page set up in place can't load a font file from disk
const font = 'data:font/woff2;base64,' + readFileSync(join(app, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2')).toString('base64');

const INK = '#17181A', HI = '#FFC700';

// The design, on a 108-unit square: EWX in condensed heavy type, hazard tape along the bottom.
// stripe: the tape's stripe width in the same units.
const tape = (y, h, stripe) =>
  `<defs><pattern id="hz" width="${stripe * 2}" height="${stripe * 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
  `<rect width="${stripe * 2}" height="${stripe * 2}" fill="${INK}"/><rect width="${stripe}" height="${stripe * 2}" fill="${HI}"/></pattern></defs>` +
  `<rect x="0" y="${y}" width="108" height="${h}" fill="url(#hz)"/>`;
const letters = (baseline, size) =>
  `<text x="54" y="${baseline}" text-anchor="middle" font-size="${size}" style="font-family:'Archivo Sim';font-weight:900;font-stretch:62%" fill="${HI}">EWX</text>`;

const DESIGNS = {
  // the whole icon, as the iPhone and older Androids show it
  full: `<rect width="108" height="108" fill="${INK}"/>${letters(66, 44)}${tape(84, 24, 6)}`,
  // Android's adaptive layers are 108 across but only the middle 72 show, so the design is drawn into that middle;
  // the tape runs on into the edge so whatever shape the phone crops to, the tape meets the bottom.
  fg: letters(62, 29.3),
  bg: `<rect width="108" height="108" fill="${INK}"/>${tape(74, 34, 4)}`,
};

function svg(design, w, h, round) {
  const clip = round ? `<clipPath id="c"><circle cx="54" cy="54" r="54"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 108 108"><defs>${clip}</defs><g ${round ? 'clip-path="url(#c)"' : ''}>${DESIGNS[design]}</g></svg>`;
}

// The splash: the icon's lockup centred on black, sized to the shorter side so it survives any screen shape.
function splash(w, h) {
  const s = Math.min(w, h) * 0.32;
  return `<div style="width:${w}px;height:${h}px;background:${INK};display:flex;align-items:center;justify-content:center">` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 18 108 82">${letters(66, 44)}${tape(84, 14, 6)}</svg></div>`;
}

const page = (body) => `<!doctype html><html><head><style>
@font-face{font-family:'Archivo Sim';src:url('${font}') format('woff2');font-weight:100 900;font-stretch:62% 125%}
html,body{margin:0;background:transparent}svg{display:block}
</style></head><body>${body}</body></html>`;

/** The pixel size of a PNG, from its header. */
function pngSize(file) {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb'] });
const tab = await browser.newPage();

async function render(body, w, h, file, transparent = false) {
  await tab.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await tab.setContent(page(body), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  if (body.includes('EWX') && !(await tab.evaluate(() => document.fonts.check("900 44px 'Archivo Sim'") && [...document.fonts].some((f) => f.status === 'loaded')))) throw new Error('The Archivo font did not load.');
  const png = await tab.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(file, png);
}

let n = 0;
// Android launcher icons, each at its own size
for (const dir of readdirSync(res).filter((d) => d.startsWith('mipmap-') && !d.includes('anydpi'))) {
  for (const [name, design, round, clear] of [['ic_launcher.png', 'full', false, false], ['ic_launcher_round.png', 'full', true, true], ['ic_launcher_foreground.png', 'fg', false, true]]) {
    const f = join(res, dir, name);
    const { w, h } = pngSize(f);
    await render(svg(design, w, h, round), w, h, f, clear);
    n++;
  }
  // the background layer is new: the same size as the foreground
  const { w, h } = pngSize(join(res, dir, 'ic_launcher_foreground.png'));
  await render(svg('bg', w, h, false), w, h, join(res, dir, 'ic_launcher_background.png'));
  n++;
}
// Android splash screens, portrait and landscape
for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const f = join(res, dir, 'splash.png');
  try { statSync(f); } catch { continue; }
  const { w, h } = pngSize(f);
  await render(splash(w, h), w, h, f);
  n++;
}
// iPhone: one 1024 icon (no transparency allowed), and the splash
await render(svg('full', 1024, 1024, false), 1024, 1024, join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png'));
n++;
for (const f of readdirSync(join(ios, 'Splash.imageset')).filter((x) => x.endsWith('.png'))) {
  const p = join(ios, 'Splash.imageset', f), { w, h } = pngSize(p);
  await render(splash(w, h), w, h, p);
  n++;
}
// the web app's home-screen icons (iPhone's Add to Home Screen, and the web manifest)
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await render(svg('full', size, size, false), size, size, join(app, 'public', name));
  n++;
}
await browser.close();
console.log(`Drew ${n} images.`);
