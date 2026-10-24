// The Map tab's real roads (OpenStreetMap): each game road drawn along the nearest real one, at its game length,
// and two game roads don't share a real road while there are others to use.

import { describe, expect, it } from 'vitest';
import { layRoads } from '../app/src/mapLay';

const len = (p: [number, number][]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i]![0], q[1] - p[i]![1]), 0);

describe('real road shapes on the map', () => {
  // three straight real roads: one east-west through the town, one north, one far away
  const d = { box: [], major: [], river: [], coast: [], minor: [[-50, 0, 50, 0], [10, 5, 10, 60], [200, 200, 212, 200]] };

  it('a road sits on the nearest real road, cut to its game length round its spot', () => {
    const S = layRoads(d, [{ id: 'r0', x: 20, y: 1, L: 8 }]);
    const l = S.road.r0!;
    expect(len(l)).toBeCloseTo(8, 6);
    expect(l.every((p) => p[1] === 0)).toBe(true);
    expect(l[0]![0]).toBeCloseTo(16, 6);
  });

  it('a second road near the same spot takes another real road', () => {
    const S = layRoads(d, [{ id: 'r0', x: 9, y: 4, L: 5 }, { id: 'r1', x: 9, y: 4, L: 5 }]);
    const ys = (id: string) => S.road[id]!.map((p) => p[1]);
    expect(new Set([...ys('r0'), ...ys('r1')].map((y) => y === 0)).size).toBe(2);
  });

  it('a road longer than the real one gets all of it', () => {
    const S = layRoads(d, [{ id: 'r0', x: 205, y: 200, L: 20 }]);
    expect(len(S.road.r0!)).toBeCloseTo(12, 6);
  });
});
