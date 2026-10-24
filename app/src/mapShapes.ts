// Real road shapes for the Map tab. Each town's highways, rural roads, rivers and coast come from OpenStreetMap
// (scripts/fetch-osm.ts, © OpenStreetMap contributors). The game's roads keep their made-up names and lengths:
// each is drawn along the real rural road nearest its spot, as long as it is in the game. Drawing only: the
// simulation never sees any of this.

import { useEffect, useState } from 'react';
import type { MapRoad, TownId } from '@engine';
import { layRoads, type OsmTown, type Shapes } from './mapLay';

export type { Pt, Shapes } from './mapLay';

const FILES = import.meta.glob<OsmTown>('./data/osm/*.json', { import: 'default' });
const cache = new Map<string, Shapes>();

/** The town's real map with the game's roads laid on it; null while it loads, or if the town has none. */
export function useShapes(town: TownId, roads: readonly MapRoad[]): Shapes | null {
  const key = town + ':' + roads.length;
  const [s, setS] = useState<Shapes | null>(cache.get(key) ?? null);
  useEffect(() => {
    if (cache.has(key)) { setS(cache.get(key)!); return; }
    const load = FILES['./data/osm/' + town + '.json'];
    if (!load) return;
    let live = true;
    load().then((d) => {
      const sh = layRoads(d, roads);
      cache.set(key, sh);
      if (live) setS(sh);
    }, () => {});
    return () => { live = false; };
  }, [key]);
  return s;
}

