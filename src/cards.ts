// Curve balls: the cards that turn up between the work. At most one every 3 weeks (30% a week), and the same
// kind not again for 12. Also the rain call: when the forecast has rain on a working day, stand the crews
// down or push on and wear the rework if it comes in heavy.
// A card's own numbers roll on the card's seed (so it reads the same every time it's shown); what happens
// after the choice rolls on the career's stream. Words for the stories live in text/.

import { note } from './diary';
import { weeklyRepay } from './bank';
import { dayOffset } from './calendar';
import { book } from './ledger';
import { PARTS, newMachine, TYPES, type Machine } from './machines';
import { CLIENTS, freeDriver, invoice, uid, type Biz, type Job, type WeekReport } from './hire';
import { int, pick, type Rand } from './rng';
import { ROLES } from './staff';
import { TOWNS } from './towns';
import { compat } from './compat';
import { HURT_ADVISORY } from './advisory';
import { ddesCharge } from './ddes';
import { forecast, rainMm, type WeatherCtx } from './weather';
import { record, type Whs } from './safety';

export const CURVE_ODDS = 0.3;
export const REWORK_LIGHT = 450;
export const REWORK_HEAVY = 1800;
export const RAIN_HEAVY = 12;

const round = (n: number, to: number) => Math.round(n / to) * to;
const mach = (b: Biz, id: string | null | undefined) => (id ? b.fleet.find((m) => m.id === id) : undefined);
const job = (b: Biz, id: string | null | undefined) => (id ? b.jobs.find((j) => j.id === id) : undefined);

/** Bulk jobs going (the real game): the rain card talks dirt, not formation, for these. */
export const rainBulk = (jobs: readonly Job[]) => (compat.prototype ? 0 : jobs.filter((j) => j.kind === 'bulk' && j.state === 'running' && !j.finished).length);

/** Crews out that rain would stop: day jobs, running subbie crews, your own contract's crews. Dry hire and subbed-out work carry on. */
export function rainCrews(jobs: readonly Job[]): number {
  return jobs.reduce((a, j) => {
    if (j.finished || j.state === 'subbed' || j.kind === 'dry') return a;
    if (j.kind === 'bulk' && !compat.prototype) return a + (j.state === 'running' ? 1 : 0);
    if (j.kind === 'own') return a + (j.state === 'running' ? (j.crews as number) : 0);
    if (j.kind === 'sub') return a + (j.state === 'running' ? 1 : 0);
    return a + 1;
  }, 0);
}

export interface CardState extends Biz {
  yard: string;
  cbLast?: number;
  cbSeen: Record<string, number>;
  camera?: boolean;
  ins: number;
  loan: import('./bank').Loan;
  whs: Whs;
  rainCall?: { w: number; d: number; push: boolean } | null;
  won?: boolean;
  swmsAsked?: boolean;
}

/** A grader free for a council call-out: an idle one with a driver, or one on a hire job (not dry hire or a contract). */
export function callGrader(b: Biz): Machine | null {
  const gs = b.fleet.filter((m) => m.type === 'grader' && m.down === 0 && (m.status === 'idle' || m.status === 'job'));
  const idle = gs.find((m) => m.status === 'idle');
  if (idle && freeDriver(b, 'grader')) return idle;
  return gs.find((m) => { const j = job(b, m.jobId); return j && j.kind !== 'dry' && j.kind !== 'sub' && j.kind !== 'own' && !j.finished; }) || null;
}

/** A head contractor owing you $5,000 or more, not due for at least two weeks. */
export function earlyClient(b: Biz): string | null {
  const t: Record<string, number> = {};
  for (const y of b.recv) if (CLIENTS[y.client] && y.due < 9999 && y.due > b.week + 1) t[y.client] = (t[y.client] || 0) + y.amt;
  return Object.keys(t).find((c) => t[c]! >= 5000) || null;
}

/**
 * Maybe a curve ball this week. Each kind joins the pool when it could happen; a few are twice as likely.
 * room: free slots in your yard. theft: the yard's break-in odds.
 */
