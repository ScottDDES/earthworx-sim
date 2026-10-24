// Feedlot and cotton field developments (Scott, 24 Oct): big bulk and ag projects made of stages, each a kind of work the
// game already knows (pads, channels, dams, laser levelling, raking, roads), done one after another with the gear each
// stage needs. Priced as one job: a rate a head of cattle, or a hectare of cotton. Each stage is paid when it's done.
// A feedlot has a finish date (damages after it) and, done well, a pen-cleaning hire and an expansion later. A cotton
// block must be levelled before planting in October, or the grower docks you and doesn't ring about the next block.
// The real game only. Numbers and codes; the words live in src/text/bulk.ts.

import type { BulkKind, FarmEnquiry } from './bulk';
import { monthIdx } from './calendar';
import { int, pick, type Rand } from './rng';
import { damVolume, type DamPit } from './sums';
import { TOWNS, type TownId } from './towns';

export type ProjKind = 'feedlot' | 'cotton';
export const isProj = (k: unknown): k is ProjKind => k === 'feedlot' || k === 'cotton';

export type StageId = 'strip' | 'pens' | 'drains' | 'pond' | 'roads' | 'clear' | 'level' | 'supply' | 'tail' | 'storage';

export interface Stage {
  id: StageId;
  /** The kind of work it is, for the gear, the pace and the quality. */
  dk: BulkKind;
  /** On the plans, in that kind's unit. */
  qty: number;
  /** What's really there. Hidden. */
  truth: number;
  haul: number;
  per?: number;
  area?: number;
  dam?: DamPit;
  tested?: boolean;
  /** Its share of the price, paid when it's done. */
  share: number;
}

/** Pen space a head, m², and the site around the pens. */
export const PEN_M2 = 15;
const SITE = 1.6;
/** A feedlot's finish date: weeks for this much dirt, plus weeks to set up. Damages a week late, as a developer's. */
export const FEED_M3_WEEK = 12000;
export const FEED_SETUP = 6;
/** A cotton block's fields must be level before planting: the first week of October at least this many weeks after it's won. */
export const PLANT_MONTH = 9;
export const PLANT_LEAD = 16;
/** Late for planting: the grower docks this share of the price. */
export const PLANT_DOCK = 0.1;
/** Cotton blocks a grower develops, one a year, at most. */
export const COTTON_BLOCKS = 3;
/** Weeks of loader hire cleaning pens, and its premium on the wet rate. */
export const PENS_WEEKS = 26;
export const PENS_PREMIUM = 1.1;
/** Good enough work, across the stages, to be asked back. */
export const ASK_BACK_Q = 0.72;

/** Feedlot companies and cotton growers. */
export const FEEDLOTS = ['Brigalow Beef', 'Downs Cattle Co', 'Condamine Feeders', 'Grainfed Pastoral', 'Myall Lot Feeders'] as const;
export const GROWERS = ['Norris Farming', 'Beaumont Cotton', 'Galloway Ag', 'Prentice Pastoral', 'Wilmot Irrigation'] as const;

/** First week of October at least `lead` weeks after week w. */
export function plantWeek(w: number, lead = PLANT_LEAD): number {
  let x = w + lead;
  while (monthIdx(x) !== PLANT_MONTH) x++;
  while (monthIdx(x - 1) === PLANT_MONTH) x--;
  return x;
}

/** How often each town's feedlots and growers ring. */
export function projOdds(town: TownId, k: ProjKind): number {
  return k === 'feedlot' ? TOWNS[town].work.feed : TOWNS[town].work.cotton;
}

/** A dam shaped to hold about this much dirt. */
function damFor(rand: Rand, m3: number): DamPit {
  const depth = int(rand, 7, 8) / 2;
  let L = 60;
  let d: DamPit = { topLength: L, topWidth: 40, depth, sideBatter: 3, endBatter: 3 };
  while (damVolume(d).total < m3 && L < 600) {
    L += 10;
    d = { topLength: L, topWidth: Math.max(40, Math.round((L * 0.6) / 10) * 10), depth, sideBatter: 3, endBatter: 3 };
  }
  return d;
}

/**
 * A feedlot or cotton enquiry. `lift` is the real game's going-rate lift, `mkt` the market. The client's budget is
 * the stages' going rates with some give either way; your opening rate is the going rate.
 */
