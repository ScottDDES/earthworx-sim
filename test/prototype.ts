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
  'baseValue', 'value', 'mName', 'costIdx', 'dp', 'diffOf', 'svcCost', 'newMachine', 'overdue', 'svcLeft',
  'wear', 'breaks', 'breakdown', 'svcFind', 'fitCov', 'bigNoWsm', 'TYPES', 'YARDS', 'DIFF_P', 'PARTS',
  'service', 'fitterWeek',
  'genCands', 'hireCand', 'fillRoles', 'mgrWeek', 'wages', 'fitPer', 'fitters', 'freeStaff', 'mgrUnlocked',
  'UI', 'NAMES', 'ROLES', 'SKILLS', 'MGR',
  'wsmWeek', 'overheads', 'premium', 'premParts', 'fleetValue', 'talksCost', 'rainCrews', 'odLimit', 'WHS_SYS',
  'genMarket', 'marketWeek', 'fundIdx', 'fmul', 'buy', 'inspect', 'bid', 'hammer', 'sell', 'canFinance', 'lendCap',
  'finDeposit', 'MOODS', 'CLIENTS', 'fk',
  'curve', 'riskMult', 'whsNp', 'npOf', 'safetyWeek', 'upgradeWhs', 'hurtPick', 'whs', 'unlocked', 'TOWNS',
  'genOffers', 'accept', 'whyNot', 'bookable', 'waitOdds', 'askWait', 'release', 'invoice', 'driverOff', 'rateFactor',
  'relAdd', 'relTier', 'relWeek', 'relPts', 'stars',
  'rivalsWeek', 'mkRivals', 'newRival', 'rvPhase', 'rvForm', 'rvFree', 'whoPrices', 'rvWin', 'rvOH', 'rvOHFor', 'rvWhs',
  'RIVALS', 'TIER', 'NEW_NAMES', 'BID_ODDS',
];

export interface Proto {
  setS(s: unknown): void;
  [fn: string]: any;
}

/** Text of the prototype between two markers (start included, end not). Throws if either is missing. */
export function cut(start: string, end: string, from = 0): string {
  const a = js.indexOf(start, from);
  const b = a < 0 ? -1 : js.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Couldn't find ${a < 0 ? start : end} in the prototype.`);
  return js.slice(a, b);
}

/** Cuts a block out and strips its opening and closing wrapper text, checking both are there. */
function inner(block: string, open: string, close: string): string {
  if (!block.startsWith(open)) throw new Error('Block does not start with: ' + open);
  const body = block.slice(open.length).trimEnd();
  if (!body.endsWith(close)) throw new Error('Block does not end with: ' + close);
  return body.slice(0, body.length - close.length);
}

/**
 * Pieces of the prototype's week loop, wrapped as functions and compiled inside the prototype,
 * so they run word for word with all its helpers in reach.
 */
function weekHooks(): string {
  const week = js.indexOf('function endWeek(){');
  const jobOpen = '    S.jobs.forEach(function(j){ var c0 = rep.costs; (function(){\n';
  const day = inner(cut(jobOpen, '    // Anything that finished today', week), jobOpen, '})(); jobCost(j, rep.costs-c0); });');
  const afterDay = cut('    // Anything that finished today', '  }\n  // invoices and completions', week);
  const setOpen = '  S.jobs.slice().forEach(function(j){ var c0 = rep.costs; (function(){\n';
  const settle = inner(cut(setOpen + '    if(j.after) return;', '  fitterWeek(rep); wsmWeek(rep);', week), setOpen, '})(); jobCost(j, rep.costs-c0); jobDone(j); });');
  const recv = cut('  // money coming in\n', '  // the bank\n', week);
  return `__day: function(j, d, wet, rep, downDays){ var c0 = rep.costs; (function(){\n${day}})(); jobCost(j, rep.costs-c0); },
    __afterDay: function(d, rep){\n${afterDay}},
    __settle: function(j, rep, downDays){ var c0 = rep.costs; (function(){\n${settle}})(); jobCost(j, rep.costs-c0); jobDone(j); },
    __recv: function(rep){\n${recv}},
    __startWeek: function(){ S.jobs.forEach(function(j){ j.wk = 0; j.wkDays = 0; }); },`;
}

export function loadPrototype(): Proto {
  const end = js.lastIndexOf('})();');
  const hook = `window.__parity = { setS: function(v){ S = v; }, ${weekHooks()} ${EXPORTS.map((n) => `${n}: ${n}`).join(', ')} };\n`;
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

/** The prototype's end-of-week sales step (auctions settle, private listings count down), cut out word for word. */
export function prototypeSalesStep(): (S: any, r: () => number) => { rep: any } {
  const start = js.indexOf('  // sales\n  S.fleet.slice().forEach(');
  const stop = js.indexOf('  // people', start);
  if (start < 0 || stop < 0) throw new Error("Couldn't find the sales step in the prototype.");
  const body = js.slice(start, stop);
  const P = loadPrototype();
  const fn = new Function('P', 'S', 'r', `var rep = { costs:0, events:[] }, value = P.value, mood = function(){ return S.mkt ? S.mkt.mood : 'steady'; }, MOODS = P.MOODS,
    book = function(k, amt){ S.acc[k] = (S.acc[k]||0) + amt; }, f = String, log = function(){}, machineLabel = function(){ return ''; }, TYPES = P.TYPES;
    ${body}
    return { rep: rep };`);
  return (S, r) => {
    P.setS(S);
    return fn(P, S, r);
  };
}