export function curveWeek(rand: Rand, b: CardState, room: number, theft: number): { k: string; id?: string } | null {
  if (b.queue.length || b.week - (b.cbLast || 0) < 3 || !(rand() < CURVE_ODDS)) return null;
  const pool: string[] = [], fresh = (k: string) => !(b.cbSeen[k] && b.week - b.cbSeen[k]! < 12);
  if (!b.fleet.some((m) => m.type === 'roller') && b.bank > 10000 && room > 0) pool.push('clearing');
  const hp = b.staff.find((p) => { const hj = job(b, p.jobId); return hj && hj.who === p.id && p.off === 0; });
  if (hp) pool.push('hurt');
  if (b.fleet.length && rand() < theft * (b.camera ? 0.5 : 1)) pool.push('breakin');
  const pj = b.jobs.find((j) => j.kind === 'private' && !j.extraAsked && !j.after);
  if (pj) pool.push('extra');
  if (callGrader(b) && (compat.prototype || !((b.blocked[TOWNS[b.town].council] ?? 0) > b.week))) pool.push('callout', 'callout');
  if (rainCrews(b.jobs)) {
    pool.push('nearmiss');
    if (b.whs.hz > 0.2) pool.push('nearmiss');
  }
  const qp = b.staff.find((p) => p.off === 0 && ROLES[p.role].drives.length && !((p.yarn ?? -1e9) > b.week - 26));
  if (qp) pool.push('quiet');
  if (earlyClient(b)) pool.push('early');
  const sj = b.jobs.find((j) => (j.kind === 'sub' || j.kind === 'own') && j.state === 'running' && !j.finished);
  const ids: Record<string, string | undefined> = { extra: pj?.id, hurt: hp?.id, quiet: qp?.id };
  if (sj) {
    ids.variation = ids.gravel = ids.drydam = ids.pitout = sj.id;
    if (!sj.varAsked) pool.push('variation', 'variation');
    if (!sj.gravAsked && sj.gravel) {
      pool.push('gravel');
      if (sj.marginal) pool.push('gravel', 'gravel');
    }
    if (sj.kind === 'own' && !sj.damAsked) pool.push('drydam');
    if (sj.kind === 'own' && sj.marginal && !sj.pitAsked && (sj.sLeft as number) > 0 && (sj.gLeft as number) <= 0) pool.push('pitout', 'pitout');
  }
  const ok = pool.filter(fresh);
  if (!ok.length) return null;
  const k = pick(rand, ok), q = ids[k] ? { k, id: ids[k] } : { k };
  b.queue.push(q);
  b.cbLast = b.week;
  b.cbSeen[k] = b.week;
  return q;
}

/** Head contractors want SWMS: asked once, when you've got a crew and a star and nothing on paper. */
export function swmsWeek(b: CardState, hasCrew: boolean, starsN: number): void {
  if (hasCrew && starsN >= 1 && b.whs.sys < 1 && !b.swmsAsked) {
    b.swmsAsked = true;
    b.queue.push({ k: 'swms' });
  }
}

// ---------- the rain call ----------

/** Rain on the forecast for a working day with crews out (and the ground not already too wet): a card. */
export function rainCallCheck(b: CardState, wx: WeatherCtx): void {
  if (b.queue.some((q) => q.k === 'rainday') || !rainCrews(b.jobs)) return;
  const R = TOWNS[wx.town].stop;
  for (let d = 0; d < 5; d++) {
    const o = dayOffset(b.week, d), f = forecast(wx, b.week, d), ground = rainMm(wx, o - 1) >= R[1] || rainMm(wx, o - 2) >= R[2];
    if (f.fmm >= 5 && !ground) {
      b.queue.push({ k: 'rainday', w: b.week, d, fmm: f.fmm, pc: f.pc });
      return;
    }
  }
}

/** Your call: stand them down, or push on. */
export function rainDecide(b: CardState, q: { w: number; d: number }, push: boolean): void {
  b.rainCall = { w: q.w, d: q.d, push };
}

