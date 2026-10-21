// The Yard: the forecast, what the workshop should look at, your yard and the branch depot, your machines
// (cards, or a compact list for a big fleet), your people and the labour board, managers, and safety.

import { useState } from 'react';
import {
  BULK_TYPES, ERP_SETUP, ERP_WEEK, erpOk, BR_FLOAT, BR_MGR, BR_RENT, BR_SETUP, BR_SLOTS, GPS_COST, MGR, ROLES, SKILLS, TOWNS, COMP_AFTER, COMP_SHARE, wageNow, WHS_SYS, YARDS, YARD_ORDER,
  bigNoWsm, brCrews, brMachines, brProfit, brTown, canBranch, fitPer, fitters, forecast, lastInc, machineAlerts, machineName,
  mgrOf, mgrUnlocked, monthIdx, nextWhs, odLimit, premParts, recentInc, riskMult, svcCost, unlocked, value, whsNp, fleetValue, wages,
  RT_COST, compat, game, type Machine, type MachineType, type YardId, play,
} from '@engine';
import { ERP_NAME, alertText } from '@engine/text/office';
import { jobTitle } from '@engine/text/work';
import { MachineIcon, WeatherIcon } from '../Icon';
import { FuelCard } from './Fuel';
import { MONTHS, f, fk } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
type Go = (tab: 'bank') => void;

const DN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MGR_ROLE = { ops: 'operations manager', wsm: 'workshop manager' } as const;
const fks = (n: number) => (n < 0 ? '−' : '') + fk(Math.abs(n));

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

/** What the workshop should look at, one row per machine, worst first. */
function Alerts({ c, act }: { c: Career; act: Act }) {
  const al = machineAlerts(c.fleet);
  if (!al.length) return null;
  const by: { m: Machine; bad: boolean; t: string[] }[] = [];
  for (const a of al) {
    let g = by.find((x) => x.m.id === a.id);
    if (!g) by.push((g = { m: c.fleet.find((m) => m.id === a.id)!, bad: false, t: [] }));
    if (a.k === 'overdue' || a.k === 'wornOut' || a.k === 'badlyWorn') g.bad = true;
    const t = alertText(a, c.fleet).replace(/^The [a-z ]+? is /, '');
    g.t.push(t.charAt(0).toUpperCase() + t.slice(1));
  }
  by.sort((a, b) => Number(b.bad) - Number(a.bad));
  const w = game.wctx(c);
  return (
    <div className="card" style={{ borderColor: 'var(--hi)', borderWidth: 2 }}>
      <div className="sub" style={{ color: 'var(--rust)' }}>Workshop · {by.length} machine{by.length > 1 ? 's' : ''} to look at</div>
      {by.map((g) => {
        const cost = svcCost(g.m, w);
        return (
          <div key={g.m.id} className={'alert ' + (g.bad ? 'bad' : 'warn')}>
            <span className="flag" /><MachineIcon type={g.m.type} rt={g.m.rt} />
            <div className="grow"><b>{machineName(g.m)}, {g.m.year}</b><ul>{g.t.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <button type="button" className="btn" disabled={c.bank + odLimit(c) < cost} onClick={() => act((x) => play.service(x, g.m.id))}>Service · {fk(cost)}</button>
          </div>
        );
      })}
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
              <button type="button" className="btn dark" disabled={!can} onClick={() => act((x) => play.moveYard(x, k))}>Move here</button>
              {!fits ? <div className="why">Your {used} machines won't fit.</div> : !can && <div className="why">You have {f(c.bank)}.</div>}
            </div>
          );
        })}
        <div className="btns"><button type="button" className="btn" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Move yard'}</button></div>
      </div>
    </>
  );
}

