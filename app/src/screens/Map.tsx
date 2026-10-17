// The Map tab: every road in the district drawn to length around the real towns, coloured by its state
// (flood damaged, your crews on it, fixed by you, a rival's crews, fixed by someone else, sound). Tap a road for its story.

import { useState } from 'react';
import { PLACE_POS, TOWNS, mapRoad, mapStats, game, type MapRoad, type RoadState } from '@engine';
import { MAP_KEYS, MAP_TXT, roadNote } from '@engine/text/map';
import { jobTitle } from '@engine/text/work';

type Career = game.Career;

const MAP_COL: Record<RoadState, string> = { dmg: 'var(--rust)', work: 'var(--hi)', done: 'var(--teal)', rw: '#6E7F96', rd: '#9AA3AE', ok: 'var(--muted)' };
/** Drawn bottom to top: your work last, so it sits over everything else. */
const ORDER: Record<RoadState, number> = { ok: 0, rd: 1, dmg: 2, rw: 3, done: 4, work: 5 };

export function MapTab({ c }: { c: Career }) {
  const [selId, setSel] = useState<string | null>(null);
  const M = c.dmap!, R = M.roads, S = mapStats(M), sel = selId ? mapRoad(M, selId) : undefined, P = PLACE_POS[c.town], name = TOWNS[c.town].name;
  const xs = [...R.map((x) => x.x), ...Object.values(P).map((p) => p[0])], ys = [...R.map((x) => x.y), ...Object.values(P).map((p) => p[1])];
  const x0 = Math.min(...xs) - 18, x1 = Math.max(...xs) + 18, y0 = Math.min(...ys) - 18, y1 = Math.max(...ys) + 18, W = x1 - x0, H = y1 - y0;
  // a road is a straight stroke through its spot, at its angle, as long as it is (up to 30 km)
  const seg = (x: MapRoad) => { const h = Math.min(x.L, 30) / 2, dx = Math.cos(x.a) * h, dy = Math.sin(x.a) * h; return { x1: x.x - dx - x0, y1: y1 - (x.y - dy), x2: x.x + dx - x0, y2: y1 - (x.y + dy) }; };
  const j = sel?.jobId ? c.jobs.find((y) => y.id === sel.jobId) : null;
  const mine = R.filter((x) => x.st === 'done').sort((a, b) => (b.w ?? 0) - (a.w ?? 0)).slice(0, 8);
  return (
    <>
      <div className="card">
        <div className="row"><b className="grow" style={{ fontSize: 18 }}>{name} district</b><span className={'chip ' + (S.pct >= 70 ? 'c-job' : S.pct >= 40 ? 'c-idle' : 'c-bad')}>{S.pct}% REPAIRED</span></div>
        <div className="bar"><i style={{ width: S.pct + '%', background: 'var(--teal)' }} /></div>
        <div className="row small" style={{ flexWrap: 'wrap', gap: '4px 14px' }}>
          <span><b className="num">{S.mine}</b> roads fixed by you ({S.mineKm} km)</span>
          <span><b className="num">{S.work}</b> with your crews on them</span>
          <span><b className="num">{S.dmg}</b> still flood damaged</span>
        </div>
      </div>
      <div className="card mapcard">
        <svg className="dmap" viewBox={`0 0 ${W.toFixed(0)} ${H.toFixed(0)}`} role="img" aria-label="Map of the district roads, coloured by their state">
          <rect x="0" y="0" width={W.toFixed(0)} height={H.toFixed(0)} fill="var(--ground)" rx="6" />
          {Object.entries(P).map(([k, p]) => (
            <text key={k} x={(p[0] - x0).toFixed(1)} y={(y1 - p[1] - 9).toFixed(1)} textAnchor="middle" fontSize="8.5" fill="var(--muted)">{k}</text>
          ))}
          {R.slice().sort((a, b) => ORDER[a.st] - ORDER[b.st]).map((x) => {
            const q = seg(x), sw = x.st === 'done' || x.st === 'work' ? 3.6 : x.st === 'ok' ? 1.2 : 2.6;
            return (
              <g key={x.id}>
                <line {...q} stroke={MAP_COL[x.st]} strokeWidth={sw} strokeLinecap="round" className={x.st === 'work' ? 'mwork' : undefined} />
                <line {...q} stroke="transparent" strokeWidth={12} style={{ cursor: 'pointer' }} onClick={() => setSel(x.id === selId ? null : x.id)}><title>{x.n}</title></line>
              </g>
            );
          })}
          {sel && <line {...seg(sel)} stroke="var(--ink)" strokeWidth={7} strokeLinecap="round" opacity=".35" pointerEvents="none" />}
          <circle cx={(-x0).toFixed(1)} cy={y1.toFixed(1)} r="4.5" fill="var(--ink)" />
          <text x={(-x0).toFixed(1)} y={(y1 + 13).toFixed(1)} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--ink)">{name}</text>
        </svg>
        <div className="maplegend">{MAP_KEYS.map((k) => <span key={k}><i style={{ background: MAP_COL[k] }} />{MAP_TXT[k]}</span>)}</div>
        <div className="tiny muted">Tap a road. Roads are drawn to length around the real towns. Road names are made up.</div>
      </div>
      {sel && (
        <div className="card" style={{ border: '2px solid var(--ink)' }}>
          <div className="row"><b className="grow">{sel.n}</b><span className="chip" style={{ background: MAP_COL[sel.st], color: sel.st === 'work' ? '#16181A' : '#fff' }}>{MAP_TXT[sel.st].toUpperCase()}</span></div>
          <div className="small muted">{roadNote(sel, j ? jobTitle(j) : null)}</div>
          <button type="button" className="btn full" onClick={() => setSel(null)}>Close</button>
        </div>
      )}
      {mine.length > 0 && (
        <div className="card">
          <div className="sub">Your roads</div>
          {mine.map((x) => <div key={x.id} className="kv"><span>{x.n}</span><span className="num small">{x.L} km · wk {x.w}</span></div>)}
        </div>
      )}
    </>
  );
}
