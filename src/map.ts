// The district map: every road in the shire, damaged or sound, and who's working on it.
// Goondiwindi's roads are generated from four real areas (the same roads every time, with invented names);
// Charters Towers places its roads around real localities.

import type { Mood } from './market';
import { hashN, pick, seedRand, type Rand } from './rng';
import type { TownId } from './towns';

/** Per area: total km, number of roads, the box they sit in (km from town), typical and longest road, gravel pits. */
export const AREA_SPEC: Record<string, { km: number; n: number; box: [number, number, number, number]; med: number; max: number; pits: number }> = {
  Talwood: { km: 318, n: 26, box: [-130, -53, -19, 52], med: 7, max: 42, pits: 19 },
  Toobeah: { km: 86, n: 14, box: [-70, -18, -3, 65], med: 5.6, max: 21, pits: 5 },
  Yelarbon: { km: 198, n: 42, box: [-11, 61, -7, 85], med: 2.7, max: 20, pits: 14 },
  Texas: { km: 167, n: 41, box: [47, 129, -64, 35], med: 2.6, max: 21, pits: 21 },
};

const RD_SUR = ['Hartigan', 'Maloney', 'Keogh', 'Pritchard', 'Dunleavy', 'Gallagher', 'Sorensen', 'Cullen', 'Brosnan', 'Treloar', 'Ashby', 'Pennell', 'Rowntree', 'Kinsella', 'Muldoon', 'Haddow', 'Lockyer', 'Fennell', 'Garside', 'Tulloch', 'Bramble', 'Corrigan', 'Dwyer', 'Esson', 'Forsyth', 'Gillam', 'Heffernan', 'Ingles', 'Jessop', 'Kerrigan', 'Lumsden', 'McGarry', 'Nesbitt', 'Ogilvie', 'Pask', 'Quinlan', 'Renwick', 'Spurling', 'Tasker', 'Vallance', 'Whitworth', 'Yeoman', 'Cosgrove', 'Darcy', 'Ellery', 'Furner', 'Gorman', 'Hollis'];
const RD_FEAT = ['Coolabah', 'Brigalow', 'Wilga', 'Gidgee', 'Yarran', 'Belah', 'Box Flat', 'Ironbark', 'Myall', 'Kurrajong', 'Bimble', 'Black Swamp', 'Five Mile', 'Ten Mile', 'Sandy Creek', 'Dry Creek', 'Stony Creek', 'Gum Flat', 'Woolshed', 'Stockyard', 'Tank', 'Bore', 'Settlers', 'Selectors', 'Old Station', 'Boundary', 'Wattle', 'Saltbush', 'Bluegrass', 'Lignum', 'Billabong', 'Redbank', 'Cattle Camp', 'Bottle Tree', 'Emu Plain', 'Pelican', 'Spring Gully'];

/** A road in an area's schedule: name, heavy and medium formation grading (km), gravel (m³), haul (km), x, y. */
export type AreaRoad = [string, number, number, number, number, number, number];
export interface Area {
  roads: AreaRoad[];
  /** Gravel pits: name, haul (km). */
  pits: [string, number][];
}