/** The branch depot in the other town: open one, or run the one you've got. */
function BranchCard({ c, act }: { c: Career; act: Act }) {
  const [closing, setClosing] = useState(false);
  const B = c.branch, other = TOWNS[brTown(c.town)].name;
  if (!B) {
    if (!c.won3) return null;
    const why = !(c.yard === 'regional' || c.yard === 'hub') ? 'You need a regional depot or a plant hub at home first.' : c.bank < BR_SETUP ? 'You need ' + f(BR_SETUP) + ' to set it up.' : '';
    return (
      <>
        <div className="sub">Grow into {other}</div>
        <div className="card">
          <b>Open a branch depot in {other}</b>
          <div className="small muted">A shed, a yard and a manager in {other}, working its own rain and its own shires. Send machines there and the manager keeps them busy. Set-up {f(BR_SETUP)}, rent {f(BR_RENT)} a week, floating a machine there {f(BR_FLOAT)}.</div>
          {why || !canBranch(c as never) ? <div className="why">{why || 'Not yet.'}</div> : (Object.keys(BR_MGR) as (keyof typeof BR_MGR)[]).map((k) => (
            <button key={k} type="button" className="choice" onClick={() => act((x) => play.openBranchDepot(x, k))}>
              <b>Open it with {BR_MGR[k].t.toLowerCase()} · {f(BR_MGR[k].wage)}/wk</b><span>{BR_MGR[k].d}</span>
            </button>
          ))}
        </div>
      </>
    );
  }
  const C = brCrews(c.fleet), H = (B.hist || []).slice(-13), days = H.reduce((a, x) => a + x.days, 0), can = H.reduce((a, x) => a + x.crews * x.dry, 0), p13 = brProfit(B, 13);
  return (
    <>
      <div className="sub">{other} branch</div>
      <div className="card">
        <div className="row"><b className="grow">{other} depot</b><span className="chip c-rain">{brMachines(c.fleet).length} OF {BR_SLOTS} MACHINES</span></div>
        {B.mgr ? (
          <div className="small muted">Run by {B.mgr.name}, {BR_MGR[B.mgr.skill as keyof typeof BR_MGR].t.toLowerCase()}, {f(B.mgr.wage)} a week.</div>
        ) : (
          <>
            <div className="why">No manager. The crews are only getting scraps of work.</div>
            {(Object.keys(BR_MGR) as (keyof typeof BR_MGR)[]).map((k) => <button key={k} type="button" className="btn full" onClick={() => act((x) => play.hireBranchManager(x, k))}>Hire {BR_MGR[k].t.toLowerCase()} · {f(BR_MGR[k].wage)}/wk</button>)}
          </>
        )}
        <div className="kv"><span>Full crews there</span><span className="num">{C.n}{C.n && C.pace < 1 ? ' · short a water cart each' : ''}</span></div>
        <div className="kv"><span>Profit, last {H.length} weeks</span><span className="num" style={{ color: p13 < 0 ? 'var(--rust)' : 'var(--teal)' }}>{fks(p13)}</span></div>
        {can > 0 && <div className="kv"><span>Crews worked</span><span className="num">{Math.round((days / can) * 100)}% of dry days</span></div>}
        {B.boost && B.boost.until >= c.week && <div className="kv"><span>Council package on</span><span className="num">to week {B.boost.until}</span></div>}
        <div className="row tiny"><span className="grow">Local reputation</span><span className="num">{Math.round(B.rep)} of 100</span></div>
        <div className="bar"><i style={{ width: B.rep + '%', background: 'var(--teal)' }} /></div>
        <div className="tiny muted">A full crew is a grader, a roller and a water cart (two carts keeps it at full pace). Reputation grows with every week the crews work, faster with a good safety system. Send idle machines from the list below; floating one either way costs {f(BR_FLOAT)}.</div>
        {closing ? (
          <>
            <div className="why">Close the branch? The gear floats home and the set-up is gone.</div>
            <div className="btns">
              <button type="button" className="btn dark" onClick={() => { act((x) => play.closeBranchDepot(x)); setClosing(false); }}>Close it</button>
              <button type="button" className="btn" onClick={() => setClosing(false)}>Keep it</button>
            </div>
          </>
        ) : <button type="button" className="btn full" onClick={() => setClosing(true)}>Close the branch</button>}
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
  const v = value(m, c.week), sell = (mode: 'trade' | 'auction' | 'list') => { act((x) => play.sellMachine(x, m.id, mode)); onClose(); };
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

const svcLeftOf = (m: Machine) => 250 - (m.hours - m.svcAt);
const condColour = (m: Machine) => (m.cond < 45 ? 'var(--rust)' : m.cond < 65 ? 'var(--warn)' : 'var(--teal)');

function MachineCard({ c, m, act, onSell, onClose }: { c: Career; m: Machine; act: Act; onSell: () => void; onClose?: () => void }) {
  const left = svcLeftOf(m), w = game.wctx(c), cost = svcCost(m, w), j = m.jobId ? c.jobs.find((x) => x.id === m.jobId) : undefined;
  const paid = m as Machine & { paid?: number; paidWk?: number }, B = c.branch;
  return (
    <div className="card">
      <div className="mhead"><MachineIcon type={m.type} rt={m.rt} /><div className="grow"><b>{machineName(m)}</b>{m.gps && <> <span className="chip c-rain">GPS</span></>}{m.rt && <span className="tiny muted" style={{ display: 'block' }}>A second trailer: carts about half as much again a day as a single, on more fuel.</span>}<span className="tiny muted">{m.year} model</span></div>{statusChip(m)}</div>
      {onClose && <button type="button" className="btn" onClick={onClose}>Close</button>}
      {j && <div className="small muted">{jobTitle(j)}</div>}
      {m.status === 'listed' && m.sale ? <div className="small muted">Listed at {f((m.sale as { price: number }).price)}. Sells in about {(m.sale as { weeks: number }).weeks} weeks.</div> : null}
      <div className="row tiny"><span className="grow">Condition</span><span className="num">{Math.round(m.cond)}%</span></div>
      <div className="bar"><i style={{ width: m.cond + '%', background: condColour(m) }} /></div>
      <div className="row tiny muted">
        <span className="grow num">{m.hours.toLocaleString('en-AU')} hrs</span>
        <span style={{ color: left < 0 ? 'var(--rust)' : left <= 45 ? 'var(--warn)' : 'inherit', fontWeight: left <= 45 ? 700 : 400 }}>{left < 0 ? 'Service overdue by ' + -left + ' hrs' : 'Service due in ' + left + ' hrs'}</span>
      </div>
      <div className="row tiny muted">
        <span className="grow">Worth about {fk(value(m, c.week))}{paid.paid ? ' · bought week ' + paid.paidWk + ' for ' + fk(paid.paid) : ''}</span>
        {m.warranty >= c.week && <span>Warranty to week {m.warranty}</span>}
      </div>
      {m.band && <div className="why">Patched-up {m.band.part} (week {m.band.w}). Breakdown odds are up until it's fixed properly{m.status === 'job' ? ', and fixing it stands the machine down 2 days' : ''}.</div>}
      <div className="btns" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={!(c.bank + odLimit(c) >= cost && m.status !== 'auction' && m.status !== 'listed')} onClick={() => act((x) => play.service(x, m.id))}>Service · {f(cost)}</button>
        {m.band && <button type="button" className="btn" disabled={c.bank < m.band.fix} onClick={() => act((x) => play.fixProperly(x, m.id))}>Fix properly · {fk(m.band.fix)}</button>}
        {c.won && m.type === 'grader' && !m.gps && m.status !== 'auction' && m.status !== 'listed' && <button type="button" className="btn" disabled={c.bank < GPS_COST} onClick={() => act((x) => play.fitGps(x, m.id))}>Fit GPS · {fk(GPS_COST)}</button>}
        {!compat.prototype && m.type === 'truck' && !m.rt && m.status !== 'auction' && m.status !== 'listed' && <button type="button" className="btn" disabled={c.bank < RT_COST} onClick={() => act((x) => play.upgradeRoadtrain(x, m.id))}>Make it a roadtrain · {fk(RT_COST)}</button>}
        {m.status === 'idle' && <button type="button" className="btn" onClick={onSell}>Sell</button>}
        {B && m.status === 'idle' && m.down === 0 && brMachines(c.fleet).length < BR_SLOTS && <button type="button" className="btn" disabled={c.bank < BR_FLOAT} onClick={() => act((x) => play.sendToBranch(x, m.id))}>Send to {TOWNS[B.town].name} · {fk(BR_FLOAT)}</button>}
        {m.status === 'branch' && <button type="button" className="btn" disabled={c.bank < BR_FLOAT || game.room(c) <= 0} onClick={() => act((x) => play.bringHome(x, m.id))}>Bring home · {fk(BR_FLOAT)}</button>}
        {m.status === 'listed' && <button type="button" className="btn" onClick={() => act((x) => play.unlistMachine(x, m.id))}>Take off sale</button>}
      </div>
    </div>
  );
}

/** One line for a machine in the compact list. */
function MachineRow({ c, m, onOpen }: { c: Career; m: Machine; onOpen: () => void }) {
  const left = svcLeftOf(m), j = m.jobId ? c.jobs.find((x) => x.id === m.jobId) : undefined;
  return (
    <button type="button" className="card" onClick={onOpen} style={{ textAlign: 'left', cursor: 'pointer', padding: '10px 14px', gap: 4, font: 'inherit', color: 'inherit', width: '100%' }}>
      <span className="mhead"><MachineIcon type={m.type} rt={m.rt} /><span className="grow"><b>{machineName(m)}, {m.year}</b>{m.gps && <> <span className="chip c-rain">GPS</span></>}<br /><span className="tiny muted">{j ? jobTitle(j) : m.status === 'idle' ? 'In the yard' : ''}</span></span>{statusChip(m)}</span>
      <span className="row tiny">
        <span className="grow" style={{ color: condColour(m), fontWeight: 600 }}>{Math.round(m.cond)}%</span>
        <span style={{ color: left < 0 ? 'var(--rust)' : left <= 45 ? 'var(--warn)' : 'var(--muted)' }}>{left < 0 ? 'Service overdue' : 'Service in ' + left + ' hrs'}</span>
        {m.band && <span style={{ color: 'var(--rust)', fontWeight: 600 }}> · patched</span>}
      </span>
    </button>
  );
}

const FLEET_ORDER: MachineType[] = ['grader', 'roller', 'cart', 'truck', 'loader', ...BULK_TYPES];
const FLEET_PL: Record<MachineType, string> = {
  grader: 'Graders', roller: 'Rollers', cart: 'Water carts', truck: 'Side tippers', loader: 'Loaders',
  d6: 'D6 dozers', d8: 'D8 dozers', d9: 'D9 dozers', d10: 'D10 dozers', pull: 'Pull scrapers', s623: '623 scrapers', s627: '627 scrapers', s631: '631 scrapers', s637: '637 scrapers',
  s651: '651 scrapers', s657: '657 scrapers', padfoot: 'Padfoot rollers', c815: '815 compactors', c825: '825 compactors', excavator: 'Excavators', moxy: 'Moxies', moxycart: 'Moxy water carts',
};
type Filter = 'all' | 'idle' | 'attn' | MachineType;
const needsWork = (m: Machine) => m.down > 0 || !!m.band || svcLeftOf(m) <= 45 || m.cond < 65;

/** The machines: a summary by type, filters, and full cards or a compact list. */
function Fleet({ c, act, onSell }: { c: Career; act: Act; onSell: (id: string) => void }) {
  const [F, setF] = useState<Filter>('all');
  const [list, setList] = useState(false);
  const [openId, setOpen] = useState<string | null>(null);
  const big = c.fleet.length >= 4;
  const shown = c.fleet
    .filter((m) => !big || F === 'all' || m.type === F || (F === 'idle' && m.status === 'idle' && m.down === 0) || (F === 'attn' && needsWork(m)))
    .sort((a, b) => FLEET_ORDER.indexOf(a.type) - FLEET_ORDER.indexOf(b.type) || Number(b.down > 0) - Number(a.down > 0) || Number(a.status === 'job') - Number(b.status === 'job') || b.year - a.year);
  const types = FLEET_ORDER.filter((k) => c.fleet.some((m) => m.type === k));
  const chip = (v: Filter, t: string) => <button key={v} type="button" className={'btn' + (F === v ? ' dark' : '')} onClick={() => setF(v)} style={{ minHeight: 36, padding: '0 10px' }}>{t}</button>;
  return (
    <>
      <div className="sub">Machines</div>
      {!c.fleet.length && <div className="card"><b>No machines.</b><div className="small muted">Buy one at the Market to get working again.</div></div>}
      {big && (
        <div className="card">
          {types.map((k) => {
            const ms = c.fleet.filter((m) => m.type === k), on = ms.filter((m) => m.status === 'job').length, idle = ms.filter((m) => m.status === 'idle' && m.down === 0).length;
            const br = ms.filter((m) => m.down > 0).length, sale = ms.filter((m) => m.status === 'auction' || m.status === 'listed').length;
            return (
              <div key={k} className="kv">
                <span className="row" style={{ gap: 10 }}><MachineIcon type={k} /><span>{FLEET_PL[k]} <b className="num">{ms.length}</b></span></span>
                <span className="small muted">{[on ? on + ' working' : '', idle ? idle + ' idle' : '', br ? br + ' broken' : '', sale ? sale + ' for sale' : ''].filter(Boolean).join(' · ')}</span>
              </div>
            );
          })}
          <div className="btns" style={{ flexWrap: 'wrap' }}>
            {chip('all', 'All ' + c.fleet.length)}
            {types.map((k) => chip(k, FLEET_PL[k]))}
            {chip('idle', 'Idle ' + c.fleet.filter((m) => m.status === 'idle' && m.down === 0).length)}
            {chip('attn', 'Needs work ' + c.fleet.filter(needsWork).length)}
          </div>
          <div className="row"><span className="grow tiny muted">{list ? 'Tap a machine to open it.' : 'Full cards.'}</span><button type="button" className="btn" style={{ minHeight: 36 }} onClick={() => { setList(!list); setOpen(null); }}>{list ? 'Show cards' : 'Compact list'}</button></div>
        </div>
      )}
      {shown.map((m) => (list && openId !== m.id
        ? <MachineRow key={m.id} c={c} m={m} onOpen={() => setOpen(m.id)} />
        : <MachineCard key={m.id} c={c} m={m} act={act} onSell={() => onSell(m.id)} onClose={list ? () => setOpen(null) : undefined} />))}
    </>
  );
}

/** Your people: you, your staff, and letting someone go (tap twice). */
function People({ c, act }: { c: Career; act: Act }) {
  const [going, setGoing] = useState<string | null>(null);
  const yj = c.youJob ? c.jobs.find((j) => j.id === c.youJob) : undefined;
  return (
    <>
      <div className="sub">People</div>
      <div className="card">
        <div className="row"><b className="grow">You</b>{c.youBlocked ? <span className="chip c-bad">COVERING</span> : yj ? <span className="chip c-job">DRIVING</span> : <span className="chip c-idle">FREE</span>}</div>
        <div className="small muted">{yj ? jobTitle(yj) : 'Free to drive a machine on wet hire, council or private work.'}</div>
      </div>
      {c.staff.map((p) => {
        const M = p.trait ? MGR[p.trait as keyof typeof MGR] : undefined, oj = p.jobId ? c.jobs.find((j) => j.id === p.jobId) : undefined;
        return (
          <div key={p.id} className="card">
            <div className="row">
              <b className="grow">{p.name} <span className="small muted" style={{ fontWeight: 400 }}>{ROLES[p.role].name}</span></b>
              {p.off ? <span className="chip c-bad">OFF {p.off} WK</span> : p.jobId ? <span className="chip c-job">ON A JOB</span> : <span className="chip c-idle">FREE</span>}
            </div>
            {M ? (
              <><div className="small"><b>{M.n}.</b> {M.good}</div><div className="small" style={{ color: 'var(--rust)' }}>{M.bad}</div><div className="small muted">{f(p.wage)} a week, working or not.</div></>
            ) : (
              <div className="small muted">{oj ? jobTitle(oj) + '. ' : ''}{SKILLS[p.skill].name}. {ROLES[p.role].note} {f(p.wage)} a week, working or not.</div>
            )}
            {p.inj && p.off > 0 && (
              <div className="small" style={{ color: 'var(--rust)' }}>
                Off injured. {p.inj.rep
                  ? p.inj.wk >= COMP_AFTER ? `Workers' compensation pays ${Math.round(COMP_SHARE * 100)}% of their wage: you pay ${f(wageNow(p))} a week.` : `Workers' compensation pays ${Math.round(COMP_SHARE * 100)}% of their wage once they've been off ${COMP_AFTER} weeks.`
                  : 'No claim was lodged, so you pay their whole wage.'}
              </div>
            )}
            {(p.unpaid ?? 0) > 0 && <div className="small muted">Home without pay for {p.unpaid} more week{p.unpaid === 1 ? '' : 's'}.</div>}
            <div className="btns">
              <button type="button" className="btn" disabled={!!p.jobId} onClick={() => { if (going === p.id) { act((x) => play.letGo(x, p.id)); setGoing(null); } else setGoing(p.id); }}>
                {going === p.id ? (p.inj && p.off > 0 ? 'Tap again: let ' + p.name + ' go while they\'re off injured' : 'Tap again: let ' + p.name + ' go with a week\'s pay') : 'Let ' + p.name + ' go'}
              </button>
            </div>
            {going === p.id && p.inj && p.off > 0 && <div className="small" style={{ color: 'var(--rust)' }}>Letting someone go while they're off hurt at work can bring an unfair dismissal claim.</div>}
          </div>
        );
      })}
    </>
  );
}

/** Managers: an operations manager and a workshop manager, and how far your fitters stretch. */
function Managers({ c, onOpen }: { c: Career; onOpen: (role: 'ops' | 'wsm') => void }) {
  if (!c.won) return null;
  if (!c.won2) {
    return (
      <>
        <div className="sub">Managers</div>
        <div className="card"><div className="row"><b className="grow">Operations and workshop managers</b><span className="chip c-idle">LOCKED</span></div><div className="small muted">Unlocks at Your own contract on the Career ladder. A manager is a big wage, so you'll pick the one that suits how you run things.</div></div>
      </>
    );
  }
  const ws = YARDS[c.yard].svc < 1, nf = fitters(c.staff).length, hf = game.homeFleet(c), per = fitPer(c.staff), cov = Math.min(hf, nf * per);
  return (
    <>
      <div className="sub">Managers</div>
      {(['ops', 'wsm'] as const).map((role) => {
        if (mgrOf(c.staff, role) || c.staff.some((x) => x.role === role)) return null;
        const can = mgrUnlocked(role, c.won2, ws), M = c.mgrs?.[role];
        return (
          <div key={role} className="card">
            <div className="row"><b className="grow">{role === 'ops' ? 'Operations manager' : 'Workshop manager'}</b><span className="chip c-idle">VACANT</span></div>
            <div className="small muted">{ROLES[role].note}</div>
            {!can ? <div className="why">Needs a depot with a workshop.</div> : M && M.c.length ? <button type="button" className="btn dark" onClick={() => onOpen(role)}>See who's applied ({M.c.length})</button> : <div className="small muted">Nobody's applied yet. Ads go out every 12 weeks.</div>}
          </div>
        );
      })}
      {ws && (
        <div className="card">
          <div className="row"><b className="grow">Workshop cover</b><span className="num small">{cov} of {hf} machines</span></div>
          <div className="bar"><i style={{ width: (hf ? (cov / hf) * 100 : 0) + '%', background: cov >= hf ? 'var(--teal)' : 'var(--warn)' }} /></div>
          <div className="small muted">
            {nf ? nf + ' fitter' + (nf > 1 ? 's' : '') + ', each looking after ' + per + ' machines.' : 'No fitters yet. Each fitter looks after ' + per + ' machines.'}
            {cov < hf ? ' The rest get no workshop care, so they break down more.' : ''}
            {bigNoWsm(c.staff, hf) ? ' With more than 12 machines and nobody running the workshop, breakdowns are up 25%.' : ''}
          </div>
        </div>
      )}
    </>
  );
}

function MgrSheet({ c, role, act, onClose }: { c: Career; role: 'ops' | 'wsm'; act: Act; onClose: () => void }) {
  const M = c.mgrs?.[role];
  if (!M) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Choose a manager">
      <div className="sheet">
        <div className="sub">Applications · week {M.w}</div>
        <h2>Your {MGR_ROLE[role]}</h2>
        <div className="small muted">Three people want the job. Each is good at something and costs you somewhere else. New applications come in every 12 weeks.</div>
        {(M.c as { id: string; name: string; trait: keyof typeof MGR; ask: number }[]).map((x) => {
          const T = MGR[x.trait];
          return (
            <div key={x.id} className="card">
              <div className="row"><b className="grow">{x.name}</b><span className="num">{f(x.ask)}/wk</span></div>
              <div className="small" style={{ fontWeight: 600 }}>{T.n}</div>
              <div className="small"><span style={{ color: 'var(--teal)', fontWeight: 700 }}>+</span> {T.good}</div>
              <div className="small"><span style={{ color: 'var(--rust)', fontWeight: 700 }}>−</span> {T.bad}</div>
              <div className="tiny muted">About {fk(x.ask * 52)} a year. It goes into your overheads, so it adds about {fk(x.ask * 10)} to a 10-week council price at full overheads.</div>
              <button type="button" className="btn dark" onClick={() => { act((y) => play.hireManager(y, role, x.id)); onClose(); }}>Hire {x.name}</button>
            </div>
          );
        })}
        <button type="button" className="btn full" onClick={onClose}>Not now</button>
      </div>
    </div>
  );
}

const SEVS: [string, string][] = [['serious', 'serious'], ['lti', 'lost-time'], ['medical', 'medical'], ['first aid', 'first aid']];

/** Insurance, and once head contractors want paperwork, your safety system, crew culture and toolbox talks. */
function Safety({ c, act }: { c: Career; act: Act }) {
  const P0 = premParts(fleetValue(c.fleet, c.week), wages(c.staff)), prem = game.premiumNow(c);
  if (!unlocked(c as never, 'swms')) {
    return (
      <>
        <div className="sub">Insurance</div>
        <div className="card">
          <div className="kv"><span>Insurance</span><span className="num">{f(prem)} a week</span></div>
          <div className="tiny muted">Public liability {f(P0.base)} and plant cover {f(P0.plant)}{P0.comp ? ", workers' comp " + f(P0.comp) : ''}. Nobody asks an owner-operator for paperwork yet. Once you grow to a small fleet, head contractors will want SWMS.</div>
        </div>
      </>
    );
  }
  const W = c.whs, cur = WHS_SYS[W.sys]!, nx = WHS_SYS[W.sys + 1], lti = lastInc(W, ['lti', 'serious']), cc = W.cult >= 70 ? 'var(--teal)' : W.cult >= 40 ? 'var(--warn)' : 'var(--rust)';
  const yr = (sev: string) => recentInc(W, [sev as never], 52, c.week), solo = !c.staff.length && c.fleet.length < 2 && !W.talks, np = whsNp(W, c.week);
  const st = nx ? nextWhs(c as never, { swms: true, won: c.won, won2: c.won2 }) : 'max';
  return (
    <>
      <div className="sub">Safety</div>
      <div className="card">
        <div className="row"><b className="grow">{cur.n}</b><span className={'chip ' + (W.sys >= 2 ? 'c-job' : W.sys ? 'c-idle' : 'c-bad')}>LEVEL {W.sys} OF 3</span></div>
        <div className="small muted">{cur.d}</div>
        <div className="kv"><span>Since the last lost-time injury</span><span className="num">{lti == null ? 'None yet' : c.week - lti + ' weeks'}</span></div>
        <div className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}><b>Last 12 months:</b> {SEVS.map((x) => yr(x[0]) + ' ' + x[1]).join(' · ')}. Near misses reported: {yr('near miss')}.</div>
        {solo ? (
          <div className="tiny muted" style={{ paddingTop: 6 }}>Just you for now. Crew culture and toolbox talks show up here once you have a second machine or someone on the payroll.</div>
        ) : (
          <>
            <div className="row tiny"><span className="grow">Crew culture</span><span className="num">{Math.round(W.cult)}</span></div>
            <div className="bar"><i style={{ width: W.cult + '%', background: cc }} /></div>
            <div className="tiny muted">How seriously your crew take safety. It moves with what you do when it matters: near misses, toolbox talks, how you treat someone who's hurt or doing it tough.</div>
            <div className="kv"><span>Incident risk</span><span className="num">{Math.round(riskMult(W, game.diff(c)) * 100)}% of a typical outfit</span></div>
            {c.won2 && <div className="kv"><span>Council non-price score</span><span className="num">{np >= 0 ? '+' : ''}{np} for safety</span></div>}
            {c.won || W.talks ? (
              <div className="row" style={{ paddingTop: 6 }}>
                <span className="grow"><b className="small">Toolbox talks every Monday</b><br /><span className="tiny muted">{f(150)} a crew a week in lost time. Risk −15%, and culture builds.</span></span>
                <button type="button" className={'btn' + (W.talks ? ' dark' : '')} aria-pressed={!!W.talks} onClick={() => act((x) => play.toggleTalks(x))}>{W.talks ? 'On' : 'Off'}</button>
              </div>
            ) : <div className="tiny muted" style={{ paddingTop: 6 }}>Toolbox talks unlock at Ready to subcontract.</div>}
          </>
        )}
        {nx && (
          <div className="ycard">
            <div className="row"><b className="grow">Next: {nx.n}</b><span className="num small">{f(nx.cost)}</span></div>
            <div className="small muted">{nx.d}</div>
            <div className="small">{nx.wk ? f(nx.wk) + ' a week to keep up. ' : ''}Incident risk {Math.round(nx.risk * 100)}% of nothing written down{nx.np ? ', council non-price +' + nx.np : ''}.</div>
            <button type="button" className="btn dark" disabled={st !== 'ok'} onClick={() => act((x) => play.upgradeSafety(x))}>Ring DDES Advisory to set it up</button>
            {st === 'locked' && <div className="why">{nx.need === 'won' ? 'Unlocks at Ready to subcontract.' : 'Unlocks once you tender for council work.'}</div>}
          </div>
        )}
        <div className="kv"><span>Insurance</span><span className="num">{f(prem)} a week</span></div>
        <div className="tiny muted">Public liability {f(P0.base)}, plant cover {f(P0.plant)}, workers' comp {f(P0.comp)}{Math.abs(c.ins - 1) > 0.005 ? ', with your claims record loading it ' + (c.ins > 1 ? '+' : '') + Math.round((c.ins - 1) * 100) + '%' : ''}{W.sys >= 3 ? ', less 10% for certification' : ''}. Loadings ease back over a year without claims.</div>
        {erpOk(c.yard) || c.erp ? (
          <div className="ycard">
            <div className="row"><b className="grow">{ERP_NAME}</b>{c.erp ? <span className="chip c-job">RUNNING</span> : <span className="num small">{f(ERP_SETUP)}</span>}</div>
            <div className="small muted">One system for the whole outfit: prestarts, inductions, SWMS, incidents, timesheets and servicing, all in one place. Takes the grind out of WHS and compliance.</div>
            <div className="small">{c.erp ? 'Saving' : 'Would save'} about {f(game.erpSaving(c))} a week, after its own {f(ERP_WEEK)} a week: half the safety-system upkeep, a quarter off toolbox talks, 5% off insurance and 3% off your overheads.</div>
            {!c.erp && <button type="button" className="btn dark" disabled={c.bank < ERP_SETUP} onClick={() => act((x) => play.buyErp(x))}>Put it in</button>}
          </div>
        ) : YARD_ORDER.indexOf(c.yard) >= YARD_ORDER.indexOf('depot') ? <div className="tiny muted">{ERP_NAME}, which cuts WHS and compliance costs, comes with a regional depot.</div> : null}
      </div>
    </>
  );
}

/** The labour board: this week's applicants. Hire at their asking wage, or offer 12% less and take your chances. */
function HireSheet({ c, act, onClose }: { c: Career; act: Act; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const go = (id: string, haggle: boolean) => {
    const cd = c.cands.find((x) => x.id === id)!;
    act((x) => {
      const r = play.hireCand(x, id, haggle);
      if (r?.k === 'hired') setMsg(cd.name + ' starts Monday as your ' + ROLES[cd.role].name.toLowerCase() + ' at ' + f(r.wage) + ' a week.');
      if (r?.k === 'walked') setMsg(cd.name + ' wanted ' + f(r.ask) + ' and took a job with ' + r.rival + ' instead.');
    });
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Hire staff">
      <div className="sheet">
        <div className="sub">Labour board · week {c.week}</div>
        <h2>Who's after work</h2>
        <div className="small muted">New faces every week. Offer less and you might save 12%, or they might walk.</div>
        {msg && <div className="card" style={{ border: '2px solid var(--ink)' }}><div className="small">{msg}</div></div>}
        {!c.cands.length && <div className="card small muted">Nobody else this week.</div>}
        {c.cands.map((x) => {
          const R = ROLES[x.role], offer = Math.round((x.ask * 0.88) / 50) * 50, be = R.casual ? (x.ask / R.casual).toFixed(1) : '';
          return (
            <div key={x.id} className="card">
              <div className="row"><b className="grow">{x.name}</b><span className={'chip ' + (x.skill === 'gun' ? 'c-job' : x.skill === 'green' ? 'c-bad' : 'c-idle')}>{SKILLS[x.skill].name.toUpperCase()}</span></div>
              <div className="small">{R.name}. {R.note}</div>
              <div className="small muted">{SKILLS[x.skill].note}{x.keen ? ' New in town and keen for a start.' : ''} Asking {f(x.ask)} a week{R.casual ? ': cheaper than a casual if they work more than ' + be + ' days a week.' : '. Labour hire has nobody like this.'}</div>
              <div className="btns">
                <button type="button" className="btn dark" onClick={() => go(x.id, false)}>Hire at {f(x.ask)}</button>
                <button type="button" className="btn" onClick={() => go(x.id, true)}>Offer {f(offer)}</button>
              </div>
            </div>
          );
        })}
        <button type="button" className="btn full" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

export function YardTab({ c, act, go }: { c: Career; act: Act; go: Go }) {
  const [selling, setSelling] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [mgr, setMgr] = useState<'ops' | 'wsm' | null>(null);
  const sm = selling ? c.fleet.find((m) => m.id === selling) : undefined;
  return (
    <>
      <Forecast c={c} />
      <Alerts c={c} act={act} />
      <YardCard c={c} act={act} />
      {!compat.prototype && <FuelCard c={c} act={act} />}
      <BranchCard c={c} act={act} />
      <Fleet c={c} act={act} onSell={setSelling} />
      <People c={c} act={act} />
      <Managers c={c} onOpen={setMgr} />
      <Safety c={c} act={act} />
      <div className="card">
        <b>Hire staff</b>
        <div className="small muted">Staff cost a weekly wage, working or not. Casuals from labour hire cost {f(ROLES.roller.casual)}–{f(ROLES.grader.casual)} a day, but only on days they work.</div>
        <div className="btns"><button type="button" className="btn dark" onClick={() => setHiring(true)}>See who's after work{c.cands.length ? ' (' + c.cands.length + ')' : ''}</button></div>
      </div>
      <div className="card"><div className="row"><b className="grow">Loan, overdraft and finance</b><button type="button" className="btn" onClick={() => go('bank')}>Go to the bank</button></div></div>
      {sm && <SellSheet c={c} m={sm} act={act} onClose={() => setSelling(null)} />}
      {hiring && <HireSheet c={c} act={act} onClose={() => setHiring(false)} />}
      {mgr && <MgrSheet c={c} role={mgr} act={act} onClose={() => setMgr(null)} />}
    </>
  );
}

