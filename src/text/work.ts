// Words for work: offers, jobs and tenders, built from the engine's data the way the prototype wrote them.

import { CLIENTS, type Job, type Offer } from '../hire';
import { TYPES } from '../machines';
import { compat } from '../compat';
import { damTitle } from './bulk';
import { CLIENT_PM } from '../relations';
import type { SubTender } from '../tenders';
import type { CouncilTender } from '../planning';

const money = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');

export const KIND_LABEL: Record<string, string> = { wet: 'WET HIRE', dry: 'DRY HIRE', council: 'COUNCIL', private: 'PRIVATE', sub: 'SUBCONTRACT', own: 'COUNCIL CONTRACT', bulk: 'BULK AND AG' };
export const KIND_CHIP: Record<string, string> = { wet: 'c-dark', council: 'c-rain', dry: 'c-idle', private: 'c-job', sub: 'c-dark', own: 'c-rain', bulk: 'c-job' };

/** A private client is "Shed pad, Talwood": the job, then the place. */
function privateParts(client: string): [string, string] {
  const i = client.lastIndexOf(', ');
  return i < 0 ? [client, ''] : [client.slice(0, i), client.slice(i + 2)];
}

export function offerTitle(o: Pick<Offer, 'kind' | 'type' | 'client'>): string {
  const T = TYPES[o.type];
  if (o.kind === 'wet') return T.name + ' + operator, for ' + o.client;
  if (o.kind === 'dry') return T.name + ' only, to ' + o.client;
  if (o.kind === 'council') return o.type === 'grader' ? 'Maintenance grading, day labour' : 'Pushing up gravel at the council pit';
  const [what, place] = privateParts(o.client);
  return what + ' near ' + place;
}

const PIT_WORD = ['soft ripping', 'firm ripping', 'hard rock, slow going'];
const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');

export function offerDetail(o: Offer): string {
  if (o.kind === 'wet') return o.days + ' working days on a flood recovery job near ' + o.place + '. They supply fuel.';
  if (o.kind === 'dry') return o.enq ? o.days + ' weeks near ' + o.place + '. They rang about your ' + TYPES[o.type].short + '. Their operator, your machine.' : o.days + ' weeks near ' + o.place + '. Their operator, your machine. You stay free.';
  if (o.kind === 'council' && o.gravel) return n0(o.gravel) + ' m³ to rip and stockpile at the pit near ' + o.place + ', ' + PIT_WORD[o.rock ?? 0] + '. Needs a ' + TYPES[o.type].short + (o.type === 'd10' ? '' : ' or bigger') + '. About ' + o.days + ' working days.';
  if (o.kind === 'council') return o.type === 'grader' ? 'Rural roads around ' + o.place + ', ' + o.days + ' working days.' : 'Ripping and stockpiling gravel at the pit near ' + o.place + ' for the road crews, ' + o.days + ' working days.';
  return o.days + ' working days, fixed price. Cash a week after you finish.';
}

export function offerCatch(o: Offer): string {
  if (o.kind === 'wet') return o.client + ' pays at ' + o.terms * 7 + ' days.' + ((CLIENTS[o.client]?.late ?? 0) > 0.3 ? ' Known for paying late.' : '');
  if (o.kind === 'dry') return 'Their operator, your wear: about twice the usual. Paid at ' + o.terms * 7 + ' days.';
  if (o.kind === 'council') return compat.prototype ? 'Pays in 14 days. You supply fuel. Counts double toward your track record.'
    : 'Pays in 14 days. You supply fuel, about ' + money(TYPES[o.type].fuel) + ' a day, so ' + money(o.rate! - TYPES[o.type].fuel) + ' a day after fuel. Counts double toward your track record.';
  return 'Fixed price: rain days are on you.' + (o.needsRoller ? ' Needs a roller too: ' + money(TYPES.roller.dry) + ' a week to hire one if you don\'t own one.' : '');
}

export function offerPay(o: Offer): string {
  if (o.kind === 'dry') return money(o.rate!) + '/wk';
  if (o.kind === 'private') return money(o.fixed!);
  return money(o.rate!) + '/day';
}

export function subTenderTitle(t: Pick<SubTender, 'place' | 'L'>): string {
  return t.place + ' Road, ' + t.L + ' km';
}

export function councilTitle(t: CouncilTender): string {
  if (!t.major) return 'Flood works package: ' + t.roads.length + ' roads, ' + t.km + ' km';
  return (t.prestige ? 'State road program: ' + t.area + ' area, the whole lot' : 'Flood recovery program: ' + t.area + ' area' + ((t.lots ?? 1) > 1 ? ', lot ' + t.lot + ' of ' + t.lots : '')) + ' · ' + t.roads.length + ' roads, ' + t.km + ' km';
}

/** What a job's called on screen. */
export function jobTitle(j: Job): string {
  const n = j.nm;
  if (j.kind === 'bulk') return damTitle(j as never);
  if (j.kind === 'sub') return j.place + ' Road' + (n?.L != null ? ', ' + n.L + ' km' : '') + ' for ' + j.client;
  if (j.kind === 'own') {
    if (!n) return (j.major ? 'Flood recovery program' : 'Flood works package') + ' from ' + j.place;
    const tail = ' · ' + n.roads + ' roads, ' + n.km + ' km';
    if (!j.major) return 'Flood works package: ' + n.roads + ' roads, ' + n.km + ' km';
    return (j.prestige ? 'State road program: ' + n.area + ' area, the whole lot' : 'Flood recovery program: ' + n.area + ' area' + ((n.lots ?? 1) > 1 ? ', lot ' + n.lot + ' of ' + n.lots : '')) + tail;
  }
  return offerTitle(j as never);
}

/** A head contractor's opinion of you, in a word. */
export const TIER_NAME: Record<string, string> = { pref: 'Preferred', good: 'Good', ok: 'Neutral', wary: 'Wary', out: 'On the outer' };

export function pmOf(hc: string): string {
  return CLIENT_PM[hc] || hc;
}
