// The Bulk and Ag pack on the Work tab: farmers ringing about dams, and the dams on the go.

import {
  BULK_CASUAL, SURVEY_COST, TYPES, WAIT_WEEKS, damEstimate, damVolume, freeSpread, pricingVol, quotePrice, game,
  type FarmEnquiry, type Job,
} from '@engine';
import { DAM_KIND, SLOWEST, damTitle, enquiryLine } from '@engine/text/bulk';
import { f } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');

/** A farmer's enquiry: the dam sum, the surveyor, what your spread would take, and your price. */
export function EnquiryCard({ c, e, act }: { c: Career; e: FarmEnquiry; act: Act }) {
  const vol = pricingVol(e), d = damVolume(e.dam), spread = freeSpread(c), est = damEstimate(c as never, spread, vol, e.haul), price = quotePrice(e);
  return (
    <div className="card">
      <div className="row"><span className="chip c-job">FARM</span><span className="chip c-idle">{DAM_KIND[e.kind].toUpperCase()}</span><span className="grow" /><span className="tiny muted">{e.quoted ? 'Price sent' : 'Rang week ' + e.week}</span></div>
      <b>{damTitle(e)}</b>
      <div className="small muted">{enquiryLine(e)}</div>
      <div className="kv"><span>The dam sum (floor {n0(d.floorLength)} × {n0(d.floorWidth)} m)</span><span className="num">{n0(e.vol)} m³</span></div>
      {e.surveyed
        ? <div className="kv"><span>The surveyor's figure</span><b className="num">{n0(e.survey)} m³</b></div>
        : !e.quoted && <button type="button" className="btn full" disabled={c.bank < SURVEY_COST} onClick={() => act((x) => game.damSurvey(x, e.id))}>Get it surveyed · {f(SURVEY_COST)}</button>}
      {!e.surveyed && <div className="tiny muted">The plans assume flat ground. Paddocks aren't flat: the real dirt could be 10% under or 20% over, and you're paid for the price, not the dirt.</div>}
      <div className="tiny" style={{ background: 'var(--soft)', borderRadius: 10, padding: '10px 12px' }}>
        {est.perDay > 0
          ? <>With what's free in your yard: about <b>{est.days} working days</b> at {n0(est.perDay)} m³ a day, held up by {SLOWEST[est.slowest] ?? est.slowest}. The spread costs about {f(est.dayCost)} a day in fuel, servicing{est.casuals ? ' and ' + est.casuals + ' labour-hire operator' + (est.casuals > 1 ? 's' : '') + ' at ' + f(BULK_CASUAL) : ''}: {f(est.cost)} all up.{!est.compacted && ' No compactor: the wall won\'t be rolled.'}{!est.watered && ' No water cart.'}</>
          : <>Nothing free in your yard can move dirt yet: you need a dozer, or scrapers. Open-bowl scrapers (631, 651) need a dozer to push them.</>}
      </div>
      {e.quoted ? (
        <div className="small"><b>Price sent: {f(e.quoted)}.</b> {e.farm} will ring back next week.</div>
      ) : (
        <>
          <div className="row" style={{ padding: '6px 0' }}>
            <span className="grow small">Your rate</span>
            <button type="button" className="btn" onClick={() => act((x) => game.damRate(x, e.id, -0.1))}>−10c</button>
            <b className="num" style={{ minWidth: 76, textAlign: 'center' }}>${e.rate.toFixed(2)}/m³</b>
            <button type="button" className="btn" onClick={() => act((x) => game.damRate(x, e.id, 0.1))}>+10c</button>
          </div>
          <div className="kv"><b>Your price</b><b className="num" style={{ fontSize: 18 }}>{f(price)}</b></div>
          {est.perDay > 0 && <div className="tiny muted">After the spread's running costs: {f(price - est.cost)}. Wages, repayments and the yard come out of that.</div>}
          <button type="button" className="btn dark full" onClick={() => act((x) => game.damQuote(x, e.id))}>Send the price</button>
        </>
      )}
    </div>
  );
}

/** A dam on the go: dirt moved, the spread and who's driving, and what's holding it up. */
export function DamJobCard({ c, j }: { c: Career; j: Job }) {
  const ms = c.fleet.filter((m) => m.jobId === j.id), crew = (j.crew || {}) as Record<string, string>;
  const est = j.est as number, m3 = Math.min(j.m3 as number, j.truth as number), pct = Math.min(100, Math.round((m3 / est) * 100));
  const who = (id: string) => (id === 'you' ? 'You' : id === 'casual' ? 'labour hire' : c.staff.find((p) => p.id === id)?.name ?? '?');
  return (
    <div className="card">
      <div className="row"><span className="chip c-job">FARM DAM</span><span className="grow" /><span className="tiny muted">Fixed {f(j.fixed as number)}</span></div>
      <b>{damTitle(j as never)}</b>
      {j.state === 'waiting' ? (
        <div className="small muted">Waiting for a spread: a dozer, or scrapers (with a dozer to push open-bowl ones). {WAIT_WEEKS - (c.week - (j.won as number))} week{WAIT_WEEKS - (c.week - (j.won as number)) === 1 ? '' : 's'} before the farmer gets someone else.</div>
      ) : (
        <>
          <div className="row tiny"><span className="grow">{n0(m3)} m³ moved of about {n0(est)} priced</span><span className="num">{pct}%</span></div>
          <div className="bar"><i style={{ width: pct + '%', background: pct > 100 ? 'var(--rust)' : 'var(--teal)' }} /></div>
          {(j.m3 as number) > est && <div className="tiny" style={{ color: 'var(--rust)' }}>Past what you priced: there's more dirt in it than you allowed for, and the price is fixed.</div>}
          <div className="tiny muted">{ms.map((m) => TYPES[m.type].short + (m.down > 0 ? ' (broken down)' : '') + ': ' + who(crew[m.id] ?? 'casual')).join(' · ')}</div>
          {j.slowest ? <div className="tiny muted">Held up by {SLOWEST[j.slowest as string] ?? (j.slowest as string)}. Spent so far {f(j.spent || 0)}.</div> : null}
        </>
      )}
    </div>
  );
}