export type RainCallEvent = { k: 'stoodDown'; d: number; mm: number; right: boolean } | { k: 'pugged'; d: number; mm: number; cost: number } | { k: 'touchUp'; d: number; mm: number; cost: number } | { k: 'missedUs'; d: number; mm: number };

/**
 * The day you made a call about. Returns whether the day's wet. Stood down: lost whatever falls. Pushed on:
 * if it misses you, a full day; light rain, the day's in with touch-up passes; 12 mm or more, the formation
 * pugs up and the day's lost with rework. Returns `right`: whether the call was right (for the tickets).
 */
export function rainCallDay(b: CardState, wx: WeatherCtx, d: number, wet: boolean, rep: WeekReport, events: RainCallEvent[]): boolean {
  const rc = b.rainCall && b.rainCall.w === b.week && b.rainCall.d === d ? b.rainCall : null;
  if (!rc) return wet;
  const oD = dayOffset(b.week, d), mmD = rainMm(wx, oD), RD = TOWNS[wx.town].stop, crews = rainCrews(b.jobs);
  if (!(rainMm(wx, oD - 1) >= RD[1] || rainMm(wx, oD - 2) >= RD[2])) {
    if (!rc.push) {
      wet = true;
      events.push({ k: 'stoodDown', d, mm: mmD, right: mmD >= RD[0] });
    } else if (mmD >= RAIN_HEAVY) {
      wet = true;
      const rw = REWORK_HEAVY * crews;
      b.bank -= rw;
      rep.costs += rw;
      book(b.acc, 'jobCosts', rw);
      events.push({ k: 'pugged', d, mm: mmD, cost: rw });
      note(b, { k: 'pushedOn', d, mm: mmD, cost: rw });
    } else if (mmD >= RD[0]) {
      wet = false;
      const rl = REWORK_LIGHT * crews;
      b.bank -= rl;
      rep.costs += rl;
      book(b.acc, 'jobCosts', rl);
      events.push({ k: 'touchUp', d, mm: mmD, cost: rl });
    } else events.push({ k: 'missedUs', d, mm: mmD });
  }
  b.rainCall = null;
  return wet;
}

// ---------- the cards ----------

/** A roller at a clearing sale: borrow $20k and win it at $49,500, or go with cash ($46k) and a 55% chance. */
export function clearingBorrow(rand: Rand, b: CardState): void {
  // the prototype adds to the loan without clearing 'paid off', so this does too
  b.loan.bal += 20000;
  b.loan.weekly = weeklyRepay(b.loan.bal);
  b.bank -= 29500;
  book(b.acc, 'capital', 49500);
  book(b.acc, 'loan', -20000);
  b.fleet.push(newMachine(rand, uid(b), 'roller', 2009, 55, 11800));
}
export function clearingCash(rand: Rand, b: CardState): boolean {
  if (b.bank >= 46000 && rand() < 0.55) {
    b.bank -= 46000;
    book(b.acc, 'capital', 46000);
    b.fleet.push(newMachine(rand, uid(b), 'roller', 2009, 55, 11800));
    return true;
  }
  return false;
}

/** Christmas party costs: a night at the pub, or a barbie in the yard. Per head, crew plus you. */
export function xmasCost(staff: number): { party: number; bbq: number } {
  return { party: 180 * (staff + 1) + 800, bbq: 40 * (staff + 1) + 200 };
}

/** Send the crew off for Christmas: the party lifts culture and counts as a yarn with everyone; skipping it costs. */
export function xmasParty(b: CardState, how: 'party' | 'bbq' | 'skip'): void {
  const c = xmasCost(b.staff.length);
  if (how === 'party') {
    b.bank -= c.party;
    b.whs.cult = Math.min(100, b.whs.cult + 10);
    for (const p of b.staff) p.yarn = b.week;
  } else if (how === 'bbq') {
    b.bank -= c.bbq;
    b.whs.cult = Math.min(100, b.whs.cult + 4);
  } else b.whs.cult = Math.max(0, b.whs.cult - 5);
}

