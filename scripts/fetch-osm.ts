// Fetches each town's real roads, rivers and coastline from OpenStreetMap (through the Overpass API) for the
// Map tab, into app/src/data/osm/<town>.json. Map data © OpenStreetMap contributors (ODbL).
// The game's roads keep their made-up names; the app draws each one along the real road nearest its spot.
// Run it again only to add a town or refresh the data: npx tsx scripts/fetch-osm.ts [town ...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { PLACE_POS, TOWNS, dmap, type TownId } from '../src';

const OUT = new URL('../app/src/data/osm/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);
const MINOR = new Set(['tertiary', 'unclassified']);
const TOL = 0.25; // km: lines simplified to within this

type Pt = [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Douglas-Peucker. */
function simplify(p: Pt[], tol: number): Pt[] {
  if (p.length < 3) return p;
  const [a, b] = [p[0]!, p[p.length - 1]!];
  let dmax = 0, idx = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = segDist(p[i]!, a, b);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= tol) return [a, b];
  return [...simplify(p.slice(0, idx + 1), tol).slice(0, -1), ...simplify(p.slice(idx), tol)];
}
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const len = (p: Pt[]) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i]![0], q[1] - p[i]![1]), 0);

/** Ways that share an end joined into longer lines (by name, so a named road comes out as one piece where it can). */
function chain(ways: Pt[][]): Pt[][] {
  const left = ways.map((w) => w.slice());
  const out: Pt[][] = [];
  const key = (p: Pt) => p[0].toFixed(3) + ',' + p[1].toFixed(3);
  while (left.length) {
    let cur = left.pop()!;
    for (let grew = true; grew; ) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const w = left[i]!, h = key(cur[0]!), t = key(cur[cur.length - 1]!), wh = key(w[0]!), wt = key(w[w.length - 1]!);
        if (t === wh) cur = [...cur, ...w.slice(1)];
        else if (t === wt) cur = [...cur, ...w.slice(0, -1).reverse()];
        else if (h === wt) cur = [...w, ...cur.slice(1)];
        else if (h === wh) cur = [...w.slice().reverse(), ...cur.slice(1)];
        else continue;
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(cur);
  }
  return out;
}

const towns = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TOWNS)) as TownId[];
for (const town of towns) {
  const [lat0, lon0] = TOWNS[town].ll;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.57;
  // the box: every place and every game road, with room round the edge
  const M = dmap(() => 0.5, { town, week: 1, jobs: [] });
  const xs = [0, ...M.roads.map((r) => r.x), ...Object.values(PLACE_POS[town]).map((p) => p[0])];
  const ys = [0, ...M.roads.map((r) => r.y), ...Object.values(PLACE_POS[town]).map((p) => p[1])];
  const pad = 25, X0 = Math.min(...xs) - pad, X1 = Math.max(...xs) + pad, Y0 = Math.min(...ys) - pad, Y1 = Math.max(...ys) + pad;
  const s = lat0 + Y0 / ky, n = lat0 + Y1 / ky, w = lon0 + X0 / kx, e = lon0 + X1 / kx;
  const bb = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
  const q = `[out:json][timeout:300];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified)$"](${bb});way["waterway"="river"](${bb});way["natural"="coastline"](${bb}););out geom;`;
  let j: any = null;
  for (let tries = 0; tries < 4 && !j; tries++) {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'earthworx-sim map build (scott@ddes.biz)' } });
    if (res.ok) j = await res.json();
    else { console.log(town, 'overpass', res.status, 'retrying'); await new Promise((r) => setTimeout(r, 20000)); }
  }
  if (!j) throw new Error(town + ': no data');
  const toKm = (g: { lat: number; lon: number }[]): Pt[] => g.map((p) => [(p.lon - lon0) * kx, (p.lat - lat0) * ky]);
  const byName = new Map<string, Pt[][]>(), major: Pt[][] = [], river: Pt[][] = [], coast: Pt[][] = [];
  for (const el of j.elements) {
    if (el.type !== 'way' || !el.geometry) continue;
    const t = el.tags ?? {}, p = toKm(el.geometry);
    if (t.natural === 'coastline') coast.push(p);
    else if (t.waterway === 'river') river.push(p);
    else if (MAJOR.has(t.highway)) major.push(p);
    else if (MINOR.has(t.highway)) {
      const k = t.name ?? t.ref ?? '_' + el.id;
      byName.set(k, [...(byName.get(k) ?? []), p]);
    }
  }
  const pack = (ls: Pt[][], min = 0) => ls.map((l) => simplify(l, TOL)).filter((l) => len(l) >= min).map((l) => l.flatMap((p) => [r1(p[0]), r1(p[1])]));
  const minor = [...byName.values()].flatMap(chain);
  const data = {
    box: [X0, Y0, X1, Y1].map(Math.round),
    major: pack(chain(major), 1),
    minor: pack(minor, 1.5),
    river: pack(chain(river), 2),
    coast: pack(chain(coast), 0.5),
  };
  const txt = JSON.stringify(data);
  writeFileSync(new URL(town + '.json', OUT), txt);
  console.log(`${TOWNS[town].name}: ${data.major.length} highways, ${data.minor.length} rural roads, ${data.river.length} rivers, ${data.coast.length} coast · ${Math.round(txt.length / 1024)} KB`);
  await new Promise((r) => setTimeout(r, 5000));
}