/** Generates an area's roads and pits. Seeded by the area's name, so it's the same every time. */
export function genArea(name: string, sp: (typeof AREA_SPEC)[string]): Area {
  const R = seedRand(hashN(name + '-district-1'));
  const pk = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)]!;
  const used: Record<string, number> = {}, roads: AreaRoad[] = [], pits: [string, number][] = [];
  const cs = [0, 1, 2].map(() => [sp.box[0] + R() * (sp.box[1] - sp.box[0]), sp.box[2] + R() * (sp.box[3] - sp.box[2])] as [number, number]);
  const nm = (suffix: string): string => {
    for (let g = 0; g < 60; g++) {
      const x = R();
      let n = x < 0.5 ? pk(RD_SUR) : x < 0.8 ? pk(RD_FEAT) : pk(RD_FEAT) + ' ' + pk(RD_SUR);
      n += suffix;
      if (!used[n]) {
        used[n] = 1;
        return n;
      }
    }
    return pk(RD_SUR) + ' No. ' + roads.length + suffix;
  };
  for (let i = 0; i < sp.n; i++) {
    // road lengths are log-normal around the area's typical length
    const z = Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R());
    let L = Math.max(0.4, Math.min(sp.max, Math.exp(Math.log(sp.med) + 0.9 * z)));
    L = Math.round(L * 10) / 10;
    const mfg = R() < 0.05 ? Math.round(L * 0.4 * 10) / 10 : 0, hfg = Math.round((L - mfg) * 10) / 10;
    const m3 = R() < 0.1 ? Math.round(L * R() * 60) : Math.round(L * (230 + R() * 130));
    const haul = R() < 0.15 ? 0 : Math.max(1, Math.round(R() < 0.1 ? 25 + R() * 30 : 2 + R() * 20));
    const c = pk(cs), x = Math.max(sp.box[0], Math.min(sp.box[1], c[0] + (R() - 0.5) * 40)), y = Math.max(sp.box[2], Math.min(sp.box[3], c[1] + (R() - 0.5) * 40));
    roads.push([nm(' Rd'), hfg, mfg, m3, haul, Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  }
  // Scale to the area's total length so programs come out the usual size.
  const tot = roads.reduce((a, x) => a + x[1] + x[2], 0), sc = sp.km / Math.max(1, tot);
  for (const x of roads) {
    x[1] = Math.round(x[1] * sc * 10) / 10;
    x[2] = Math.round(x[2] * sc * 10) / 10;
    x[3] = Math.round(x[3] * sc);
  }
  for (let k = 0; k < sp.pits; k++) pits.push([nm(' Pit').replace(' Rd', ''), Math.max(0, Math.round(R() < 0.12 ? 30 + R() * 35 : R() * 22))]);
  return { roads, pits };
}

/** Goondiwindi's four areas, generated once. */
export const BOQ: Record<string, Area> = Object.fromEntries(Object.keys(AREA_SPEC).map((k) => [k, genArea(k, AREA_SPEC[k]!)]));

export const CT_ROADS = ['Lolworth', 'Hillgrove', 'Burdekin Falls', 'Fletcher Creek', 'Seventy Mile', 'Bluff Downs', 'Lyndhurst', 'Wando Vale', 'Clarke River', 'Gainsford', 'Mt Emu Plains', 'Torrens Creek', 'Balfes Creek', 'Pentland', 'Greenvale', 'Ravenswood', 'Mingela', 'Basalt', 'Homestead', 'Dreghorn', 'Kirk River', 'Cape River', 'Sellheim', 'Reedy Springs', 'Mosgiel', 'Blue Range', 'Glendon', 'Pajingo', 'Myrtle Vale', 'Natal Downs'];
export const CT_PITS = ['Lolworth Pit', 'Fletcher Ck Pit', 'Basalt Pit', 'Sellheim Pit', 'Reedy Springs Pit', 'Kirk River Pit', 'Mingela Pit', 'Cape River Pit'];

