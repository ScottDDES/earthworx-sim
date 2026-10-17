// Planning a council tender. A package: crews, graders, rollers, carts, trucks, the pit, who supplies the plant,
// the program and the price. A flood recovery program: crew by crew and road by road, on a map and a timeline.

import { useState } from 'react';
import {
  COUNCIL_TERMS, FLOAT_KM, FLOAT_MOVE, LD_OWN, TRUCK_DAY, TYPES, awayCounts, cartEff, hm, npOf, odLimit, planCounts, roadUnits, stars, subRate, truckM3, weeksFor, game,
  type CouncilTender, type PlanEval, type ProgOp,
} from '@engine';
import { CREW_COL, bottText, issueText } from '@engine/text/plan';
import { councilTitle } from '@engine/text/work';
import { Mentor } from '../Mentor';
import { f, fk } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
const L = (i: number) => String.fromCharCode(65 + i);
const starTxt = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);

function Stepper({ label, sub, val, onDown, onUp }: { label: string; sub: string; val: number; onDown: () => void; onUp: () => void }) {
  return (
    <div className="row" style={{ padding: '4px 0' }}>
      <span className="grow"><b className="small">{label}</b><span className="tiny muted" style={{ display: 'block' }}>{sub}</span></span>
      <button type="button" className="btn" aria-label={'Fewer ' + label} onClick={onDown}>−</button>
      <b className="num" style={{ width: 32, textAlign: 'center' }}>{val}</b>
      <button type="button" className="btn" aria-label={'More ' + label} onClick={onUp}>+</button>
    </div>
  );
}

/** Who supplies the plant: your own machines first (as many as you choose), the rest dry hire or subbie plant. */
function Plant({ c, t, e, act }: { c: Career; t: CouncilTender; e: PlanEval; act: Act }) {
  const av = planCounts(game.planCtx(c), t.close + 1), pl = t.pl, N = pl.crews;
  const per: Record<string, number> = { grader: pl.graders || 1, roller: pl.rollers || 1, cart: pl.carts, truck: pl.trucks };
  return (
    <>
      <div className="sub" style={{ marginTop: 10 }}>Who supplies the plant</div>
      {(['grader', 'roller', 'cart', 'truck'] as const).map((k) => {
        const need = e.need ? e.need[k] : N * per[k]!, a = av[k] || 0, use = Math.min(need, pl.own && pl.own[k] != null ? Math.min(pl.own[k]!, a) : a), rest = need - use, wet = hm(pl, k) === 'wet';
        return (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderBottom: '1px solid var(--soft)' }}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <span className="grow"><b className="small">{need} {TYPES[k].short}{need !== 1 ? 's' : ''}</b><span className="tiny muted" style={{ display: 'block' }}>Yours: {use} of {a} free{rest ? ' · ' + rest + ' from outside' : ''}</span></span>
              <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <button type="button" className="btn" style={{ minHeight: 40, padding: '0 12px' }} disabled={!(use > 0)} onClick={() => act((x) => game.setPlan(x, t.id, 'own:' + k, -1))}>−</button>
                <b className="num" style={{ minWidth: 22, textAlign: 'center' }}>{use}</b>
                <button type="button" className="btn" style={{ minHeight: 40, padding: '0 12px' }} disabled={!(use < Math.min(a, need))} onClick={() => act((x) => game.setPlan(x, t.id, 'own:' + k, 1))}>+</button>
              </span>
            </div>
            {rest > 0 && (k === 'truck' ? <div className="tiny muted">{rest} hired with drivers at {f(TRUCK_DAY)} a day, only on resheeting days.</div> : (
              <div className="seg">
                <button type="button" className={wet ? '' : 'on'} onClick={() => act((x) => game.setHireMode(x, t.id, k, 'dry'))}>Dry hire · {f(TYPES[k].dry)}/wk</button>
                <button type="button" className={wet ? 'on' : ''} onClick={() => act((x) => game.setHireMode(x, t.id, k, 'wet'))}>Subbie + operator · {f(subRate(k))}/day</button>
              </div>
            ))}
          </div>
        );
      })}
      <div className="tiny muted">Dry hire is paid every week, rain or shine, and you put an operator on it. Subbie plant comes with its own operator and fuel and is only paid on days it works. Keep your own machines off the job if they're earning more on hire elsewhere.</div>
      {t.subAvail && !e.prog ? (
        <Stepper label="Full subcontractor crews" val={pl.subs || 0} onDown={() => act((x) => game.setPlan(x, t.id, 'subs', -1))} onUp={() => act((x) => game.setPlan(x, t.id, 'subs', 1))}
          sub={`Local outfits that bring the lot. ${f(t.subRate!)} a working day each, at ${Math.round(t.subPace! * 100)}% of a full crew's pace. ${t.subAvail} can put a crew on.${e.SC ? ' They\'d do ' + Math.round((1 - e.ownShare) * 100) + '% of the work.' : ''}`} />
      ) : null}
    </>
  );
}