/** Someone's back has gone: send them home (2 weeks), jump on their machine yourself, or let them keep going (45% injured). */
export function hurtHome(p: { off: number }): void {
  p.off = 2;
}
export function hurtCover(b: CardState & { opCover: number; coverFor: string | null; youBlocked: number }, p: { id: string; off: number }): void {
  p.off = 1;
  b.opCover = 1;
  b.coverFor = p.id;
  b.youBlocked = 1;
}
/** DDES Advisory manages the injury: the right doctor this week, back in one week instead of two. */
export function hurtAdvisory(b: CardState, p: { off: number }): void {
  b.bank -= ddesCharge(b as never, HURT_ADVISORY);
  p.off = 1;
  b.whs.cult = Math.min(100, b.whs.cult + 4);
}
export function hurtKeepGoing(rand: Rand, b: CardState, p: { id: string; off: number }): boolean {
  b.whs.cult = Math.max(0, b.whs.cult - 8);
  if (rand() < 0.45) {
    p.off = 6;
    b.ins += 0.1;
    record(b.whs, { w: b.week, sev: 'lti', who: p.id, story: { k: 'badBack' } });
    return true;
  }
  return false;
}

/** Someone's been in the yard: claim it ($1,000 excess, insurance +8%), fix it and put up a camera ($3,800), or run without GPS (50%: $900 rework). */
export function breakinClaim(b: CardState): void {
  b.bank -= 1000;
  b.ins += 0.08;
}
export function breakinCamera(b: CardState): void {
  b.bank -= 3800;
  b.camera = true;
}
/** The real game: no GPS in the yard to take, so it's only the diesel: wear it, or wear it and put up a camera. */
export const BREAKIN_DIESEL = 840, CAMERA_COST = 1200;
export function breakinDiesel(b: CardState, camera: boolean): void {
  b.bank -= BREAKIN_DIESEL + (camera ? CAMERA_COST : 0);
  if (camera) b.camera = true;
}
export function breakinWithout(rand: Rand, b: CardState): boolean {
  if (rand() < 0.5) {
    b.bank -= 900;
    return true;
  }
  return false;
}

/** A private client wants a bit extra: do it and ask (70%: $2,700), agree a price first ($2,970, a day lost), or free (+1 track record). */
export function extraAsk(rand: Rand, j: Job): boolean {
  j.extraAsked = true;
  j.days += 2;
  if (rand() < 0.7) {
    j.extra = 2700;
    return true;
  }
  return false;
}
export function extraAgree(j: Job): void {
  j.extraAsked = true;
  j.days += 3;
  j.extra = 2970;
}
export function extraFree(b: Biz, j: Job): void {
  j.extraAsked = true;
  j.days += 2;
  b.rep += 1;
}

/** A storm call-out for the council: three days at $2,100, paid in 14 days, track record +1. */
export function callWork(b: Biz, g: Machine): void {
  invoice(b, TOWNS[b.town].council, 6300, 2, { invoiced: 0 });
  b.rep += 1;
  g.hours += 27;
  g.cond = Math.max(10, g.cond - 0.9);
  note(b, { k: 'callout', amt: 6300 });
}
/** Pull your grader off a hire job for it: that job runs 3 days longer, and a wet-hire client may hold it against you (40%). */
export function calloutPull(rand: Rand, b: Biz, g: Machine, gj: Job): boolean {
  callWork(b, g);
  gj.days += 3;
  if (gj.kind === 'wet' && rand() < 0.4) {
    b.rep = Math.max(0, b.rep - 1);
    return true;
  }
  return false;
}

/** A head contractor offers to pay everything early for 3% off. */
export function earlyTake(b: Biz, client: string): number {
  const inv = b.recv.filter((y) => y.client === client && y.due < 9999), tot = inv.reduce((a, y) => a + y.amt, 0), net = Math.round(tot * 0.97);
  b.bank += net;
  book(b.acc, 'collections', net);
  b.stats.earned += net;
  b.recv = b.recv.filter((y) => !inv.includes(y));
  return net;
}

