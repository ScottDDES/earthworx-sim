// The real towns a career can start in.

export type TownId = 'gdi' | 'ct';

export interface Town {
  name: string;
  /** Average rain days per month, January first. Used where the game needs the season's odds, not the day's rain. */
  rainDays: readonly number[];
  /**
   * When rain stops work, in mm: [on the day, the day before, two days before].
   * Black soil holds the wet, so Goondiwindi stops for smaller falls the day after.
   */
  stop: readonly [today: number, yesterday: number, twoDaysAgo: number];
  soil: string;
  places: readonly string[];
  council: string;
  blurb: string;
}

export const TOWNS: Record<TownId, Town> = {
  gdi: {
    name: 'Goondiwindi',
    rainDays: [5.0, 5.2, 4.8, 1.9, 3.0, 2.9, 2.6, 2.3, 2.9, 5.2, 5.5, 5.7],
    stop: [4, 10, 25],
    soil: 'Black soil holds the wet: a big fall can stop you for two days after.',
    places: ['Talwood', 'Yelarbon', 'Toobeah', 'Bungunya', 'Billa Billa', 'Kindon'],
    council: 'Goondiwindi council',
    blurb: 'Black-soil plains on the border. Rain spread through the year, heavier in summer.',
  },
  ct: {
    name: 'Charters Towers',
    rainDays: [7.8, 9.3, 5.5, 2.5, 1.4, 1.4, 1.2, 0.8, 0.9, 1.3, 4.0, 5.3],
    stop: [4, 12, 40],
    soil: 'Granite country drains fast: only a heavy fall stops you the next day.',
    places: ['Pentland', 'Greenvale', 'Ravenswood', 'Mingela', 'Basalt', 'Homestead'],
    council: 'Charters Towers council',
    blurb: 'Big country, long hauls. A hard wet season, then months of dry.',
  },
};
