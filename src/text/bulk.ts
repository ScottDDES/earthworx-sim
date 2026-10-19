// The words for the Bulk and Ag pack's farm dams.

import type { Job } from '../hire';
import type { DamKind, FarmEnquiry } from '../bulk';

const f = (n: number) => '$' + Math.round(n).toLocaleString('en-AU');
const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');

export const DAM_KIND: Record<DamKind, string> = { ringTank: 'Ring tank', turkeyNest: 'Turkey nest dam' };

/** "Ring tank for Kelly, near Bungunya" */
export function damTitle(x: { dk?: unknown; kind?: string; client?: string; farm?: string; place: string }): string {
  const k = (x.dk ?? x.kind) as DamKind;
  return (DAM_KIND[k] ?? 'Dam') + ' for ' + (x.farm ?? x.client) + ', near ' + x.place;
}

/** The enquiry, as the farmer put it. */
export function enquiryLine(e: FarmEnquiry): string {
  const d = e.dam;
  return d.topLength + ' × ' + d.topWidth + ' m at the top, ' + d.depth + ' m deep, ' + d.sideBatter + ':1 sides and ' + d.endBatter + ':1 ends. About ' + e.haul + ' m from the pit to the wall.';
}

/** The wall so far, in a word. */
export function wallWord(q: number): string {
  return q >= 0.85 ? 'good' : q >= 0.7 ? 'fair' : 'poor';
}

/** What the slowest part of the spread is, in words. */
export const SLOWEST: Record<string, string> = {
  scrapers: 'the scrapers',
  dozers: 'the dozers',
  compactor: 'the compactor',
  water: 'the water carts',
  dirt: 'nothing to move dirt',
};

export function damProgress(j: Job): string {
  const m3 = Math.min(j.m3 as number, j.truth as number);
  return n0(m3) + ' m³ moved';
}

/** Diary and docket lines. */
export function bulkLine(e: { k: string; [x: string]: any }, title?: string): string | null {
  switch (e.k) {
    case 'damWon': return e.farm ? e.farm + ' said yes: the ' + (DAM_KIND[e.dk as DamKind] ?? 'dam').toLowerCase() + ' near ' + e.place + ' for ' + f(e.price) + '.' : 'A farmer said yes to your price' + (title ? ': ' + title : '') + '.';
    case 'damLost': return (e.farm ?? 'The farmer') + ' went with someone else for the dam near ' + e.place + '.';
    case 'damLapsed': return (e.farm ?? 'A farmer') + ' near ' + e.place + ' stopped waiting for your price.';
    case 'damStarted': return 'The spread is on ' + (title ?? (e.farm + '\'s dam near ' + e.place)) + '.';
    case 'damDone': return (title ?? (e.farm + '\'s dam near ' + e.place)) + ' is finished: ' + n0(e.m3) + ' m³ moved, against ' + n0(e.est) + ' priced. ' + f(e.price) + ' invoiced' + (e.spent != null ? ', ' + f(e.spent) + ' spent on fuel, servicing and casuals.' : '.');
    case 'damPassed': return (title ?? 'The wall') + ': passed its compaction tests. Track record +1.';
    case 'damFailed': return (title ?? 'The wall') + ': failed its compaction tests. ' + f(e.cost) + ' of rework, track record −1.';
    case 'redzoneFound': return 'That scrub you pushed over has come out. A fine of ' + f(e.fine) + ', and track record −3.';
    case 'damGone': return (e.farm ? e.farm + ' got someone else in: nobody turned up to start the dam near ' + e.place : 'A farmer got someone else in: the dam never started') + '. Track record −1.';
  }
  return null;
}
