// The words for the Bulk and Ag pack's work.

import { compat } from '../compat';
import type { Job } from '../hire';
import { KINDS, type Attachment, type BulkKind, type FarmEnquiry, type Unit } from '../bulk';
import type { BulkLine, BulkRival } from '../bulkRivals';

const f = (n: number) => '$' + Math.round(n).toLocaleString('en-AU');
const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');

export const DAM_KIND: Record<BulkKind, string> = {
  ringTank: 'Ring tank', turkeyNest: 'Turkey nest dam', laser: 'Laser levelling', channel: 'Irrigation channel', contour: 'Contour banks',
  pad: 'Shed pad', rake: 'Stick raking', cutter: 'Cutter barring', dev: 'Bulk earthworks',
};

/** The bulk and ag outfits: what they do, and what they're on. */
export const BULK_LINE: Record<BulkLine, string> = { dams: 'Dams and farm work', laser: 'Laser levelling', scrapers: 'Scrapers: dams and pads', dev: "Developers' bulk earthworks" };
export function bulkRivalNow(x: BulkRival): string {
  if (!x.on) return 'Looking for work';
  const what = DAM_KIND[x.on.dk].toLowerCase();
  return 'On ' + (x.on.farm ? x.on.farm + "'s " + what : NO_A.includes(x.on.dk) ? what : an0(what)) + ' near ' + x.on.place + ', ' + x.busy + ' week' + (x.busy === 1 ? '' : 's') + ' to go';
}
const NO_A: readonly BulkKind[] = ['laser', 'contour', 'rake', 'cutter', 'dev'];
const an0 = (w: string) => (/^[aeiou]/.test(w) ? 'an ' : 'a ') + w;

/** The unit, short ("m³") and as a rate ("a m³"). */
export const UNIT: Record<Unit, { short: string; per: string; dp: number }> = {
  m3: { short: 'm³', per: 'a m³', dp: 0 },
  ha: { short: 'ha', per: 'a hectare', dp: 1 },
  m: { short: 'm', per: 'a metre', dp: 0 },
  km: { short: 'km', per: 'a km', dp: 1 },
};
export const ATTACH_NAME: Record<Attachment, string> = { laser: 'Laser Gear', rake: 'Stick Rake', cutter: 'Cutter Bar' };
export const ATTACH_NOTE: Record<Attachment, string> = {
  laser: 'The transmitter for one job site. Every laser-fitted machine on that job runs off it.',
  rake: 'Rakes cleared timber into windrows and leaves the topsoil. Fits any dozer.',
  cutter: 'A blade dragged under the surface to cut regrowth roots. D8 or bigger.',
};

export function qty(n: number, u: Unit): string {
  return n.toLocaleString('en-AU', { maximumFractionDigits: UNIT[u].dp }) + ' ' + UNIT[u].short;
}

/** "Ring tank for Kelly, near Bungunya" */
export function damTitle(x: { dk?: unknown; kind?: string; client?: string; farm?: string; place: string }): string {
  const k = (x.dk ?? x.kind) as BulkKind;
  return (DAM_KIND[k] ?? 'Bulk work') + ' for ' + (x.farm ?? x.client) + ', near ' + x.place;
}

/** The enquiry, as the client put it. */
export function enquiryLine(e: FarmEnquiry): string {
  const u = KINDS[e.kind].unit;
  switch (e.kind) {
    case 'ringTank':
    case 'turkeyNest': {
      const d = e.dam!;
      return d.topLength + ' × ' + d.topWidth + ' m at the top, ' + d.depth + ' m deep, ' + d.sideBatter + ':1 sides and ' + d.endBatter + ':1 ends. About ' + e.haul + ' m from the pit to the wall.';
    }
    case 'laser': return qty(e.vol, u) + ' to level for flood irrigation. The design levels say about ' + n0(e.per!) + ' m³ of cut and fill a hectare.';
    case 'channel': return qty(e.vol, u) + ' of supply channel, about ' + e.per + ' m³ of dirt a metre.';
    case 'contour': return qty(e.vol, u) + ' of contour banks across the grazing country, to stop the next storm washing it away.';
    case 'pad': return 'A ' + n0(e.area!) + ' m² pad for a new shed, ' + e.per + ' m of fill from about ' + e.haul + ' m away, rolled and trimmed. Compaction tested.';
    case 'rake': return qty(e.vol, u) + ' of pulled timber to rake into windrows and burn.';
    case 'cutter': return qty(e.vol, u) + ' of regrowth to cutter bar.';
    case 'dev': return qty(e.vol, u) + ' of cut to fill for a new estate, about ' + e.haul + ' m haul. Compaction tested, claims every 4 weeks less 5% retention, ' + e.weeks + ' weeks to finish or damages apply.';
  }
}

