// The Yard: the forecast, your yard, your machines, and your people.

import { useState } from 'react';
import { MGR, ROLES, SKILLS, TOWNS, YARDS, YARD_ORDER, forecast, machineName, monthIdx, odLimit, svcCost, value, game, type Machine, type YardId } from '@engine';
import { MachineIcon, WeatherIcon } from '../Icon';
import { MONTHS, f, fk } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;

const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function Forecast({ c }: { c: Career }) {
  const wx = { town: c.town, wxStart: c.wxStart }, fc = DN.map((_, d) => forecast(wx, c.week, d));
  return (
    <div className="card" style={{ background: 'var(--rain-soft)', borderColor: 'transparent' }}>
      <div className="row"><span className="sub grow" style={{ color: 'var(--rain)' }}>Forecast · {TOWNS[c.town].name}</span><span className="chip c-rain">{MONTHS[monthIdx(c.week)]}</span></div>
      <div className="fc">
        {fc.map((x, d) => (
          <div key={d} className="fcd">
            <b>{DN[d]}</b>
            <WeatherIcon pc={x.pc} wetGround={x.wetGround} />
            <span className="fcp">{x.wetGround ? 'Wet' : x.pc + '%'}</span>
            <span className="tiny muted">{x.wetGround ? 'ground' : x.fmm >= 2 ? '≈' + x.fmm + ' mm' : 'rain'}</span>
          </div>
        ))}
      </div>
      <div className="tiny muted">Chance of 4 mm or more, enough to stop a crew. {TOWNS[c.town].soil} Dry hire still pays in the wet.</div>
    </div>
  );
}