export function genProject(rand: Rand, k: ProjKind, mkt: number, lift: number, base: { id: string; place: string; week: number }, o: { farm?: string; block?: number; size?: number } = {}): FarmEnquiry {
  const noise = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const st: (Omit<Stage, 'share' | 'truth'> & { rate: number })[] = [];
  let vol: number;
  if (k === 'feedlot') {
    vol = o.size ?? int(rand, 20, 100) * 100;
    const pens = vol * PEN_M2, site = pens * SITE, side = Math.sqrt(site);
    st.push({ id: 'strip', dk: 'pad', qty: Math.round((site * 0.15) / 100) * 100, haul: int(rand, 10, 25) * 10, area: Math.round(site), per: 0.15, rate: 2.5 });
    const depth = int(rand, 4, 7) / 10;
    st.push({ id: 'pens', dk: 'pad', qty: Math.round((pens * depth) / 100) * 100, haul: int(rand, 10, 30) * 10, area: Math.round(pens), per: depth, tested: true, rate: 4.5 });
    const dper = int(rand, 4, 8) / 2;
    st.push({ id: 'drains', dk: 'channel', qty: Math.max(300, Math.round((side * int(rand, 5, 9)) / 50) * 50), per: dper, haul: 0, rate: dper * 4.5 });
    const dam = damFor(rand, vol * int(rand, 5, 9));
    st.push({ id: 'pond', dk: 'ringTank', qty: Math.round(damVolume(dam).total), dam, haul: int(rand, 10, 25) * 10, tested: true, rate: 3.4 });
    st.push({ id: 'roads', dk: 'contour', qty: Math.max(1, Math.round((vol / 1500) * 2) / 2), haul: 0, rate: 9000 });
  } else {
    vol = o.size ?? int(rand, 20, 80) * 10;
    st.push({ id: 'clear', dk: 'rake', qty: Math.max(20, Math.round((vol * noise(0.3, 0.7)) / 5) * 5), haul: 0, rate: 400 });
    const per = int(rand, 25, 45) * 10;
    st.push({ id: 'level', dk: 'laser', qty: vol, per, haul: 80, rate: Math.round((per * 3.1) / 10) * 10 });
    const sp = int(rand, 4, 8) / 2, tp = int(rand, 3, 6) / 2;
    st.push({ id: 'supply', dk: 'channel', qty: Math.round((vol * int(rand, 6, 10)) / 50) * 50, per: sp, haul: 0, rate: sp * 4.5 });
    st.push({ id: 'tail', dk: 'channel', qty: Math.round((vol * int(rand, 3, 6)) / 50) * 50, per: tp, haul: 0, rate: tp * 4.5 });
    const dam = damFor(rand, vol * int(rand, 250, 450));
    st.push({ id: 'storage', dk: 'ringTank', qty: Math.round(damVolume(dam).total), dam, haul: int(rand, 15, 40) * 10, tested: true, rate: 3.0 });
  }
  // what's really there: every stage can come in over or under the plans, the same way across the job
  const lean = noise(0.92, 1.16);
  const worth = st.map((s) => s.qty * s.rate), total = worth.reduce((a, x) => a + x, 0);
  const stages: Stage[] = st.map(({ rate: _r, ...s }, i) => ({ ...s, truth: Math.round(s.qty * lean * noise(0.96, 1.04) * 100) / 100, share: worth[i]! / total }));
  const step = k === 'feedlot' ? 1 : 10;
  const rate = Math.round((total * lift) / vol / step) * step;
  const weeks = k === 'feedlot' ? Math.ceil(stages.filter((s) => s.dk === 'pad' || s.dk === 'ringTank').reduce((a, s) => a + s.qty, 0) / FEED_M3_WEEK) + FEED_SETUP : undefined;
  const farm = o.farm ?? pick(rand, k === 'feedlot' ? FEEDLOTS : GROWERS);
  return {
    ...base, kind: k, farm, haul: 0, vol, truth: vol, survey: vol, stages, smul: Math.round(lean * noise(0.97, 1.03) * 100) / 100,
    tested: true, budget: Math.round((total * noise(0.88, 1.18) * mkt) / 1000) * 1000, rate,
    ...(weeks ? { weeks } : {}), ...(o.block ? { block: o.block } : {}),
  };
}

/** The share of the price earned so far: stages done, and the one under way. */
export function projDone(j: { stages?: Stage[]; si?: number; m3?: unknown; truth?: unknown }): number {
  const S = j.stages ?? [], i = j.si ?? 0;
  return S.slice(0, i).reduce((a, s) => a + s.share, 0) + (S[i] ? S[i]!.share * Math.min(1, ((j.m3 as number) || 0) / ((j.truth as number) || 1)) : 0);
}