/** The price: cost lines, overheads share, margin, your price, how they'll score you, submit. */
function Price({ c, t, act }: { c: Career; t: CouncilTender; act: Act }) {
  const [lines, setLines] = useState(false);
  const ev = game.evaluate(c, t.id)!, e = ev.e, CP = ev.price, price = CP.price;
  const rows: [string, number][] = [['Fuel', e.c.fuel], ['Casuals (' + e.casuals + ')', e.c.labour], ['Wear and servicing', e.c.wear], ['Dry hire', e.c.hire], ['Subbies (wet hire)', e.c.subbies], ['Subbie crews', e.c.subcrews], ['Gravel trucks', e.c.trucks], ['Gravel royalty', e.c.royalty], ['Mobilisation', e.c.mob], ['Floats between roads', e.c.floats ?? 0], ['Site costs, traffic control', e.c.site]];
  const np = npOf('council', null, null, game.standing(c), () => 0), capped = game.capFull(c) && !t.bid, loose = (e.unassigned ?? []).length;
  return (
    <>
      <div className="card">
        {lines && rows.filter((x) => x[1]).map((x) => <div key={x[0]} className="kv"><span>{x[0]}</span><span className="num">{f(x[1])}</span></div>)}
        <div className="kv"><span>Direct cost of the job</span><span className="num">{f(e.cost)}</span></div>
        <div className="row" style={{ padding: '6px 0', flexWrap: 'nowrap' }}>
          <span className="grow"><span className="small">Company overheads</span><span className="tiny muted" style={{ display: 'block' }}>{f(CP.wk)} a week × {CP.wks} week{CP.wks !== 1 ? 's' : ''} × {Math.round(CP.sh * 100)}%{t.oh == null ? ' (suggested)' : ''}</span></span>
          <button type="button" className="btn" disabled={!(CP.sh > 0)} onClick={() => act((x) => game.setOverheadShare(x, t.id, -0.25))}>−</button>
          <b className="num" style={{ minWidth: 64, textAlign: 'right' }}>{f(CP.oh)}</b>
          <button type="button" className="btn" disabled={!(CP.sh < 1)} onClick={() => act((x) => game.setOverheadShare(x, t.id, 0.25))}>+</button>
        </div>
        <div className="kv"><span>Cost all up</span><span className="num">{f(e.cost + CP.oh)}</span></div>
        <div className="row" style={{ padding: '6px 0' }}>
          <span className="grow small">Profit margin</span>
          <button type="button" className="btn" onClick={() => act((x) => game.setMargin(x, t.id, -0.05))}>−5%</button>
          <b className="num" style={{ minWidth: 56, textAlign: 'center' }}>{Math.round(t.mk * 1000) / 10}%</b>
          <button type="button" className="btn" onClick={() => act((x) => game.setMargin(x, t.id, 0.05))}>+5%</button>
        </div>
        <div className="kv"><b>Your tender price</b><b className="num" style={{ fontSize: 18 }}>{f(price)}</b></div>
        <div className="tiny muted">Profit if the plan holds, after overheads: {f(price - e.cost - CP.oh)}. Cash to carry it until the first claim is paid: about {f(Math.round((e.cost / Math.max(1, e.wks)) * Math.min(e.wks, COUNCIL_TERMS + 1) / 1000) * 1000)}. You have {f(c.bank)} plus a {f(odLimit(c))} overdraft.</div>
        <button type="button" className="btn full" onClick={() => setLines(!lines)}>{lines ? 'Hide the cost lines' : 'Show the cost lines'}</button>
      </div>
      <div className="card">
        <div className="sub">How they'll score you</div>
        <div className="kv"><span>Price</span><span className="num">out of 60</span></div>
        <div className="kv"><span>Track record <span className="tiny muted">{starTxt(stars(c.rep))}</span></span><span className="num">{np.rec}</span></div>
        <div className="kv"><span>Safety</span><span className="num">{np.saf > 0 ? '+' : ''}{np.saf}</span></div>
        <div className="kv"><span>Finances</span><span className="num">{np.fin ? np.fin + ' · behind with the bank' : 'Sound'}</span></div>
        <div className="kv"><span>Work already on</span><span className="num">{np.load ? String(np.load) : 'Free to start'}</span></div>
        <div className="kv"><span>Your program</span><span className="num">{e.method} of 6</span></div>
        <div className="kv"><b>Non-price</b><b className="num">{Math.max(0, np.tot) + e.method} of 40</b></div>
      </div>
      {capped && <div className="why">You're running two contracts, as many as you can keep on top of yourself. Hire an operations manager to take on more.</div>}
      <button type="button" className="big" disabled={!!loose || capped} onClick={() => act((x) => game.submitCouncil(x, t.id))}>{loose ? 'Give every road to a crew first' : (t.bid ? 'Resubmit at ' : 'Submit at ') + f(price)}</button>
    </>
  );
}

function PackageSheet({ c, t, act, onClose }: { c: Career; t: CouncilTender; act: Act; onClose: () => void }) {
  const [allRoads, setAllRoads] = useState(false);
  const pl = t.pl, e = game.evaluate(c, t.id)!.e, own = planCounts(game.planCtx(c), t.close + 1), away = awayCounts(game.planCtx(c), t.close + 1);
  const span = Math.max(t.weeks, e.wetWks) + 1, pc = (w: number) => Math.min(100, (w / span) * 100);
  const bk = e.bott.k, bInk = bk === 'ok' ? 'var(--teal)' : bk === 'idle' ? 'var(--warn)' : 'var(--rust)', pit = t.pits[pl.pit]!;
  const set = (k: string, d: number) => () => act((x) => game.setPlan(x, t.id, k, d));
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={'Plan ' + councilTitle(t)}>
      <div className="sheet">
        <div className="sub">{t.major ? 'Flood recovery program' : 'Council tender'} · closes end of week {t.close}</div>
        <h2>{councilTitle(t)}</h2>
        <div className="card">
          <div className="row tiny muted"><span className="grow">Road</span><span style={{ width: 48, textAlign: 'right' }}>Heavy</span><span style={{ width: 54, textAlign: 'right' }}>Medium</span><span style={{ width: 48, textAlign: 'right' }}>Light</span><span style={{ width: 64, textAlign: 'right' }}>Resheet</span></div>
          {t.roads.slice(0, allRoads ? 999 : 8).map((x, i) => (
            <div key={i} className="row small"><span className="grow">{x.name}</span><span className="num" style={{ width: 48, textAlign: 'right' }}>{x.hfg}</span><span className="num" style={{ width: 54, textAlign: 'right' }}>{x.mfg}</span><span className="num" style={{ width: 48, textAlign: 'right' }}>{x.lfg || 0}</span><span className="num" style={{ width: 64, textAlign: 'right' }}>{x.resheet.toLocaleString('en-AU')} m³</span></div>
          ))}
          {t.roads.length > 8 && <button type="button" className="btn" onClick={() => setAllRoads(!allRoads)}>{allRoads ? 'Show fewer roads' : 'Show all ' + t.roads.length + ' roads'}</button>}
          <div className="tiny muted">{t.weeks} weeks allowed from the start, then {f(LD_OWN)} a week in damages. The council pays monthly claims in {COUNCIL_TERMS} weeks, less 5% retention. Water point {t.waterKm} km from the work.</div>
        </div>
        <Mentor c={c} k="plan" act={act} />
        <Mentor c={c} k="overheads" act={act} />
        <div className="sub">1 · Your plan</div>
        <div className="card">
          <div className="small muted">You own {own.grader} grader{own.grader !== 1 ? 's' : ''}, {own.roller} roller{own.roller !== 1 ? 's' : ''}, {own.cart} water cart{own.cart !== 1 ? 's' : ''} and {own.truck} side tipper{own.truck !== 1 ? 's' : ''} free for the start. Anything more is hired in.{away ? ` ${away} more ${away > 1 ? 'are' : 'is'} out on other work past week ${t.close + 1}, so the plan hires ${away > 1 ? 'them' : 'it'} in.` : ''}</div>
          <Stepper label="Crews" sub="Two crews on one job work side by side." val={pl.crews} onDown={set('crews', -1)} onUp={set('crews', 1)} />
          <Stepper label="Graders per crew" sub="A second grader doubles the pace, with its own roller and enough water." val={pl.graders || 1} onDown={set('graders', -1)} onUp={set('graders', 1)} />
          <Stepper label="Rollers per crew" sub="One per grader." val={pl.rollers || 1} onDown={set('rollers', -1)} onUp={set('rollers', 1)} />
          <Stepper label="Water carts per crew" sub={'2 keep one grader at full pace, 3 for two graders. One short drops productivity 33%.' + (cartEff(t.waterKm) < 1 ? ` The water point is ${t.waterKm} km out, so each cart does ${Math.round(cartEff(t.waterKm) * 100)}% of a normal day.` : '')} val={pl.carts} onDown={set('carts', -1)} onUp={set('carts', 1)} />
          <Stepper label="Gravel trucks per crew" sub={`Your own side tippers first, then hired with a driver at ${f(TRUCK_DAY)} a day, only on resheeting days.`} val={pl.trucks} onDown={set('trucks', -1)} onUp={set('trucks', 1)} />
          <div className="sub" style={{ marginTop: 6 }}>Gravel pit</div>
          <div className="seg">{t.pits.map((x, i) => <button key={i} type="button" className={pl.pit === i ? 'on' : ''} onClick={() => act((y) => game.setPlan(y, t.id, 'pit', i))}>{x.name} · {x.haul} km</button>)}</div>
          <div className="tiny muted">{pit.note} Royalty ${pit.royalty}/m³. A truck brings in about {Math.round(truckM3(pit.haul))} m³ a day on this haul.</div>
          <div className="small">Crew: you{e.crew.used.length > 1 ? ', ' + (e.crew.used.length - 1) + ' of your staff' : ''}{e.casuals ? ' and ' + e.casuals + ' casual' + (e.casuals > 1 ? 's' : '') + ' from labour hire' : ''}.{e.hiredTrucks ? ` ${e.hiredTrucks} hired truck${e.hiredTrucks > 1 ? 's' : ''} with drivers.` : ''}</div>
          <Plant c={c} t={t} e={e} act={act} />
        </div>
        <div className="sub">2 · Your program</div>
        <div className="card">
          <div style={{ position: 'relative', height: 58 }}>
            <div style={{ position: 'absolute', left: 0, top: 6, height: 14, width: pc(t.weeks) + '%', background: 'var(--soft)', borderRadius: 4 }} />
            <div style={{ position: 'absolute', left: pc(t.weeks) + '%', top: 0, height: 26, borderLeft: '2px dashed var(--rust)' }} />
            <div style={{ position: 'absolute', left: 0, top: 28, height: 14, width: pc(e.wks) + '%', background: e.wks <= t.weeks ? 'var(--teal)' : 'var(--rust)', borderRadius: 4 }} />
            <div style={{ position: 'absolute', left: pc(e.wks) + '%', top: 28, height: 14, width: Math.max(0, pc(e.wetWks) - pc(e.wks)) + '%', background: 'repeating-linear-gradient(45deg,var(--rain-soft) 0 4px,#fff 4px 8px)', border: '1px solid var(--rain-soft)', borderRadius: '0 4px 4px 0' }} />
            <div className="tiny muted" style={{ position: 'absolute', left: 0, top: 44 }}>Week 0</div>
            <div className="tiny" style={{ position: 'absolute', right: 0, top: 44, color: 'var(--rust)' }}>Allowed: {t.weeks} wks</div>
          </div>
          <div className="kv"><span>Likely finish</span><span className="num">{e.wks} weeks</span></div>
          <div className="kv"><span>If it's a wet one</span><span className="num" style={{ color: e.wetWks > t.weeks ? 'var(--rust)' : 'inherit' }}>{e.wetWks} weeks{e.wetWks > t.weeks ? ' · ' + f((e.wetWks - t.weeks) * LD_OWN) + ' damages' : ''}</span></div>
          <div className="kv"><span>Crew-days of work</span><span className="num">{Math.ceil(e.cd)} ({Math.ceil(e.gDays)} grading, {Math.ceil(e.sDays)} resheeting)</span></div>
          <div className="small" style={{ color: bInk, fontWeight: 600 }}>{bottText(e.bott, t)}</div>
          <div className="tiny muted">Method score: {e.method} of 6. The council gives 6 for a program with a week to spare, 3 for one that just makes it.</div>
        </div>
        <div className="sub">3 · Your price</div>
        <Price c={c} t={t} act={act} />
        <button type="button" className="btn full" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ProgMap({ t }: { t: CouncilTender }) {
  const P = t.pl.prog!, xs = t.roads.map((r) => r.x!).concat([0]), ys = t.roads.map((r) => r.y!).concat([0]);
  const x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, y0 = Math.min(...ys) - 6, y1 = Math.max(...ys) + 6, W = x1 - x0, H = y1 - y0;
  const sx = (x: number) => ((x - x0) / W) * 100, sy = (y: number) => (((y1 - y) / H) * 100 * H) / W, vh = (100 * H) / W;
  const who: Record<number, [number, number]> = {};
  P.crews.forEach((c, i) => c.seq.forEach((q, n) => { who[q] = [i, n + 1]; }));
  return (
    <>
      <svg viewBox={`0 0 100 ${vh.toFixed(2)}`} style={{ width: '100%', maxHeight: 300, background: 'var(--soft)', borderRadius: 12 }} role="img" aria-label="Map of the roads and crew routes">
        {P.crews.map((c, i) => c.seq.length ? (
          <polyline key={i} points={[[0, 0] as [number, number]].concat(c.seq.map((q) => [t.roads[q]!.x!, t.roads[q]!.y!] as [number, number])).map((p) => sx(p[0]).toFixed(2) + ',' + sy(p[1]).toFixed(2)).join(' ')}
            fill="none" stroke={CREW_COL[i % 6]} strokeWidth=".5" strokeDasharray="1.2 .8" opacity=".85" />
        ) : null)}
        {t.roads.map((rd, q) => {
          const w = who[q], rr = Math.max(1.1, Math.min(3, Math.sqrt(roadUnits(rd)) * 0.45));
          return (
            <g key={q}>
              <circle cx={sx(rd.x!).toFixed(2)} cy={sy(rd.y!).toFixed(2)} r={rr.toFixed(2)} fill={w ? CREW_COL[w[0] % 6] : 'var(--card)'} stroke={w ? 'var(--card)' : 'var(--muted)'} strokeWidth=".35" />
              {w && <text x={sx(rd.x!).toFixed(2)} y={(sy(rd.y!) + 0.9).toFixed(2)} fontSize="2.4" textAnchor="middle" fill="#fff" fontWeight="700">{w[1]}</text>}
            </g>
          );
        })}
      </svg>
      <div className="tiny muted">Dots are roads, sized by the work in them and numbered in each crew's order. Dashed lines are each crew's route from the yard. More than {FLOAT_KM} km between roads means floating the gear: half a day and {f(FLOAT_MOVE)}.</div>
    </>
  );
}

function ProgramSheet({ c, t, act, onClose }: { c: Career; t: CouncilTender; act: Act; onClose: () => void }) {
  const [tab, setTab] = useState<'crews' | 'time' | 'plant' | 'price'>('crews');
  const [selRaw, setSel] = useState(0);
  const P = t.pl.prog!, ev = game.evaluate(c, t.id)!, e = ev.e, price = ev.price.price, sel = Math.min(selRaw, P.crews.length - 1);
  const subsUsed = P.crews.filter((x) => x.sub).length, nIss = (e.issues ?? []).length, loose = (e.unassigned ?? []).length;
  const op = (o: ProgOp) => () => act((x) => game.programAct(x, t.id, o));
  const Btn = ({ onClick, children, disabled, label }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; label?: string }) => (
    <button type="button" className="btn" style={{ minHeight: 40, padding: '0 11px' }} disabled={disabled} aria-label={label} onClick={onClick}>{children}</button>
  );
  const cr = P.crews[sel]!, R = e.res![sel]!;
  const span = Math.max(t.weeks, e.wetWks) + 2, pc = (w: number) => Math.min(100, (w / span) * 100);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={'Plan ' + councilTitle(t)}>
      <div className="sheet">
        <div className="sub">Flood recovery program · closes end of week {t.close}</div>
        <h2>{councilTitle(t)}</h2>
        <div className="tiny muted">{t.roads.length} roads, {t.q.hfg} km of heavy formation grading, {t.q.resheet.toLocaleString('en-AU')} m³ of gravel. Due 30 June {t.dlYear}: {t.weeks} weeks from the start. Claims monthly, no retention. Well behind at halfway and the council moves roads to someone else; past 30 June it takes the rest.</div>
        <div className="card" style={{ position: 'sticky', top: -20, zIndex: 2, gap: 8 }}>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            <span className="grow small"><b className="num" style={{ color: e.wetWks > t.weeks || loose ? 'var(--rust)' : 'var(--teal)' }}>{loose ? loose + ' roads loose' : e.wks + ' of ' + t.weeks + ' wks'}</b> · {fk(e.cost)} cost · {nIss} holdup{nIss !== 1 ? 's' : ''}</span>
            <b className="num">{fk(price)}</b>
          </div>
          <div className="seg" role="tablist">
            {([['crews', 'Crews'], ['time', 'Timeline'], ['plant', 'Plant'], ['price', 'Price']] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'time' && nIss ? ' (' + nIss + ')' : ''}</button>
            ))}
          </div>
        </div>
        {tab === 'crews' && (
          <>
            <div className="card"><ProgMap t={t} /></div>
            <Mentor c={c} k="plan" act={act} />
            <Mentor c={c} k="overheads" act={act} />
            <div className="sub">Your crews</div>
            <div className="seg" role="tablist">
              {P.crews.map((x, i) => (
                <button key={i} type="button" className={i === sel ? 'on' : ''} style={{ borderLeft: '5px solid ' + CREW_COL[i % 6] }} onClick={() => setSel(i)}>
                  {L(i)}{x.sub ? ' · subbie' : ''}<span className="tiny" style={{ display: 'block', fontWeight: 600 }}>{e.res![i]?.wk ?? 0} wks</span>
                </button>
              ))}
            </div>
            <div className="card" style={{ borderLeft: '6px solid ' + CREW_COL[sel % 6] }}>
              <div className="row"><b className="grow">Crew {L(sel)}{cr.sub ? ': subcontractor outfit' : ''}</b>{P.crews.length > 1 && <Btn onClick={op({ op: 'del', i: sel })}>Remove</Btn>}</div>
              {cr.sub ? <div className="small muted">A local outfit with its own grader, roller, carts, trucks and operators. {f(t.subRate!)} a working day at {Math.round((t.subPace || 0.85) * 100)}% of a full crew's pace.</div>
                : (['gr', 'ro', 'ca', 'tr'] as const).map((k) => (
                  <div key={k} className="row" style={{ flexWrap: 'nowrap' }}>
                    <span className="grow small">{{ gr: 'Graders', ro: 'Rollers', ca: 'Water carts', tr: 'Gravel trucks' }[k]}</span>
                    <Btn onClick={op({ op: 'cfg', i: sel, k, d: -1 })}>−</Btn><b className="num" style={{ width: 26, textAlign: 'center' }}>{cr[k]}</b><Btn onClick={op({ op: 'cfg', i: sel, k, d: 1 })}>+</Btn>
                  </div>
                ))}
              <div className="small">{cr.seq.length} road{cr.seq.length !== 1 ? 's' : ''} · {Math.ceil(R.days)} working days · {R.wk} weeks · {R.floats} float{R.floats !== 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {R.roads.map((x, n) => {
                  const rd = t.roads[x.ri]!, col = x.b === 'ok' ? 'var(--teal)' : x.b === 'idle' ? 'var(--warn)' : x.b === 'water' ? 'var(--rain)' : 'var(--rust)';
                  return (
                    <div key={x.ri} className="row" style={{ flexWrap: 'nowrap', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--soft)' }}>
                      <b className="num" style={{ width: 18, color: CREW_COL[sel % 6] }}>{n + 1}</b>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="small" style={{ display: 'block' }}>{rd.name}{x.float ? <span className="tiny" style={{ color: 'var(--warn)' }}> float</span> : null}</span>
                        <span className="tiny muted">{rd.L} km · {rd.resheet.toLocaleString('en-AU')} m³ · haul {rd.haul} km · water {rd.water} km · {x.days.toFixed(1)} d{x.b !== 'ok' && <> · <b style={{ color: col }}>{x.b === 'idle' ? 'trucks idle' : x.b}</b></>}</span>
                      </span>
                      <Btn disabled={!n} onClick={op({ op: 'mv', i: sel, j: n, d: -1 })}>↑</Btn>
                      <Btn disabled={n >= R.roads.length - 1} onClick={op({ op: 'mv', i: sel, j: n, d: 1 })}>↓</Btn>
                      <Btn label={'Take this road off Crew ' + L(sel)} onClick={op({ op: 'un', i: sel, j: n })}>✕</Btn>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="btns">
              <Btn onClick={op({ op: 'auto' })}>Auto-plan</Btn>
              <Btn onClick={op({ op: 'tidy' })}>Tidy the order</Btn>
              {P.crews.length < 6 && <Btn onClick={op({ op: 'add' })}>+ Your crew</Btn>}
              {P.crews.length < 6 && subsUsed < (t.subAvail || 0) && <Btn onClick={op({ op: 'addsub' })}>+ Subbie crew</Btn>}
            </div>
            {loose > 0 && (
              <div className="card" style={{ borderColor: 'var(--rust)' }}>
                <b>Roads nobody's doing ({loose})</b>
                {e.unassigned!.map((q) => {
                  const rd = t.roads[q]!;
                  return (
                    <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '5px 0', borderBottom: '1px solid var(--soft)' }}>
                      <span className="small">{rd.name} <span className="tiny muted">{rd.L} km · haul {rd.haul} km</span></span>
                      <div className="btns" style={{ gap: 6 }}>
                        {P.crews.map((_, i) => <button key={i} type="button" className="btn" style={{ minHeight: 36, padding: '0 10px', borderLeft: '5px solid ' + CREW_COL[i % 6] }} onClick={op({ op: 'as', road: q, to: i })}>{L(i)}</button>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {tab === 'time' && (
          <>
            <div className="sub">Your timeline</div>
            <div className="card">
              <div style={{ position: 'relative' }}>
                {e.res!.map((R2, i) => (
                  <div key={i} style={{ position: 'relative', height: 18, marginBottom: 6 }}>
                    {R2.roads.map((x) => {
                      const w0 = x.start ? weeksFor(c.town, x.start, t.close + 1, 1) : 0, w1 = weeksFor(c.town, x.start + x.days, t.close + 1, 1);
                      const col = x.b === 'ok' ? CREW_COL[i % 6] : x.b === 'idle' ? 'var(--warn)' : x.b === 'water' ? 'var(--rain)' : 'var(--rust)';
                      return <div key={x.ri} title={t.roads[x.ri]!.name} style={{ position: 'absolute', left: pc(w0) + '%', width: Math.max(0.6, pc(w1) - pc(w0)) + '%', top: 2, height: 14, background: col, borderRadius: 2, outline: '1px solid var(--card)' }} />;
                    })}
                  </div>
                ))}
                <div style={{ position: 'absolute', left: pc(t.weeks) + '%', top: -4, bottom: -4, borderLeft: '2px dashed var(--rust)' }} />
              </div>
              <div className="row tiny"><span className="grow muted">Start</span><span style={{ color: 'var(--rust)' }}>30 June: week {t.weeks}</span></div>
              <div className="tiny muted">One row a crew (A at the top). Coloured = keeping up; blue = short of water; orange = short of gravel trucks; amber = trucks waiting.</div>
              <div className="kv"><span>Likely finish</span><span className="num">{e.wks} weeks</span></div>
              <div className="kv"><span>If it's a wet one</span><span className="num" style={{ color: e.wetWks > t.weeks ? 'var(--rust)' : 'inherit' }}>{e.wetWks} weeks{e.wetWks > t.weeks ? ' · past 30 June' : ''}</span></div>
              <div className="kv"><span>Floats</span><span className="num">{e.floatsN} ({f(e.c.floats ?? 0)})</span></div>
              <div className="tiny muted">Method score: {e.method} of 6. The council gives 6 for a program with a week to spare, 3 for one that just makes it, 0 if roads are left out.</div>
            </div>
            <div className="sub">What's holding it up</div>
            <div className="card">
              {nIss ? e.issues!.slice(0, 6).map((x, n) => (
                <div key={n} className="small" style={{ padding: '5px 0', borderBottom: '1px solid var(--soft)', ...(x.crew >= 0 ? { borderLeft: '4px solid ' + CREW_COL[x.crew % 6], paddingLeft: 8 } : {}) }}>{issueText(x, t)}</div>
              )) : <div className="small" style={{ color: 'var(--teal)', fontWeight: 600 }}>{bottText(e.bott, t)}</div>}
            </div>
          </>
        )}
        {tab === 'plant' && <><div className="sub">Who supplies the plant</div><div className="card"><Plant c={c} t={t} e={e} act={act} /></div></>}
        {tab === 'price' && <><div className="sub">Your price</div><Price c={c} t={t} act={act} /></>}
        <button type="button" className="btn full" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/** The council tender's card on the Work tab. */
export function CouncilCard({ t, onPlan }: { t: CouncilTender; onPlan: () => void }) {
  return (
    <div className="card" style={t.major ? { borderColor: 'var(--ink)', borderWidth: 2 } : undefined}>
      <div className="row"><span className={'chip ' + (t.major ? 'c-dark' : 'c-rain')}>{t.major ? 'RECOVERY PROGRAM' : 'COUNCIL TENDER'}</span><span className="grow" /><span className="tiny muted">Closes end of week {t.close}</span></div>
      <b>{councilTitle(t)}</b>
      {t.major ? (
        <>
          <div className="small muted">{t.q.hfg} km of heavy formation grading, {t.q.resheet.toLocaleString('en-AU')} m³ of gravel worked in, across {t.roads.length} roads{(t.lots ?? 1) > 1 ? `. The council has split the area into ${t.lots} lots` : ''}. Pits {t.pits[0]!.haul} to {t.pits[1]!.haul} km out.</div>
          <div className="small">Due 30 June {t.dlYear}, {t.weeks} weeks from the start. Monthly claims, no retention. Fall well behind and the council moves roads to other contractors.</div>
        </>
      ) : (
        <>
          <div className="small muted">{t.roads.map((x) => x.name).join(', ')}. {t.q.hfg} km heavy, {t.q.mfg} km medium, {t.q.lfg || 0} km light grading, {t.q.resheet.toLocaleString('en-AU')} m³ resheet. Water point {t.waterKm} km out.</div>
          <div className="small">{t.weeks} weeks to finish. {f(LD_OWN)} a week in damages after that.</div>
        </>
      )}
      {t.bid && <div className="small" style={{ color: 'var(--teal)', fontWeight: 700 }}>Your tender is in: {f(t.bid)}</div>}
      <button type="button" className={'btn ' + (t.bid ? '' : 'ink ') + 'full'} onClick={onPlan}>{t.bid ? 'Change your plan' : 'Plan and price it'}</button>
    </div>
  );
}

/** The right sheet for a council tender: road by road for a program, otherwise the package plan. */
export function PlanSheet({ c, t, act, onClose }: { c: Career; t: CouncilTender; act: Act; onClose: () => void }) {
  if (t.major && t.pl.prog && t.roads[0] && t.roads[0].x != null) return <ProgramSheet c={c} t={t} act={act} onClose={onClose} />;
  return <PackageSheet c={c} t={t} act={act} onClose={onClose} />;
}
