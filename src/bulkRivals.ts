// The real game's bulk and ag outfits: dam sinkers, laser levellers, scraper outfits and developers' earthworks firms.
// They're not the road crews. They win the farm and developer work you price and lose, they pick up work you never see,
// and when they're all flat out the clients are keener on you. Codes and numbers only; the words live in src/text/bulk.ts.

import type { BulkKind, FarmEnquiry } from './bulk';
import { int, pick, type Rand } from './rng';
import type { TownId } from './towns';

/** What an outfit does. */
export type BulkLine = 'dams' | 'laser' | 'scrapers' | 'dev';
export const LINE_KINDS: Record<BulkLine, readonly BulkKind[]> = {
  dams: ['ringTank', 'turkeyNest', 'channel', 'contour', 'rake', 'cutter'],
  laser: ['laser', 'channel', 'contour'],
  scrapers: ['ringTank', 'turkeyNest', 'pad', 'laser', 'channel'],
  dev: ['dev', 'pad', 'ringTank'],
};

/** The outfits in each town: name, stars, what they do, machines. */
export const BULK_RIVALS: Record<TownId, readonly [string, number, BulkLine, number][]> = {
  gdi: [['Yelarbon Dam Sinking', 1, 'dams', 4], ['Kindon Laser Levelling', 2, 'laser', 5], ['Toobeah Scrapers', 2, 'scrapers', 9], ['Darling Downs Bulk Earthworks', 3, 'dev', 16]],
  ct: [['Greenvale Dam Sinking', 1, 'dams', 4], ['Homestead Laser Levelling', 2, 'laser', 5], ['Star River Scrapers', 2, 'scrapers', 9], ['Kennedy Bulk Earthworks', 3, 'dev', 16]],
  stg: [['Thallon Dam Sinking', 1, 'dams', 4], ['Nindigully Laser Levelling', 2, 'laser', 6], ['Culgoa Scrapers', 2, 'scrapers', 10], ['Balonne Bulk Earthworks', 3, 'dev', 16]],
  dby: [['Warra Dam Sinking', 1, 'dams', 4], ['Cecil Plains Laser Levelling', 2, 'laser', 5], ['Jondaryan Scrapers', 2, 'scrapers', 9], ['Western Downs Bulk Earthworks', 3, 'dev', 16]],
  emd: [['Gindie Dam Sinking', 1, 'dams', 4], ['Nogoa Laser Levelling', 2, 'laser', 5], ['Theresa Creek Scrapers', 2, 'scrapers', 9], ['Central Highlands Bulk Earthworks', 3, 'dev', 16]],
  mbh: [['Nebo Dam Sinking', 1, 'dams', 4], ['Clermont Laser Levelling', 2, 'laser', 4], ['Suttor Scrapers', 2, 'scrapers', 10], ['Isaac Bulk Earthworks', 3, 'dev', 18]],
  mky: [['Marian Dam Sinking', 1, 'dams', 4], ['Pioneer Laser Levelling', 2, 'laser', 5], ['Sarina Scrapers', 2, 'scrapers', 8], ['Mackay Bulk Earthworks', 3, 'dev', 16]],
  isa: [['Dajarra Dam Sinking', 1, 'dams', 4], ['Cloncurry Laser Levelling', 2, 'laser', 3], ['Kajabbi Scrapers', 2, 'scrapers', 8], ['North West Bulk Earthworks', 3, 'dev', 16]],
  wei: [['Batavia Dam Sinking', 1, 'dams', 3], ['Mapoon Laser Levelling', 2, 'laser', 3], ['Archer River Scrapers', 2, 'scrapers', 7], ['Wenlock Bulk Earthworks', 3, 'dev', 14]],
};

export interface BulkRival {
  name: string;
  stars: number;
  line: BulkLine;
  fleet: number;
  /** Weeks left on what they're doing, and what it is. */
  busy: number;
  on?: { dk: BulkKind; place: string; farm?: string };
  wins: number;
  /** Jobs they won that you'd priced. */
  beat: number;
}

/** A week's odds that an outfit with nothing on picks up work you never see. */
export const BR_SIDE = 0.3;

export function mkBulkRivals(town: TownId): BulkRival[] {
  return BULK_RIVALS[town].map(([name, stars, line, fleet]) => ({ name, stars, line, fleet, busy: 0, wins: 0, beat: 0 }));
}

export const does = (x: BulkRival, k: BulkKind) => LINE_KINDS[x.line].includes(k);

/** Weeks an outfit's tied up on a job of this kind. */
function weeksFor(rand: Rand, k: BulkKind, weeks?: number): number {
  return k === 'dev' ? (weeks ?? int(rand, 12, 30)) : int(rand, 2, 6);
}

/** The week: jobs finish, and outfits with nothing on find some. */
export function bulkRivalsWeek(rand: Rand, rv: BulkRival[], places: readonly string[], fmul: number): void {
  for (const x of rv) {
    if (x.busy > 0 && --x.busy === 0) delete x.on;
    if (x.busy > 0) continue;
    if (rand() < BR_SIDE * Math.max(0.6, Math.min(fmul, 1.2))) {
      const ks = LINE_KINDS[x.line].filter((k) => k !== 'dev' || rand() < 0.3), dk = ks.length ? pick(rand, ks) : LINE_KINDS[x.line][1]!;
      x.busy = weeksFor(rand, dk);
      x.on = { dk, place: pick(rand, places) };
      x.wins++;
    }
  }
}

/** How keen clients are on you: busy outfits that do this kind of work leave it to you, idle ones price it hard. */
export function keenness(rv: BulkRival[] | undefined, k: BulkKind): number {
  const xs = (rv ?? []).filter((x) => does(x, k));
  if (!xs.length) return 1;
  return 0.85 + 0.3 * (xs.filter((x) => x.busy > 0).length / xs.length);
}

/** Who got a job you priced and lost, and their price. */
export function bulkLoss(rand: Rand, rv: BulkRival[], e: FarmEnquiry): { who: string; price: number } {
  const can = rv.filter((x) => does(x, e.kind)), free = can.filter((x) => !x.busy);
  const x = pick(rand, free.length ? free : can.length ? can : rv);
  const yours = e.quoted ?? 0;
  // over their budget, they took the going rate; under it, someone a bit sharper, and now and then the outfit they know
  const r = rand(), price = yours > e.budget * 1.08 ? e.budget * (0.88 + r * 0.14) : rand() < 0.15 ? yours * (1 + r * 0.08) : yours * (0.86 + r * 0.12);
  x.busy = Math.max(x.busy, weeksFor(rand, e.kind, e.weeks));
  x.on = { dk: e.kind, place: e.place, farm: e.farm };
  x.wins++;
  x.beat++;
  return { who: x.name, price: Math.max(100, Math.round(price / 100) * 100) };
}

/** An enquiry you never priced goes to whoever's free. */
export function bulkLapse(rand: Rand, rv: BulkRival[], e: FarmEnquiry): string | null {
  const free = rv.filter((x) => does(x, e.kind) && !x.busy);
  if (!free.length) return null;
  const x = pick(rand, free);
  x.busy = weeksFor(rand, e.kind, e.weeks);
  x.on = { dk: e.kind, place: e.place, farm: e.farm };
  x.wins++;
  return x.name;
}
