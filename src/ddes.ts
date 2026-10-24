// DDES in the mid and late game (Scott, 24 Oct). Early on, ringing DDES Advisory is a real choice; later it was pocket
// change and the big work never asked for it. The real game adds what DDES actually sells, scaled to the business:
//   A. a retainer: a weekly fee by turnover that covers every advisory call and price check, with a health check
//      every quarter that flags one real problem;
//   B. claims: variations when a fixed-price job runs over the plans, and extensions of time for wet weeks against
//      a finish date, paid on success;
//   C. tender writing on the big council bids: more non-price points;
//   D. ERP modules that grow with you: multi-site, plant, claims;
//   E. getting ready to sell: six months' work, then better offers to sell up or retire;
//   F. what DDES saved you, in the year in review.
// The real game only. Numbers and codes; the words live in src/text/ddes.ts.

import { compat } from './compat';
import type { Rand } from './rng';

const round = (n: number, to: number) => Math.round(n / to) * to;

export type ErpMod = 'site' | 'plant' | 'claims';

export interface DdesState {
  /** On retainer since this week. */
  ret?: number | null;
  /** What DDES has saved or got back for you, after its fees, all told; and at the last year review. */
  got: number;
  got0?: number;
  /** The last health check. */
  hc?: number;
  /** Getting ready to sell: when it started, and its fee. Done PREP_WEEKS on. */
  prep?: { w: number; fee: number } | null;
  /** ERP modules in. */
  mods?: Partial<Record<ErpMod, boolean>>;
}

type D = { ddes?: DdesState; week: number; bank: number };
const S = (b: { ddes?: DdesState }): DdesState => (b.ddes ??= { got: 0 });

// ---------- A. the retainer ----------

/** A retainer is a weekly fee: this share of the last quarter's invoicing, never less than the minimum. */
export const RET_SHARE = 0.004;
export const RET_MIN = 1000;
/** A health check every quarter. */
export const CHECK_WEEKS = 13;

export function onRetainer(b: { ddes?: DdesState }): boolean {
  return !compat.prototype && b.ddes?.ret != null;
}
/** Once you're tendering council work in your own name. */
export function retainerOk(b: { won2?: boolean }): boolean {
  return !compat.prototype && !!b.won2;
}
export function retainerFee(b: { hist?: { inv: number }[] }): number {
  const H = (b.hist ?? []).slice(-13), avg = H.length ? H.reduce((a, x) => a + x.inv, 0) / H.length : 0;
  return Math.max(RET_MIN, round(avg * RET_SHARE, 50));
}
export function setRetainer(b: D & { won2?: boolean }, on: boolean): boolean {
  if (on && !retainerOk(b)) return false;
  const s = S(b);
  if (on) {
    if (s.ret == null) {
      s.ret = b.week;
      s.hc = b.week;
    }
  } else s.ret = null;
  return true;
}
/**
 * What an advisory call or a price check costs: its fee, or nothing on retainer (and the fee goes in the tally of
 * what DDES saved you). Callers take the bank down by what this returns.
 */
export function ddesCharge(b: { ddes?: DdesState }, cost: number): number {
  if (!onRetainer(b)) return cost;
  S(b).got += cost;
  return 0;
}
/** The health check's due. */
export function checkDue(b: D): boolean {
  return onRetainer(b) && b.week - (b.ddes!.hc ?? b.ddes!.ret!) >= CHECK_WEEKS;
}

// ---------- B. claims ----------

/** A claim's fee: a share of what's got back, less on retainer. */
export const CLAIM_FEE = 0.15;
export const CLAIM_FEE_RET = 0.1;
/** A fixed-price job this far over the plans: the card asks whether to claim it. */
export const OVER_ASK = 1.08;
/** Odds a variation is paid: DDES or yourself; a developer's or a contract client's, or a farmer's. */
export const VAR_ODDS = { ddes: { contract: 0.8, farm: 0.55 }, self: { contract: 0.45, farm: 0.3 } } as const;
/** Paid, the share of the overrun: DDES gets most of it, you get some. */
export const VAR_SHARE = { ddes: [0.7, 1], self: [0.4, 0.8] } as const;
/** A farmer you claim against yourself: half the time they're put out. */
export const SELF_COOL = 0.5;
/** Extensions of time for wet weeks: the odds they're granted. */
export const EOT_ODDS = { ddes: 0.85, self: 0.4 } as const;
/** Wet days on a job before an extension is worth claiming. */
export const EOT_MIN_DAYS = 3;

