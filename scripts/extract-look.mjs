// Copies the prototype's look into the app: its stylesheet, machine drawings and icons.
// Run again if the prototype's look changes: node scripts/extract-look.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const html = readFileSync(here('../../game-prototype/earthmoving-sim.html'), 'utf8').split('\r\n').join('\n');
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
writeFileSync(here('../app/src/prototype.css'), '/* Copied from the prototype by scripts/extract-look.mjs. Don\'t edit by hand. */\n' + css);

const block = (name) => {
  const a = html.indexOf('var ' + name + ' = {'), b = html.indexOf('\n};', a);
  if (a < 0 || b < 0) throw new Error('No ' + name + ' in the prototype');
  return html.slice(a + ('var ' + name + ' = ').length, b + 2);
};
const out = `// Copied from the prototype by scripts/extract-look.mjs. Don't edit by hand.
/* eslint-disable */
export const MACH_SVG: Record<string, string> = ${block('MACH_SVG')};
export const ICO: Record<string, string> = ${block('ICO')};
`;
writeFileSync(here('../app/src/icons.ts'), out);
console.log('Copied the stylesheet (' + css.length + ' chars) and icons.');