/** The other towns' roads and pits, the way Charters Towers does it: names around the real district, placed near its localities. */
export const ROADS: Record<Exclude<TownId, 'gdi'>, readonly string[]> = {
  ct: CT_ROADS,
  stg: ['Bollon', 'Nindigully', 'Thallon', 'Hebel', 'Dirranbandi', 'Boolba', 'Wagoo', 'Ballandool', 'Noondoo', 'Bullamon', 'Whyenbah', 'Wycombe', 'Bonanza', 'Teelba', 'Weribone', 'Glenearn', 'Cubbie', 'Bendee', 'Euraba', 'Narran', 'Wallam', 'Kooroon', 'Yarrabee', 'Balonne River', 'Moonie River', 'Culgoa', 'Bokhara', 'Mourabie', 'Begonia', 'Fernlee'],
  dby: ['Jandowae', 'Bell', 'Jimbour', 'Kogan', 'Cecil Plains', 'Warra', 'Macalister', 'Kaimkillenbun', 'Diamondy', 'Bunya Mountains', 'Irvingdale', 'Ducklo', 'Nandi', 'Ranges Bridge', 'Myall Creek', 'Kumbarilla', 'Moonie', 'Western Creek', 'Daandine', 'Kupunn', 'Grassdale', 'Tipton', 'Pirrinuan', 'Marnhull', 'Blaxland', 'Jinghi', 'Greenswamp', 'Cooranga', 'Brigalow Creek', 'St Ruth'],
  emd: ['Capella', 'Comet', 'Gindie', 'Anakie', 'Rubyvale', 'Sapphire', 'Willows', 'Theresa Creek', 'Selma', 'Codenwarra', 'Fernlees', 'Yamala', 'Lochington', 'Retro', 'Cotherstone', 'Wyuna', 'Nogoa', 'Retreat Creek', 'Glenprairie', 'Orion Downs', 'Arcturus', 'Mackenzie River', 'Craven', 'Hibernia', 'Weemah', 'Bonnie Doon', 'Corona', 'Clermont Gap', 'Lake Maraboon', 'Duckworth'],
  mbh: ['Coppabella', 'Glenden', 'Dysart', 'Middlemount', 'Clermont', 'Nebo', 'Peak Downs', 'Isaac River', 'Suttor', 'Denham', 'Lake Elphinstone', 'Kilcummin', 'Carmichael', 'Burton Gorge', 'Logan Creek', 'Saraji', 'Valkyrie', 'Winchester', 'Eaglefield', 'Lenton Downs', 'Fort Cooper', 'Mt Coolon', 'Bundarra', 'Phillips Creek', 'Cherwell', 'Grasstree', 'Annandale', 'Retreat', 'Moorvale', 'Strathmore'],
  mky: ['Sarina', 'Walkerston', 'Mirani', 'Eton', 'Seaforth', 'Finch Hatton', 'Marian', 'Habana', 'Calen', 'Kuttabul', 'Owens Creek', 'Gargett', 'Pinnacle', 'Netherdale', 'Septimus', 'Victoria Plains', 'Homebush', 'Oakenden', 'Koumala', 'Alligator Creek', 'Balberra', 'Sunnyside', 'Kinchant Dam', 'Hampden', 'Mount Ossa', 'Sandy Creek', 'Eungella', 'Palmyra', 'Farleigh', 'Pleystowe'],
  isa: ['Cloncurry', 'Camooweal', 'Dajarra', 'Duchess', 'Kajabbi', 'Mary Kathleen', 'Gunpowder', 'Lady Loretta', 'Yelvertoft', 'Selwyn', 'Malbon', 'Corella', 'Mount Guide', 'Calton Hills', 'Barkly', 'Buckley River', 'Lake Julius', 'Paroo Creek', 'Leichhardt', 'Rifle Creek', 'Gidgee', 'Chatsworth', 'Ardmore', 'Kalkadoon', 'Fountain Springs', 'Quamby', 'Toby', 'Mica Creek', 'Sybella', 'Waverley'],
  wei: ['Napranum', 'Mapoon', 'Aurukun', 'Coen', 'Archer River', 'Batavia Downs', 'Moreton', 'Embley', 'Mission River', 'Pennefather', 'Wenlock', 'Peninsula', 'Watson River', 'Merluna', 'York Downs', 'Wolverton', 'Holroyd', 'Kendall', 'Ducie', 'Myall Lagoon', 'Port Musgrave', 'Andoom', 'Hey Point', 'Pine River', 'Wallaby Island', 'Sudley', 'Weipa South', 'Lorim Point', 'Camisaderra', 'Rocky Point'],
};
export const PITS: Record<Exclude<TownId, 'gdi'>, readonly string[]> = {
  ct: CT_PITS,
  stg: ['Bollon Pit', 'Boolba Pit', 'Nindigully Pit', 'Hebel Pit', 'Wagoo Pit', 'Bendee Pit', 'Begonia Pit', 'Teelba Pit'],
  dby: ['Kogan Pit', 'Jimbour Pit', 'Warra Pit', 'Kumbarilla Pit', 'Bell Pit', 'Diamondy Pit', 'Tipton Pit', 'Daandine Pit'],
  emd: ['Anakie Pit', 'Gindie Pit', 'Capella Pit', 'Comet Pit', 'Selma Pit', 'Retro Pit', 'Orion Pit', 'Willows Pit'],
  mbh: ['Coppabella Pit', 'Dysart Pit', 'Nebo Pit', 'Suttor Pit', 'Denham Pit', 'Saraji Pit', 'Kilcummin Pit', 'Burton Pit'],
  mky: ['Sarina Pit', 'Marian Pit', 'Calen Pit', 'Oakenden Pit', 'Koumala Pit', 'Gargett Pit', 'Hampden Pit', 'Mirani Pit'],
  isa: ['Dajarra Pit', 'Duchess Pit', 'Kajabbi Pit', 'Gunpowder Pit', 'Selwyn Pit', 'Malbon Pit', 'Corella Pit', 'Mica Creek Pit'],
  wei: ['Napranum Pit', 'Mapoon Pit', 'Embley Pit', 'Moreton Pit', 'Wenlock Pit', 'Merluna Pit', 'Batavia Pit', 'Andoom Pit'],
};