/** What the survey is called and what it finds. */
export function surveyLabel(e: Pick<FarmEnquiry, 'kind'>): string {
  return e.kind === 'channel' ? 'Get a geotech to dig test holes' : 'Get it surveyed';
}
export function surveyRisk(e: Pick<FarmEnquiry, 'kind'>): string {
  switch (e.kind) {
    case 'channel': return 'Rock in the cut halves an excavator\'s pace, and nobody knows until you dig.';
    case 'laser': return 'The cut and fill on the plans don\'t always balance: the real work can be 15% under or 25% over.';
    case 'dev': return 'The engineer\'s quantities are usually close. Usually.';
    default: return 'The plans assume flat ground. Paddocks aren\'t flat: the real dirt could be 10% under or 20% over, and you\'re paid for the price, not the dirt.';
  }
}
export function surveyFind(e: FarmEnquiry): string {
  if (e.kind === 'channel') return e.rock ? 'Rock in the cut. Allow for ' + qty(e.survey, 'm') + ' worth of digging.' : 'No rock. About ' + qty(e.survey, 'm') + ' worth of digging.';
  return qty(e.survey, KINDS[e.kind].unit);
}

/** What the kind needs before it can start. */
export function needs(k: BulkKind): string {
  switch (k) {
    case 'laser': return compat.prototype ? 'Scrapers (pull scrapers suit it) and the laser gear, with a grader to trim.' : 'Laser Buckets or scrapers fitted with laser control, a free Laser Gear, and a grader to trim.';
    case 'channel': return 'An excavator.';
    case 'contour': return 'A grader or a dozer.';
    case 'pad': return 'Dirt movers (scrapers, or an excavator and moxies or tippers), a compactor or roller, water and a grader.';
    case 'rake': return 'A dozer and a stick rake.';
    case 'cutter': return 'A D8 or bigger and a cutter bar.';
    default: return 'A dozer, or scrapers (with a dozer to push open-bowl ones), plus a compactor and water.';
  }
}

/** What the slowest part of the spread is, in words. */
export const SLOWEST: Record<string, string> = {
  scrapers: 'the scrapers', dozers: 'the dozers', compactor: 'the compactor', water: 'the water carts', dirt: 'nothing to move dirt',
  trucks: 'the moxies and tippers', excavator: 'the excavator', laser: 'no laser gear', banks: 'the bank builders', rake: 'the dozer on the rake',
  cutter: 'the dozer on the cutter bar',
};

/** The work so far, in a word. */
export function wallWord(q: number): string {
  return q >= 0.85 ? 'good' : q >= 0.7 ? 'fair' : 'poor';
}

/** What a comeback is, by kind. */
export function comeback(k: BulkKind): { title: (farm: string) => string; body: (farm: string, place: string) => string; argue: string } {
  switch (k) {
    case 'contour': return { title: (fm) => fm + '\'s banks broke', body: (fm, pl) => fm + ' rang: the first big storm went straight through two of the contour banks you built near ' + pl + '. Gullies where the banks were.', argue: 'Tell them it was a hundred-year storm' };
    case 'laser': return { title: (fm) => fm + '\'s paddock is ponding', body: (fm, pl) => fm + ' rang: the first irrigation on the paddock you levelled near ' + pl + ' sat in puddles for a week. The crop\'s drowned in patches.', argue: 'Tell them it\'s their siphons' };
    default: return { title: (fm) => fm + '\'s dam is leaking', body: (fm, pl) => fm + ' rang: the dam you built near ' + pl + ' is dropping faster than evaporation, and there\'s a wet patch at the toe of the wall.', argue: 'Tell them it\'s their clay' };
  }
}