export type ClaimWho = 'ddes' | 'self';
export const claimFee = (b: { ddes?: DdesState }) => (onRetainer(b) ? CLAIM_FEE_RET : CLAIM_FEE);

/** Contract clients (developers, feedlots, growers) pay variations more often than farmers. */
export function contractClient(j: { dk?: unknown; proj?: unknown }): boolean {
  return j.dk === 'dev' || !!j.proj;
}

/** What the overrun's worth at the job's own rate: the units over the plans, at what you priced a unit. */
export function overrunValue(j: { m3?: unknown; truth?: unknown; est?: unknown; fixed?: unknown; stages?: { share: number }[]; si?: number }): number {
  const est = (j.est as number) || 0, truth = (j.truth as number) || 0;
  if (est <= 0 || truth <= est) return 0;
  const price = j.stages ? (j.fixed as number) * j.stages[j.si ?? 0]!.share : (j.fixed as number);
  return round(((truth - est) / est) * price, 100);
}

export interface Settled { who: ClaimWho; amt: number; fee: number; cool: boolean }
/** The job (or stage) is done: a claim lodged is paid, or not. */
export function settleOverrun(rand: Rand, b: D, j: Record<string, unknown>): Settled | null {
  const who = j.ov as ClaimWho | undefined, v = overrunValue(j as never);
  delete j.ov;
  return who ? claimPay(rand, b, who, v, contractClient(j)) : null;
}
/** A variation worth v lodged by who: paid (some share of it) or knocked back. */
export function claimPay(rand: Rand, b: D, who: ClaimWho, v: number, contract: boolean): Settled | null {
  if (v <= 0) return null;
  const odds = VAR_ODDS[who][contract ? 'contract' : 'farm'], [lo, hi] = VAR_SHARE[who];
  if (rand() >= odds) return { who, amt: 0, fee: 0, cool: who === 'self' && !contract && rand() < SELF_COOL };
  const amt = round(v * (lo + rand() * (hi - lo)), 100), fee = who === 'ddes' ? round(amt * claimFee(b), 100) : 0;
  if (who === 'ddes') S(b).got += amt - fee;
  return { who, amt, fee, cool: who === 'self' && !contract && rand() < SELF_COOL };
}

/** An extension of time for the wet days: weeks granted (0 if knocked back), and DDES's fee on the damages saved. */
export function eotClaim(rand: Rand, b: D, j: Record<string, unknown>, who: ClaimWho, ldWeek: number): { wks: number; fee: number } {
  j.eot = true;
  const wks = Math.max(1, Math.round(((j.wetD as number) || 0) / 5));
  if (rand() >= EOT_ODDS[who]) return { wks: 0, fee: 0 };
  j.due = (j.due as number) + wks;
  const fee = who === 'ddes' ? round(wks * ldWeek * claimFee(b), 100) : 0;
  if (who === 'ddes') S(b).got += wks * ldWeek - fee;
  return { wks, fee };
}

// ---------- C. tender writing ----------

/** Non-price points DDES's write-up of the methodology, safety and capability adds. */
export const BID_PTS = 3;
/** The fee: a share of the bid, between these, less on retainer. */
export function bidFee(b: { ddes?: DdesState }, value: number): number {
  return round(Math.max(6000, Math.min(25000, value * 0.004)) * (onRetainer(b) ? 0.7 : 1), 500);
}

// ---------- D. ERP modules ----------