/** Where each locality sits on the map (km from town). */
export const PLACE_POS: Record<TownId, Record<string, [number, number]>> = {
  gdi: { Talwood: [-101, 16], Toobeah: [-45, 31], Yelarbon: [23, 31], Texas: [88, -7], Bungunya: [-75, 40], 'Billa Billa': [-10, 55], Kindon: [-55, 55] },
  ct: { Pentland: [-105, -10], Homestead: [-60, 5], Basalt: [-10, 60], Greenvale: [-45, 140], Ravenswood: [75, 40], Mingela: [55, 62] },
  stg: { Dirranbandi: [-34, -60], Thallon: [28, -65], Nindigully: [24, -34], Bollon: [-108, 1], Hebel: [-76, -103], Mungindi: [39, -104] },
  dby: { Jandowae: [-15, 44], Bell: [19, 28], Jimbour: [-5, 24], Kogan: [-49, 16], 'Cecil Plains': [-7, -39], Warra: [-34, 28] },
  emd: { Capella: [-14, 50], Comet: [40, -8], Gindie: [-3, -23], Anakie: [-42, -2], Rubyvale: [-47, 12], Blackwater: [73, -6] },
  mbh: { Coppabella: [26, 7], Glenden: [6, 72], Dysart: [31, -65], Middlemount: [67, -90], Clermont: [-42, -91], Nebo: [66, 36] },
  mky: { Sarina: [3, -31], Walkerston: [-13, -2], Mirani: [-34, -2], Eton: [-23, -13], Seaforth: [-23, 27], 'Finch Hatton': [-58, 0] },
  isa: { Cloncurry: [106, 2], Camooweal: [-142, 90], Dajarra: [2, -107], Duchess: [39, -70], Kajabbi: [56, 78], 'Lake Moondarra': [7, 17] },
  wei: { Napranum: [1, -6], Mapoon: [2, 73], Aurukun: [-16, -80], Coen: [143, -145], 'Archer River': [115, -90], 'Batavia Downs': [87, -3] },
};

/** dmg: flood damaged · work: your crews · done: fixed by you · rw: a rival's crews · rd: fixed by someone else · ok: sound */
export type RoadState = 'dmg' | 'work' | 'done' | 'rw' | 'rd' | 'ok';

