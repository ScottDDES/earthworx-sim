// Loads the prototype game so tests can check the new engine gives the same answers.
// Set PROTOTYPE to point somewhere else; by default it's the copy beside this project.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PROTOTYPE_PATH =
  process.env.PROTOTYPE || fileURLToPath(new URL('../../game-prototype/earthmoving-sim.html', import.meta.url));

// The prototype may have Windows line endings; the code we cut out of it is matched on plain ones.
const html = readFileSync(PROTOTYPE_PATH, 'utf8').split('\r\n').join('\n');
const js = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

// Functions we lift out of the prototype. S is the prototype's career; setS swaps one in.
const EXPORTS = [
  'seedRand', 'hashN', 'ri', 'pick', 'withRNG', 'weeklyRepay', 'monthIdx', 'yearOf',
  'wxMm', 'wetDay', 'forecast', 'wxDate', 'wxOff', 'rainP', 'wxMean',
];

export interface Proto {
  setS(s: unknown): void;
  [fn: string]: any;
}

export function loadPrototype(): Proto {
  const end = js.lastIndexOf('})();');
  const hook = `window.__parity = { setS: function(v){ S = v; }, ${EXPORTS.map((n) => `${n}: ${n}`).join(', ')} };\n`;
  const src = js.slice(0, end) + hook + js.slice(end);
  const el = { innerHTML: '' };
  const win: any = { scrollTo() {} };
  const doc = { getElementById: () => el, addEventListener() {}, querySelector: () => null };
  const store: Record<string, string> = {};
  const ls = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem() {} };
  new Function('window', 'document', 'localStorage', 'setTimeout', 'clearTimeout', src)(win, doc, ls, () => 0, () => {});
  return win.__parity;
}

/**
 * The prototype's end-of-week bank step, cut out of its endWeek() word for word, so the test
 * runs the prototype's own code rather than a copy of it.
 */
export function prototypeBankStep(): (S: any, odLimit: number) => { rep: any; BK: any } {
  const start = js.indexOf('  // the bank\n  if(S.bank<0)');
  const stop = js.indexOf("    if(L.missed>=3 && !S.queue.some(", start);
  if (start < 0 || stop < 0) throw new Error("Couldn't find the bank step in the prototype.");
  const body = js.slice(start, stop) + '  }'; // close the if(L.bal>0) block the cut leaves open
  const fn = new Function('S', 'odLimit', 'f', 'log', `var rep = { costs:0, events:[] }, BK = { lc:0, li:0 };\n${body}\nreturn { rep: rep, BK: BK };`);
  return (S, od) => fn(S, () => od, (n: number) => String(n), () => {});
}
