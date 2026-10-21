// The real game's own words for a few things the prototype named differently. The prototype's sentences stay
// word for word; in the real game, the road machine Scott calls a water truck is a water truck (a moxy's is still
// a water cart).

import { compat } from '../compat';

export function rw(t: string): string {
  if (compat.prototype) return t;
  return t.replace(/(?<![Mm]oxy )water cart/g, 'water truck').replace(/(?<![Mm]oxy )Water cart/g, 'Water truck');
}