function YardCard({ c, act }: { c: Career; act: Act }) {
  const [open, setOpen] = useState(false);
  const Y = YARDS[c.yard], used = c.fleet.length;
  const lockFor = (k: YardId) => (k === 'depot' && !c.won ? 'Ready to subcontract' : k === 'regional' && !c.won2 ? 'Your own contract' : k === 'hub' && !c.won3 ? 'Regional contractor' : null);
  return (
    <>
      <div className="sub">Your yard</div>
      <div className="card">
        <div className="row"><b className="grow">{Y.name}</b><span className="num small">{used} of {Y.slots}</span></div>
        <div className="slots" aria-hidden="true">
          {Array.from({ length: Math.max(Y.slots, used) }, (_, i) => <span key={i} className={'slot' + (i < used ? ' full' : '')} style={i >= Y.slots ? { background: 'var(--rust)' } : undefined} />)}
        </div>
        <div className="small muted">{Y.blurb}{Y.rent ? ' Rent ' + f(Y.rent) + ' a week.' : ''}{c.camera ? ' Camera up.' : ''}</div>
        {game.room(c) <= 0 && <div className="why">Full. You can't buy another machine until you move or sell one.</div>}
        {open && YARD_ORDER.filter((k) => k !== c.yard).map((k) => {
          const X = YARDS[k], lock = lockFor(k);
          if (lock) return <div key={k} className="ycard" style={{ opacity: 0.6 }}><div className="row"><b className="grow">{X.name}</b><span className="chip c-idle">LOCKED</span></div><div className="small muted">Unlocks at {lock} on the Career ladder.</div></div>;
          const fits = used <= X.slots, can = fits && c.bank >= X.setup;
          return (
            <div key={k} className="ycard">
              <div className="row"><b className="grow">{X.name}</b><span className="num small">{X.slots} machines</span></div>
              <div className="small muted">{X.blurb}</div>
              <div className="small">{X.setup ? f(X.setup) + ' to set up, then ' : 'Free to move back, '}{X.rent ? f(X.rent) + ' a week rent.' : 'no rent.'}</div>
              <button type="button" className="btn dark" disabled={!can} onClick={() => act((x) => game.moveYard(x, k))}>Move here</button>
              {!fits ? <div className="why">Your {used} machines won't fit.</div> : !can && <div className="why">You have {f(c.bank)}.</div>}
            </div>
          );
        })}
        <div className="btns"><button type="button" className="btn" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Move yard'}</button></div>
      </div>
    </>
  );
}

function statusChip(m: Machine) {
  if (m.status === 'auction') return <span className="chip c-bad">AT AUCTION</span>;
  if (m.status === 'listed') return <span className="chip c-bad">FOR SALE</span>;
  if (m.down > 0) return <span className="chip c-bad">BROKEN DOWN</span>;
  if (m.status === 'job') return <span className="chip c-job">ON A JOB</span>;
  if (m.status === 'branch') return <span className="chip c-rain">AT THE BRANCH</span>;
  return <span className="chip c-idle">IDLE</span>;
}

function SellSheet({ c, m, act, onClose }: { c: Career; m: Machine; act: Act; onClose: () => void }) {
  const v = value(m, c.week), sell = (mode: 'trade' | 'auction' | 'list') => { act((x) => game.sellMachine(x, m.id, mode)); onClose(); };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Sell">
      <div className="sheet">
        <div className="sub">Sell</div>
        <h2>{machineName(m)}, {m.year}</h2>
        <div className="small muted">Worth about {f(v)}. How you sell changes what you get.</div>
        <button type="button" className="choice" onClick={() => sell('trade')}><b>Dealer trade-in · {f(v * 0.72)}</b><span>Cash today. The cheapest way to sell.</span></button>
        <button type="button" className="choice" onClick={() => sell('auction')}><b>Auction · {fk(v * 0.57)} to {fk(v * 0.93)}</b><span>Sold at the end of this week. Could go either way. 5% fee.</span></button>
        <button type="button" className="choice" onClick={() => sell('list')}><b>Private listing · about {f(Math.round((v * 0.95) / 500) * 500)}</b><span>Best price. Takes 2 to 5 weeks, and it can't work meanwhile.</span></button>
        <button type="button" className="btn full" onClick={onClose}>Keep it</button>
      </div>
    </div>
  );
}

function MachineCard({ c, m, act, onSell }: { c: Career; m: Machine; act: Act; onSell: () => void }) {
  const left = 250 - (m.hours - m.svcAt), w = game.wctx(c), cost = svcCost(m, w);
  const ci = m.cond < 45 ? 'var(--rust)' : m.cond < 65 ? 'var(--warn)' : 'var(--teal)';
  const paid = (m as Machine & { paid?: number; paidWk?: number });
  return (
    <div className="card">
      <div className="mhead"><MachineIcon type={m.type} /><div className="grow"><b>{machineName(m)}</b>{m.gps && <> <span className="chip c-rain">GPS</span></>}<span className="tiny muted">{m.year} model</span></div>{statusChip(m)}</div>
      {m.status === 'listed' && m.sale ? <div className="small muted">Listed at {f((m.sale as { price: number }).price)}. Sells in about {(m.sale as { weeks: number }).weeks} weeks.</div> : null}
      <div className="row tiny"><span className="grow">Condition</span><span className="num">{Math.round(m.cond)}%</span></div>
      <div className="bar"><i style={{ width: m.cond + '%', background: ci }} /></div>
      <div className="row tiny muted">
        <span className="grow num">{m.hours.toLocaleString('en-AU')} hrs</span>
        <span style={{ color: left < 0 ? 'var(--rust)' : left <= 45 ? 'var(--warn)' : 'inherit', fontWeight: left <= 45 ? 700 : 400 }}>{left < 0 ? 'Service overdue by ' + -left + ' hrs' : 'Service due in ' + left + ' hrs'}</span>
      </div>
      <div className="row tiny muted">
        <span className="grow">Worth about {fk(value(m, c.week))}{paid.paid ? ' · bought week ' + paid.paidWk + ' for ' + fk(paid.paid) : ''}</span>
        {m.warranty >= c.week && <span>Warranty to week {m.warranty}</span>}
      </div>
      {m.band && <div className="why">Patched-up {m.band.part} (week {m.band.w}). Breakdown odds are up until it's fixed properly.</div>}
      <div className="btns">
        <button type="button" className="btn" disabled={!(c.bank + odLimit(c) >= cost && m.status !== 'auction' && m.status !== 'listed')} onClick={() => act((x) => game.service(x, m.id))}>Service · {f(cost)}</button>
        {m.status === 'idle' && <button type="button" className="btn" onClick={onSell}>Sell</button>}
      </div>
    </div>
  );
}

export function YardTab({ c, act }: { c: Career; act: Act }) {
  const [selling, setSelling] = useState<string | null>(null);
  const sm = selling ? c.fleet.find((m) => m.id === selling) : undefined;
  const yj = c.youJob ? c.jobs.find((j) => j.id === c.youJob) : undefined;
  return (
    <>
      <Forecast c={c} />
      <YardCard c={c} act={act} />
      <div className="sub">Machines</div>
      {!c.fleet.length && <div className="card"><b>No machines.</b><div className="small muted">Buy one at the Market to get working again.</div></div>}
      {c.fleet.map((m) => <MachineCard key={m.id} c={c} m={m} act={act} onSell={() => setSelling(m.id)} />)}
      <div className="sub">People</div>
      <div className="card">
        <div className="row"><b className="grow">You</b>{c.youBlocked ? <span className="chip c-bad">COVERING</span> : yj ? <span className="chip c-job">DRIVING</span> : <span className="chip c-idle">FREE</span>}</div>
        <div className="small muted">{yj ? 'On a ' + yj.kind + ' job for ' + yj.client + '.' : 'Free to drive a machine on wet hire, council or private work.'}</div>
      </div>
      {c.staff.map((p) => {
        const M = p.trait ? MGR[p.trait as keyof typeof MGR] : undefined;
        return (
          <div key={p.id} className="card">
            <div className="row">
              <b className="grow">{p.name} <span className="small muted" style={{ fontWeight: 400 }}>{ROLES[p.role].name}</span></b>
              {p.off ? <span className="chip c-bad">OFF {p.off} WK</span> : p.jobId ? <span className="chip c-job">ON A JOB</span> : <span className="chip c-idle">FREE</span>}
            </div>
            {M ? (
              <><div className="small"><b>{M.n}.</b> {M.good}</div><div className="small" style={{ color: 'var(--rust)' }}>{M.bad}</div><div className="small muted">{f(p.wage)} a week, working or not.</div></>
            ) : (
              <div className="small muted">{SKILLS[p.skill].name}. {ROLES[p.role].note} {f(p.wage)} a week, working or not.</div>
            )}
          </div>
        );
      })}
      {sm && <SellSheet c={c} m={sm} act={act} onClose={() => setSelling(null)} />}
    </>
  );
}