export const ERP_MODS: Record<ErpMod, { setup: number; week: number }> = {
  site: { setup: 20000, week: 150 },
  plant: { setup: 25000, week: 200 },
  claims: { setup: 15000, week: 100 },
};
/** Multi-site: branch managers find this much more work. Plant: breakdowns at this share. Claims: paid a week sooner. */
export const SITE_WORK = 1.1;
export const PLANT_BRK = 0.85;
export const PLANT_MIN = 20;
export function hasMod(b: { ddes?: DdesState; erp?: boolean }, k: ErpMod): boolean {
  return !compat.prototype && !!b.erp && !!b.ddes?.mods?.[k];
}
/** Can this module go in: the ERP first; a branch for multi-site; a big enough fleet for plant. */
export function modOk(b: { erp?: boolean; branch?: unknown; fleet: unknown[] }, k: ErpMod): boolean {
  if (compat.prototype || !b.erp) return false;
  return k === 'site' ? !!b.branch : k === 'plant' ? b.fleet.length >= PLANT_MIN : true;
}
export function addMod(b: D & { erp?: boolean; branch?: unknown; fleet: unknown[] }, k: ErpMod): boolean {
  const s = S(b);
  if (s.mods?.[k] || !modOk(b, k) || b.bank < ERP_MODS[k].setup) return false;
  b.bank -= ERP_MODS[k].setup;
  (s.mods ??= {})[k] = true;
  return true;
}
/** The modules' weekly fees. */
export function modsWeek(b: { ddes?: DdesState; erp?: boolean }): number {
  if (compat.prototype || !b.erp) return 0;
  return (Object.keys(ERP_MODS) as ErpMod[]).reduce((a, k) => a + (b.ddes?.mods?.[k] ? ERP_MODS[k].week : 0), 0);
}

// ---------- E. getting ready to sell ----------

export const PREP_WEEKS = 26;
/** Sale and retirement offers once it's done: this much more, plus a little for the ERP and for ISO 45001. */
export const PREP_LIFT = 0.1, PREP_ERP = 0.03, PREP_ISO = 0.02;
/** Once you're a regional contractor. */
export function prepOk(b: { won3?: boolean; ddes?: DdesState }): boolean {
  return !compat.prototype && !!b.won3 && !b.ddes?.prep;
}
export function prepFee(b: { ddes?: DdesState }, nw: number): number {
  return round(Math.max(40000, Math.min(80000, nw * 0.01)) * (onRetainer(b) ? 0.6 : 1), 1000);
}
export function startPrep(b: D & { won3?: boolean }, nw: number): boolean {
  const fee = prepFee(b, nw);
  if (!prepOk(b) || b.bank < fee) return false;
  b.bank -= fee;
  S(b).prep = { w: b.week, fee };
  return true;
}
export function prepDone(b: { ddes?: DdesState; week: number }): boolean {
  return !compat.prototype && !!b.ddes?.prep && b.week - b.ddes.prep.w >= PREP_WEEKS;
}
/** What getting ready does to an offer. */
export function prepMul(b: { ddes?: DdesState; week: number; erp?: boolean; whs?: { sys: number } }): number {
  if (!prepDone(b)) return 1;
  return 1 + PREP_LIFT + (b.erp ? PREP_ERP : 0) + ((b.whs?.sys ?? 0) >= 3 ? PREP_ISO : 0);
}

// ---------- F. the year ----------

/** What DDES saved you since the last year review; starts the next count. */
export function ddesYear(b: { ddes?: DdesState }): number | undefined {
  if (compat.prototype || !b.ddes) return undefined;
  const v = Math.round(b.ddes.got - (b.ddes.got0 ?? 0));
  b.ddes.got0 = b.ddes.got;
  return v;
}

// ---------- the health check ----------

export type CheckFind = 'cash' | 'over' | 'branch' | 'svc' | 'fine';
/** The quarter's one problem, most pressing first. */
export function healthFind(b: {
  bank: number; od: number; hist?: { b: number }[]; jobs: Record<string, unknown>[]; branches: { hist: unknown[]; profit: number; town: string }[]; overdue: number;
}): { k: CheckFind; id?: string; town?: string } {
  const H = (b.hist ?? []).slice(-6);
  if (b.bank < 0 && H.length >= 4 && H[H.length - 1]!.b < H[0]!.b && -b.bank > b.od * 0.6) return { k: 'cash' };
  const j = b.jobs.find((x) => x.kind === 'bulk' && x.state === 'running' && !x.finished && !x.ov && overrunValue(x as never) > 0 && (x.m3 as number) > (x.est as number) * 1.02);
  if (j) return { k: 'over', id: j.id as string };
  const br = b.branches.find((x) => x.hist.length >= 13 && x.profit < 0);
  if (br) return { k: 'branch', town: br.town };
  if (b.overdue >= 3) return { k: 'svc' };
  return { k: 'fine' };
}

/** A week's DDES: the health check when it's due. */
export function ddesWeek(_rand: Rand, b: D & { queue: { k: string }[] }): void {
  if (checkDue(b) && !b.queue.some((q) => q.k === 'ddescheck')) {
    b.ddes!.hc = b.week;
    b.queue.push({ k: 'ddescheck' });
  }
}