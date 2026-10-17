// Where the gear lives. Room limits the fleet, security sets the odds of a break-in,
// and a workshop cuts service and repair bills.

export type YardId = 'home' | 'fenced' | 'depot' | 'regional' | 'hub';

export interface Yard {
  name: string;
  /** Machines it holds. */
  slots: number;
  /** Weekly rent. */
  rent: number;
  /** One-off cost to move in. */
  setup: number;
  /** Break-in odds, relative to behind the house. */
  theft: number;
  /** Service and repair bills, relative to the dealer's. Below 1 means there's a workshop. */
  svc: number;
  blurb: string;
}

export const YARDS: Record<YardId, Yard> = {
  home:     { name: 'Behind the house', slots: 2, rent: 0, setup: 0, theft: 1, svc: 1, blurb: 'Free, but open to the road. Room for two machines.' },
  fenced:   { name: 'Leased yard, fenced', slots: 4, rent: 250, setup: 4000, theft: 0.4, svc: 1, blurb: 'Lockable gates and lights. Room for four machines.' },
  depot:    { name: 'Depot with workshop', slots: 8, rent: 700, setup: 18000, theft: 0.1, svc: 0.7, blurb: 'Shed, wash bay and workshop. Services and repairs 30% cheaper. Room for eight.' },
  regional: { name: 'Regional depot', slots: 16, rent: 1600, setup: 60000, theft: 0.08, svc: 0.65, blurb: 'Big shed, two service bays and a fitter on site. Services and repairs 35% cheaper. Room for sixteen: two or three full crews.' },
  hub:      { name: 'Plant hub', slots: 32, rent: 3200, setup: 150000, theft: 0.06, svc: 0.6, blurb: 'Two sheds, a wash-down bay and two fitters. Services and repairs 40% cheaper. Room for 32: four or five full crews with trucks.' },
};

/** Smallest to biggest. */
export const YARD_ORDER: readonly YardId[] = ['home', 'fenced', 'depot', 'regional', 'hub'];

export function hasWorkshop(y: YardId): boolean {
  return YARDS[y].svc < 1;
}