export interface BreakCard {
  cost: number;
  /** Days down at the dealer (or under warranty). */
  dd: number;
  warranty: boolean;
  /** Hiring in a replacement, if it's on a hire or contract job (not dry hire) and not on warranty. */
  rc: number | null;
  /** Which story (text/), or null when a patched part let go. */
  story: number | null;
}

/** A breakdown card's numbers, from the card's own seed. */
export function breakCard(cardRand: Rand, b: Biz, m: Machine): BreakCard {
  const cost = m.repair!, dd = int(cardRand, 2, 4), j = job(b, m.jobId), ws = m.warranty >= b.week;
  const rc = j && j.kind !== 'dry' && !ws ? round((j.kind === 'sub' || j.kind === 'own' ? TYPES[m.type].wet * 0.8 : j.rate * 0.6) * dd, 50) : null;
  const story = m.bandBroke ? null : int(cardRand, 0, 3);
  return { cost, dd, warranty: ws, rc, story };
}
export type BreakFix = 'warranty' | 'mobile' | 'dealer' | 'hireIn';

/** The real game, with a fitter of your own: patch it up for 30% and keep it going, or fix it properly for 80% and a day or so down. */
export const fitterPatchCost = (c: BreakCard) => round(c.cost * 0.3, 50);
export const fitterFixCost = (c: BreakCard) => round(c.cost * 0.8, 50);
export const fitterFixDays = (c: BreakCard) => Math.max(1, c.dd - 1);
export function breakPatch(rand: Rand, b: Biz, m: Machine, c: BreakCard): void {
  const cost = fitterPatchCost(c);
  b.bank -= cost;
  book(b.acc, 'workshop', cost);
  m.down = 0;
  m.band = { part: pick(rand, PARTS[m.type]), fix: c.cost, w: b.week };
}
export function breakFitterFix(b: Biz, m: Machine, c: BreakCard): void {
  const cost = fitterFixCost(c);
  b.bank -= cost;
  book(b.acc, 'workshop', cost);
  m.down = fitterFixDays(c);
}
export function breakFix(b: Biz, m: Machine, c: BreakCard, how: BreakFix): void {
  if (how === 'warranty') m.down = c.dd;
  if (how === 'mobile') {
    b.bank -= Math.round(c.cost * 1.25);
    book(b.acc, 'workshop', Math.round(c.cost * 1.25));
    m.down = 0;
  }
  if (how === 'dealer') {
    b.bank -= c.cost;
    book(b.acc, 'workshop', c.cost);
    m.down = c.dd;
  }
  if (how === 'hireIn') {
    b.bank -= c.cost + c.rc!;
    book(b.acc, 'workshop', c.cost + c.rc!);
    m.down = c.dd;
    m.cover = c.dd;
  }
}

/** A fault found at a service: fix it properly (down a day or two unless your own fitter found it), or bandaid it for 15%. */
export function svcFindDays(cardRand: Rand, by: string | null): number {
  return by ? 0 : int(cardRand, 1, 2);
}
export function svcFix(b: Biz, m: Machine, fix: number, dd: number): void {
  b.bank -= fix;
  book(b.acc, 'workshop', fix);
  m.down = Math.max(m.down, dd);
}
export function svcPatch(b: Biz, m: Machine, part: string, fix: number): void {
  const patch = round(fix * 0.15, 50);
  b.bank -= patch;
  book(b.acc, 'workshop', patch);
  m.band = { part, fix, w: b.week };
}

/** The workshop manager says turn it over: auction it, list it privately (5% more with the ex-dealer), or keep it 26 weeks. */
export function turnoverSell(rand: Rand, m: Machine, mode: 'auction' | 'list', value: number, dealer: boolean): void {
  if (mode === 'auction') {
    m.status = 'auction';
    return;
  }
  m.status = 'listed';
  m.sale = { weeks: int(rand, 2, 5), price: round(value * 0.95 * (dealer ? 1.05 : 1), 500) };
}
export function turnoverKeep(b: Biz, m: Machine): void {
  m.toSnooze = b.week + 26;
}

