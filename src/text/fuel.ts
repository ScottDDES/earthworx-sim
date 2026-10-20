// The words for bulk fuel and the diesel price.

import type { TankId } from '../fuel';

const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');
const f = (n: number) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-AU');
/** "$2.10 a litre" */
export const perL = (p: number) => '$' + p.toFixed(2) + ' a litre';

export const TANK_NAME: Record<TankId, string> = {
  small: '10,000 litre self-bunded tank',
  mid: '30,000 litre tank and bowser',
  big: '68,000 litre tank, bowser and fuel truck fill point',
};
export const TANK_NEEDS: Record<TankId, string> = {
  small: 'Needs a fenced yard or bigger.',
  mid: 'Needs a depot or bigger.',
  big: 'Needs a regional depot or a plant hub.',
};

/** How long the tank will last, in words. */
export function lastsFor(days: number | null): string {
  if (days == null) return 'No work last week to go by.';
  if (days <= 0) return 'Empty. Work you fuel yourself will stand idle a day waiting on the fuel truck.';
  if (days < 5) return 'About ' + days + ' working day' + (days === 1 ? '' : 's') + ' left: it runs dry this week.';
  if (days < 10) return 'About ' + days + ' working days left at last week\'s rate.';
  return 'About ' + Math.floor(days / 5) + ' weeks left at last week\'s rate.';
}

/** The docket lines for the fuel events. erp is the ERP's name. */
export function fuelLine(e: { k: string; [x: string]: any }, days: readonly string[], erp: string): string | null {
  switch (e.k) {
    case 'fuelIn': return 'A load of diesel came: ' + n0(e.L) + ' litres at ' + perL(e.at) + '.';
    case 'fuelAuto': return 'Your operations manager ordered a load of diesel: ' + n0(e.L) + ' litres at ' + perL(e.at) + '.';
    case 'fuelDry': return 'The fuel tank ran dry on ' + days[e.d] + '. The work you fuel stood idle that day waiting on the fuel truck. Its diesel and call-out came to ' + f(e.cost) + '.';
    case 'fuelStolen': return e.caught
      ? erp + ' flagged the tank dropping overnight. ' + n0(e.L) + ' litres had gone before it was caught.'
      : n0(e.L) + ' litres of diesel went missing from the tank overnight.';
    case 'warOver': return 'The fighting overseas has eased, and diesel is starting to come back down. Loads stay rationed a little longer.';
  }
  return null;
}