/** A grazier by first name and surname (the real game's hard calls). */
const FIRST: Record<string, string> = { Kelly: 'Bev', Hartigan: 'Col', Morrow: 'Jim', Fitzgerald: 'Noel', Lucas: 'Pete', Pearce: 'Trish', Doyle: 'Gary', McCann: 'Ray', Walsh: 'Deb', Brennan: 'Kev' };
export const farmer = (farm: string) => (FIRST[farm] ? FIRST[farm] + ' ' + farm : farm);
export const firstName = (farm: string) => FIRST[farm] ?? farm;

/** The real game's comeback: what you'd show them, and what they reckon. */
export function comebackDoubt(k: BulkKind, farm: string): { show: string; body: string } {
  switch (k) {
    case 'contour': return { show: 'Show ' + firstName(farm) + ' it was a big storm, not your banks', body: 'It was a big storm, and the neighbours lost banks too. ' + firstName(farm) + ' reckons it\'s your work.' };
    case 'laser': return { show: 'Show ' + firstName(farm) + ' the siphons are set wrong', body: 'The siphons look like they\'re running too long. ' + firstName(farm) + ' reckons it\'s your levels.' };
    default: return { show: 'Show ' + firstName(farm) + ' it\'s the cracking and the yabbies', body: 'The top of the wall has cracked in the dry and there are yabby holes along the bank. ' + firstName(farm) + ' reckons it\'s your wall.' };
  }
}

export function damProgress(j: Job): string {
  const u = KINDS[j.dk as BulkKind]?.unit ?? 'm3';
  return qty(Math.min(j.m3 as number, j.truth as number), u) + ' done';
}

/** Diary and docket lines. */
export function bulkLine(e: { k: string; [x: string]: any }, title?: string): string | null {
  const what = (DAM_KIND[e.dk as BulkKind] ?? 'job').toLowerCase();
  switch (e.k) {
    case 'damWon': return e.farm ? e.farm + ' said yes: the ' + what + ' near ' + e.place + ' for ' + f(e.price) + '.' : 'Your price was accepted' + (title ? ': ' + title : '') + '.';
    case 'damLost':
      if (e.who) return (e.farm ?? 'The client') + ' gave the ' + what + (e.place ? ' near ' + e.place : '') + ' to ' + e.who + ' at ' + f(e.wp) + (e.yours ? ' (yours was ' + f(e.yours) + (e.wp > e.yours ? ': they went with who they know' : '') + ')' : '') + '.';
      return (e.farm ?? 'The client') + ' went with someone else' + (e.place ? ' for the ' + what + ' near ' + e.place : '') + '.';
    case 'damLapsed': return (e.farm ?? 'A client') + ' near ' + e.place + ' stopped waiting for your price' + (e.who ? ': ' + e.who + ' got it' : '') + '.';
    case 'damStarted': return 'Started: ' + (title ?? (e.farm + '\'s ' + what + ' near ' + e.place)) + '.';
    case 'damDone': return 'Finished: ' + (title ?? (e.farm + '\'s ' + what + ' near ' + e.place)) + '. ' + f(e.price) + ' all up' + (e.spent != null ? ', ' + f(e.spent) + ' spent on fuel, servicing and casuals.' : '.');
    case 'damGone': return (e.farm ? e.farm + ' got someone else in: the ' + what + ' near ' + e.place + ' never started' : 'A client got someone else in: the job never started') + '. Track record −1.';
    case 'damPassed': return (title ?? 'The job') + ': passed its compaction tests. Track record +1.';
    case 'damFailed': return (title ?? 'The job') + ': failed its compaction tests. ' + f(e.cost) + ' of rework, track record −1.';
    case 'redzoneFound': return 'That scrub you pushed over has come out. A fine of ' + f(e.fine) + ', and track record −3.';
    case 'burnWait': return (title ?? 'The raking') + ': raked, but it\'s fire season. The windrows wait, and so does the money.';
    case 'burnt': return (title ?? 'The raking') + ': windrows burnt. ' + f(e.price) + ' invoiced.';
    case 'devClaim': return 'Claim in' + (title ? ' for ' + title : '') + ': ' + f(e.amt) + ' after retention.';
    case 'devBust': return (e.farm ?? 'The developer') + ' has gone under' + (title ? ' on ' + title : '') + '. ' + f(e.lost) + ' you were owed is gone. The gear\'s back in the yard.';
  }
  return null;
}