export interface MapRoad {
  id: string;
  n: string;
  x: number;
  y: number;
  L: number;
  area: string;
  /** Angle it's drawn at. */
  a: number;
  st: RoadState;
  jobId?: string | null;
  by?: string | null;
  w?: number;
  until?: number;
}

export interface DistrictMap {
  roads: MapRoad[];
  gen: number;
  /** Week the last flood recovery event was declared. */
  event?: number;
}

/** The parts of a career the map touches. */
export interface MapHolder {
  town: TownId;
  week: number;
  dmap?: DistrictMap;
  jobs: { id: string; kind: string; finished?: boolean; place: string; mapIds?: string[]; g0?: number; [x: string]: unknown }[];
}

/**
 * The district map, made the first time anything needs it. Making it rolls which roads start damaged (60%),
 * so it must be made at the same point in the career every time (the career's start does it).
 */
export function dmap(rand: Rand, st: MapHolder): DistrictMap {
  if (st.dmap) return st.dmap;
  const roads: MapRoad[] = [];
  if (st.town === 'gdi') {
    for (const k of Object.keys(BOQ)) for (const x of BOQ[k]!.roads) roads.push({ n: x[0], x: x[5] || 0, y: x[6] || 0, L: Math.max(0.5, Math.round((x[1] + x[2]) * 10) / 10), area: k } as MapRoad);
  } else {
    const town = st.town as Exclude<TownId, 'gdi'>, pl = Object.keys(PLACE_POS[town]);
    ROADS[town].forEach((nm, i) => {
      const P = PLACE_POS[town][pl[i % pl.length]!]!, h = hashN(nm);
      roads.push({ n: nm + ' Rd', x: P[0] + ((h % 50) - 25), y: P[1] + (((h >> 6) % 40) - 20), L: 3 + (h % 20), area: pl[i % pl.length]! } as MapRoad);
    });
  }
  roads.forEach((rd, i) => {
    rd.id = 'r' + i;
    rd.a = ((hashN(rd.n) % 180) * Math.PI) / 180;
    rd.st = rand() < 0.6 ? 'dmg' : 'ok';
  });
  st.dmap = { roads, gen: 1 };
  // Contracts already running get roads on the map too.
  for (const j of st.jobs) {
    if ((j.kind === 'sub' || j.kind === 'own') && !j.finished && !j.mapIds) {
      const P = placePos(st.town, j.place);
      mapWork(st.dmap, pickRoads(st.dmap, P[0], P[1], j.kind === 'own' ? Math.max(5, j.g0 || 8) : 8), j);
    }
  }
  return st.dmap;
}

export function mapRoad(M: DistrictMap, id: string): MapRoad | undefined {
  return M.roads.find((x) => x.id === id);
}

/** Where a place sits; somewhere we don't know lands on a known place, picked by its name. */
export function placePos(town: TownId, n: string): [number, number] {
  const P = PLACE_POS[town] || {};
  if (P[n]) return P[n]!;
  const k = Object.keys(P);
  return k.length ? P[k[hashN(n || 'x') % k.length]!]! : [0, 0];
}

/** Damaged roads nearest a spot, enough to make up about km (at most 12 roads). */
export function pickRoads(M: DistrictMap, cx: number, cy: number, km: number): string[] {
  let free = M.roads.filter((x) => x.st === 'dmg');
  if (free.length < 3) free = M.roads.filter((x) => x.st !== 'work' && x.st !== 'rw');
  free.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const out: string[] = [];
  let tot = 0;
  for (let i = 0; i < free.length && (tot < km * 0.8 || !out.length) && out.length < 12; i++) {
    out.push(free[i]!.id);
    tot += free[i]!.L;
  }
  return out;
}

/** Your crews go on these roads. */
export function mapWork(M: DistrictMap, ids: string[] | undefined, j: { id: string; mapIds?: string[] }): void {
  for (const id of ids || []) {
    const x = mapRoad(M, id);
    if (x) {
      x.st = 'work';
      x.jobId = j.id;
    }
  }
  j.mapIds = (ids || []).slice();
}

