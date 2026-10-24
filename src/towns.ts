// The real towns a career can start in. Goondiwindi and Charters Towers came from the prototype; the rest of
// Queensland came after (Scott, 24 Oct), each with 30 years of its own real rain.

export type TownId = 'gdi' | 'ct' | 'stg' | 'dby' | 'emd' | 'mbh' | 'mky' | 'isa' | 'wei';

/** How much of each kind of work a town has: 1 is the old towns' share, 0 is none. */
export interface TownWork {
  /** Farm and dam calls. */
  farm: number;
  /** Mines ringing about big gear. */
  mine: number;
  /** Feedlot companies and cotton growers ringing about developments (the real game). */
  feed: number;
  cotton: number;
}

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
  /** Latitude and longitude, for distances between towns. */
  ll: readonly [number, number];
  work: TownWork;
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
    ll: [-28.55, 150.31],
    work: { farm: 1, mine: 1, feed: 0.6, cotton: 1 },
  },
  ct: {
    name: 'Charters Towers',
    rainDays: [7.8, 9.3, 5.5, 2.5, 1.4, 1.4, 1.2, 0.8, 0.9, 1.3, 4.0, 5.3],
    stop: [4, 12, 40],
    soil: 'Granite country drains fast: only a heavy fall stops you the next day.',
    places: ['Pentland', 'Greenvale', 'Ravenswood', 'Mingela', 'Basalt', 'Homestead'],
    council: 'Charters Towers council',
    blurb: 'Big country, long hauls. A hard wet season, then months of dry.',
    ll: [-20.08, 146.26],
    work: { farm: 1, mine: 1, feed: 0.2, cotton: 0 },
  },
  stg: {
    name: 'St George',
    rainDays: [4.9, 5.0, 3.9, 2.2, 2.9, 3.3, 2.8, 2.5, 2.7, 4.2, 5.4, 5.3],
    stop: [4, 10, 25],
    soil: 'Grey and black clays on the river flats hold the wet for days.',
    places: ['Dirranbandi', 'Thallon', 'Nindigully', 'Bollon', 'Hebel', 'Mungindi'],
    council: 'Balonne council',
    blurb: 'Irrigation country on the Balonne. The driest of the cotton towns: farm work, big storages, laser fields.',
    ll: [-28.04, 148.58],
    work: { farm: 1.4, mine: 0, feed: 0.3, cotton: 1.5 },
  },
  dby: {
    name: 'Dalby',
    rainDays: [6.5, 6.6, 5.0, 2.7, 3.4, 3.7, 3.1, 2.8, 3.4, 5.9, 6.9, 7.8],
    stop: [4, 10, 25],
    soil: 'Deep black soil on the Downs: a wet week can stop you for days after.',
    places: ['Jandowae', 'Bell', 'Jimbour', 'Kogan', 'Cecil Plains', 'Warra'],
    council: 'Western Downs council',
    blurb: 'The Western Downs. Grain, feedlots and gas fields, and steady rain through the summer.',
    ll: [-27.18, 151.26],
    work: { farm: 1.2, mine: 0.6, feed: 1.5, cotton: 0.6 },
  },
  emd: {
    name: 'Emerald',
    rainDays: [7.2, 7.3, 4.7, 2.8, 2.4, 2.7, 2.1, 2.0, 1.9, 3.4, 5.7, 6.5],
    stop: [4, 12, 30],
    soil: 'Black clay on the irrigation, harder ground in the ranges.',
    places: ['Capella', 'Comet', 'Gindie', 'Anakie', 'Rubyvale', 'Blackwater'],
    council: 'Central Highlands council',
    blurb: 'The Central Highlands. Irrigated cotton below the dam, coal mines to the east.',
    ll: [-23.53, 148.16],
    work: { farm: 1, mine: 1.4, feed: 0.5, cotton: 1.3 },
  },
  mbh: {
    name: 'Moranbah',
    rainDays: [8.2, 8.1, 5.5, 3.3, 2.2, 2.2, 1.9, 1.5, 1.1, 3.0, 5.5, 7.3],
    stop: [4, 12, 35],
    soil: 'Black soil in coal country: the haul roads turn to grease in the wet.',
    places: ['Coppabella', 'Glenden', 'Dysart', 'Middlemount', 'Clermont', 'Nebo'],
    council: 'Isaac council',
    blurb: 'Bowen Basin coal. The mines want big gear, late-model and low-hour. Little farm work.',
    ll: [-22.0, 148.05],
    work: { farm: 0.5, mine: 2.5, feed: 0.1, cotton: 0 },
  },
  mky: {
    name: 'Mackay',
    rainDays: [15.8, 16.5, 14.3, 11.8, 9.0, 6.7, 3.9, 3.5, 3.1, 5.6, 9.0, 11.6],
    stop: [5, 15, 40],
    soil: 'Coastal cane country. Sandy loams drain, but it rains more here than anywhere else in the game.',
    places: ['Sarina', 'Walkerston', 'Mirani', 'Eton', 'Seaforth', 'Finch Hatton'],
    council: 'Mackay council',
    blurb: 'Cane farms on the coast and the service town for the coal mines. The wettest town in the game.',
    ll: [-21.14, 149.19],
    work: { farm: 1, mine: 0.8, feed: 0, cotton: 0 },
  },
  isa: {
    name: 'Mount Isa',
    rainDays: [9.7, 7.3, 4.6, 1.1, 0.9, 0.9, 0.5, 0.4, 0.7, 1.9, 4.4, 6.1],
    stop: [4, 10, 30],
    soil: 'Rock and gravel ridges drain fast. The wet is short, the dry is long and hot.',
    places: ['Cloncurry', 'Camooweal', 'Dajarra', 'Duchess', 'Kajabbi', 'Lake Moondarra'],
    council: 'Mount Isa council',
    blurb: 'Hard-rock mining in the north-west. Long road programs and long floats: everything is a long way.',
    ll: [-20.73, 139.49],
    work: { farm: 0.4, mine: 2, feed: 0, cotton: 0 },
  },
  wei: {
    name: 'Weipa',
    rainDays: [26.1, 24.8, 23.5, 10.2, 2.1, 0.6, 0.3, 0.4, 0.7, 2.6, 8.6, 19.7],
    stop: [5, 15, 40],
    soil: 'Red sand and bauxite drain fast, but in the wet it rains nearly every day.',
    places: ['Napranum', 'Mapoon', 'Aurukun', 'Coen', 'Archer River', 'Batavia Downs'],
    council: 'Weipa council',
    blurb: 'Bauxite on Cape York. Road work only in the dry: from December to April the rain stops nearly everything.',
    ll: [-12.63, 141.88],
    work: { farm: 0.15, mine: 2, feed: 0, cotton: 0 },
  },
};

/** Kilometres between two towns, as the crow flies. */
export function townKm(a: TownId, b: TownId): number {
  const [la1, lo1] = TOWNS[a].ll, [la2, lo2] = TOWNS[b].ll, r = Math.PI / 180;
  const h = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}
