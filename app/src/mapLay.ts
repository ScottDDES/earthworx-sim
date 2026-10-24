// Laying the game's roads on real ones (OpenStreetMap data): pure, no app or engine imports, so the engine's
// tests can check it. Used by mapShapes.ts.

export type Pt = [number, number];
export interface OsmTown {
  box: number[];
  major: number[][];
  minor: number[][];
  river: number[][];
  coast: number[][];
}
export interface Shapes {
  major: Pt[][];
  river: Pt[][];
  coast: Pt[][];
  minor: Pt[][];
  /** Each game road's line, by road id. */
  road: Record<string, Pt[]>;
}
const pts = (f: number[]): Pt[] => { const o: Pt[] = []; for (let i = 0; i < f.length; i += 2) o.push([f[i]!, f[i + 1]!]); return o; };

/** Each game road on the nearest real rural road not already taken, cut to its game length round the nearest point. */
export function layRoads(d: OsmTown, roads: readonly { id: string; x: number; y: number; L: number }[]): Shapes {
  const minor = d.minor.map(pts);
  const info = minor.map((l) => { const cum = [0]; for (let i = 1; i < l.length; i++) cum.push(cum[i - 1]! + Math.hypot(l[i]![0] - l[i - 1]![0], l[i]![1] - l[i - 1]![1])); return cum; });
  const used = new Set<number>(), road: Record<string, Pt[]> = {};
  for (const r of roads) {
    let best = -1, bestScore = Infinity, bestS = 0;
    for (let k = 0; k < minor.length; k++) {
      const l = minor[k]!, cum = info[k]!, total = cum[cum.length - 1]!;
      // a quick skip: nowhere near
      const near = nearest(l, cum, r.x, r.y);
      const score = near.d + (used.has(k) ? 15 : 0) + Math.max(0, Math.min(r.L, 30) - total) * 0.5;
      if (score < bestScore) { bestScore = score; best = k; bestS = near.s; }
    }
    if (best < 0) continue;
    used.add(best);
    road[r.id] = cut(minor[best]!, info[best]!, bestS, Math.min(r.L, 30));
  }
  return { major: d.major.map(pts), river: d.river.map(pts), coast: d.coast.map(pts), minor, road };
}

/** The point on a line nearest (x, y): how far, and how far along the line it is. */
function nearest(l: Pt[], cum: number[], x: number, y: number): { d: number; s: number } {
  let d = Infinity, s = 0;
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1]!, b = l[i]!, dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
    const e = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    if (e < d) { d = e; s = cum[i - 1]! + t * Math.sqrt(L2); }
  }
  return { d, s };
}

/** The stretch of a line `len` long, centred on `s` along it where the line allows. */
function cut(l: Pt[], cum: number[], s: number, len: number): Pt[] {
  const total = cum[cum.length - 1]!;
  if (total <= len) return l;
  const a = Math.max(0, Math.min(total - len, s - len / 2)), b = a + len;
  const at = (q: number): Pt => {
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < q) i++;
    const seg = cum[i]! - cum[i - 1]!, t = seg ? (q - cum[i - 1]!) / seg : 0;
    return [l[i - 1]![0] + t * (l[i]![0] - l[i - 1]![0]), l[i - 1]![1] + t * (l[i]![1] - l[i - 1]![1])];
  };
  return [at(a), ...l.filter((_, i) => cum[i]! > a && cum[i]! < b), at(b)];
}