/** Your crews come off: fixed if the job finished, back to damaged if it was cut short. */
export function mapDone(M: DistrictMap, ids: string[] | undefined, ok: boolean, week: number): void {
  for (const id of ids || []) {
    const x = mapRoad(M, id);
    if (!x || x.st !== 'work') continue;
    x.jobId = null;
    if (ok) {
      x.st = 'done';
      x.by = 'you';
      x.w = week;
    } else x.st = 'dmg';
  }
}

/** A rival won these roads: their crews are on them for the job's weeks (at least 2). */
export function mapRival(M: DistrictMap, ids: string[] | undefined, who: string, wks: number, week: number): void {
  for (const id of ids || []) {
    const x = mapRoad(M, id);
    if (x && x.st !== 'work' && x.st !== 'done') {
      x.st = 'rw';
      x.by = who;
      x.until = week + Math.max(2, wks || 8);
    }
  }
}

export type MapEvent = { k: 'floodEvent'; roads: number } | { k: 'roadsCut'; roads: number; mine: number; mm: number };

/**
 * The map's week. Rivals finish what they won; other contractors chip away at the damage; sound roads wear
 * out now and then, more after a wet week. When the money arrives in a boom (at most once a year), a new
 * flood recovery event puts a third of the sound roads back on the damage list. 90 mm in a week cuts 12% of them.
 * mm is the week's rain.
 */
export function mapWeek(rand: Rand, M: DistrictMap, week: number, fmul: number, mood: Mood, mm: number, rivalNames: string[], events: MapEvent[]): void {
  for (const x of M.roads) {
    if (x.st === 'rw' && (x.until ?? 0) <= week) {
      x.st = 'rd';
      x.w = week;
    } else if (x.st === 'dmg' && rand() < 0.002 * fmul) {
      x.st = 'rd';
      x.by = rivalNames.length ? pick(rand, rivalNames) : 'Another contractor';
      x.w = week;
    } else if ((x.st === 'done' || x.st === 'rd' || x.st === 'ok') && mm < 90 && rand() < 0.002 + (mm >= 30 ? mm / 2500 : 0)) {
      x.st = 'dmg';
      x.by = null;
    }
  }
  if (mood === 'boom' && week - (M.event ?? -99) >= 52) {
    M.event = week;
    let ev = 0;
    for (const x of M.roads) {
      if ((x.st === 'done' || x.st === 'rd' || x.st === 'ok') && rand() < 0.35) {
        x.st = 'dmg';
        x.by = null;
        ev++;
      }
    }
    if (ev) events.push({ k: 'floodEvent', roads: ev });
  }
  if (mm >= 90) {
    let hit = 0, mine = 0;
    for (const x of M.roads) {
      if ((x.st === 'done' || x.st === 'rd' || x.st === 'ok') && rand() < 0.12) {
        if (x.st === 'done') mine++;
        x.st = 'dmg';
        x.by = null;
        hit++;
      }
    }
    if (hit) events.push({ k: 'roadsCut', roads: hit, mine, mm });
  }
}

export interface MapStats {
  total: number;
  dmg: number;
  work: number;
  rw: number;
  mine: number;
  mineKm: number;
  /** Share of the district that's sound or fixed, %. */
  pct: number;
}

export function mapStats(M: DistrictMap): MapStats {
  const by = (st: RoadState) => M.roads.filter((x) => x.st === st), mine = by('done');
  const hurt = M.roads.filter((x) => x.st === 'dmg' || x.st === 'work' || x.st === 'rw').length;
  return { total: M.roads.length, dmg: by('dmg').length, work: by('work').length, rw: by('rw').length, mine: mine.length,
    mineKm: Math.round(mine.reduce((a, x) => a + x.L, 0)), pct: Math.round((1 - hurt / M.roads.length) * 100) };
}
