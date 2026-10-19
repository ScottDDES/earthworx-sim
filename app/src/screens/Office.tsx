// The Office tab: the dashboard (what's worth a look, the numbers, the next 12 weeks, profit and loss, how
// the jobs went, and the rest of the business folded away), and the bank page (loans, the overdraft, who owes what).

import { Fragment, useState, type ReactNode } from 'react';
import {
  CLIENTS, CLIENT_PM, ROLES, TOWNS, WHS_SYS, alertMachines, brCrews, brProfit, claimFinance, debtors, fleetValue, gstInBank, hsum, lastInc,
  lendCap, meStretched, plOf, recentInc, relOf, relTier, talksCost, trackAllow, utilOf, wages, whsNp, workInHand, YARDS, game,
  rainCrews, type ForecastWeek, type WeekRow, play,
} from '@engine';
import { ownerFlags, ERP_NAME } from '@engine/text/office';
import { Mentor } from '../Mentor';
import { fyName } from '@engine/text/cardView';
import { jobTitle } from '@engine/text/work';
import { f, fk } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
export type Go = (tab: 'work' | 'yard' | 'market') => void;

const fks = (n: number) => (n < 0 ? '−' : '') + fk(Math.abs(n));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const KIND_NAME: Record<string, string> = { wet: 'Wet hire', dry: 'Dry hire', council: 'Council day labour', private: 'Private job', sub: 'Subcontract', own: 'Council contract', major: 'Flood program' };
const TIER_TEXT: Record<string, { t: string; c: string }> = {
  pref: { t: 'Preferred', c: 'var(--teal)' }, good: { t: 'Good', c: 'var(--teal)' }, ok: { t: 'Neutral', c: 'var(--muted)' }, wary: { t: 'Wary', c: 'var(--warn)' }, out: { t: 'On the outer', c: 'var(--rust)' },
};

/** A folded section: its title and a one-line summary, opened with a tap. */
function Fold({ title, sum, children }: { title: string; sum: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="fh" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="grow"><span className="sub">{title}</span><span className="fs">{sum}</span></span>
        <span className="chev" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div className="fold" hidden={!open}>{children}</div>
    </>
  );
}

const Tile = ({ l, v, sub, col }: { l: string; v: string; sub: ReactNode; col?: string | null }) => (
  <div className="tile"><span className="tl">{l}</span><span className="tv" style={col ? { color: col } : undefined}>{v}</span><span className="tiny muted">{sub}</span></div>
);

// ---------- charts ----------

function ForecastChart({ c, F }: { c: Career; F: ForecastWeek[] }) {
  const od = game.odLimitOf(c), vals = F.map((x) => x.bal).concat([c.bank, 0]), lo = Math.min(...vals, ...(od ? [-od] : [])), hi = Math.max(...vals);
  const W = 320, Hh = 120, top = 8, bot = 18, n = F.length, x = (i: number) => 30 + (W - 34) * (i / n), y = (v: number) => top + (Hh - top - bot) * (hi === lo ? 0.5 : (hi - v) / (hi - lo));
  const pts: [number, number][] = [[0, c.bank], ...F.map((r, i) => [i + 1, r.bal] as [number, number])];
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={'Forecast bank balance, next ' + n + ' weeks'}>
        <line x1="30" x2={W} y1={y(0).toFixed(1)} y2={y(0).toFixed(1)} style={{ stroke: 'var(--line)' }} />
        <text x="0" y={top + 8} style={{ fill: 'var(--muted)', fontSize: 10 }}>{fks(hi)}</text>
        <text x="0" y={(y(0) + 3).toFixed(1)} style={{ fill: 'var(--muted)', fontSize: 10 }}>$0</text>
        {od > 0 && <>
          <line x1="30" x2={W} y1={y(-od).toFixed(1)} y2={y(-od).toFixed(1)} style={{ stroke: 'var(--rust)', strokeDasharray: '4 3' }} />
          <text x={W} y={(y(-od) - 3).toFixed(1)} textAnchor="end" style={{ fill: 'var(--rust)', fontSize: 10 }}>Overdraft limit</text>
        </>}
        <path d={pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('')} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 2.2 }} />
        {F.map((r, i) => r.bas && <circle key={i} cx={x(i + 1).toFixed(1)} cy={y(r.bal).toFixed(1)} r="3.5" style={{ fill: 'var(--warn)' }}><title>BAS due</title></circle>)}
        <text x="30" y={Hh - 3} style={{ fill: 'var(--muted)', fontSize: 10 }}>Now</text>
        <text x={W} y={Hh - 3} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 10 }}>Wk {F[n - 1]!.w}</text>
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--ink)' }} />Bank balance, forecast</span><span><i style={{ background: 'var(--warn)', borderRadius: '50%' }} />BAS due</span></div>
    </>
  );
}

function BarChart({ cur, B }: { cur: readonly WeekRow[]; B: number }) {
  const bk: { w0: number; w1: number; rev: number; cost: number }[] = [];
  for (let i = cur.length; i > 0; i -= B) { const a = cur.slice(Math.max(0, i - B), i), p = plOf(a); bk.unshift({ w0: a[0]!.w, w1: a[a.length - 1]!.w, rev: p.rev, cost: p.cost }); }
  const max = Math.max(...bk.map((x) => Math.max(x.rev, x.cost)), 1), W = 320, Hh = 130, top = 8, bot = 18, n = bk.length, gw = (W - 30) / Math.max(n, 1), bw = Math.max(2, Math.min(12, gw * 0.36));
  const y = (v: number) => top + (Hh - top - bot) * (1 - v / max);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={'Invoiced and costs, ' + (B > 1 ? B + '-week blocks' : 'week by week')}>
        <line x1="30" x2={W} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--line)' }} />
        <text x="0" y={top + 8} style={{ fill: 'var(--muted)', fontSize: 10 }}>{fk(max)}</text>
        <text x="0" y={y(0)} style={{ fill: 'var(--muted)', fontSize: 10 }}>$0</text>
        {bk.map((x, i) => { const x0 = 30 + gw * i + gw / 2; return (
          <g key={i}>
            <rect x={(x0 - bw - 1).toFixed(1)} y={y(x.rev).toFixed(1)} width={bw.toFixed(1)} height={(y(0) - y(x.rev)).toFixed(1)} rx="1.5" style={{ fill: 'var(--teal)' }}><title>Invoiced {f(x.rev)}</title></rect>
            <rect x={(x0 + 1).toFixed(1)} y={y(x.cost).toFixed(1)} width={bw.toFixed(1)} height={(y(0) - y(x.cost)).toFixed(1)} rx="1.5" style={{ fill: 'var(--rust)' }}><title>Costs {f(x.cost)}</title></rect>
          </g>
        ); })}
        {n > 0 && <>
          <text x="30" y={Hh - 3} style={{ fill: 'var(--muted)', fontSize: 10 }}>Wk {bk[0]!.w0}</text>
          <text x={W} y={Hh - 3} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 10 }}>Wk {bk[n - 1]!.w1}</text>
        </>}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--teal)' }} />Invoiced</span><span><i style={{ background: 'var(--rust)' }} />Costs</span><span>{B > 1 ? 'Each pair is ' + B + ' weeks' : 'Each pair is a week'}</span></div>
    </>
  );
}

function LineChart({ c, cur }: { c: Career; cur: readonly WeekRow[] }) {
  const od = game.odLimitOf(c), vals = cur.map((x) => x.b).concat(cur.map((x) => x.nw));
  let lo = Math.min(...vals, 0);
  const hi = Math.max(...vals, 1);
  if (-od >= lo - 0.15 * (hi - lo)) lo = Math.min(lo, -od);
  const W = 320, Hh = 130, top = 8, bot = 18, n = cur.length, x = (i: number) => 30 + (W - 34) * (n > 1 ? i / (n - 1) : 0.5), y = (v: number) => top + (Hh - top - bot) * (hi === lo ? 0.5 : (hi - v) / (hi - lo));
  const path = (k: 'b' | 'nw') => cur.map((r, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(r[k]).toFixed(1)).join('');
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Cash in the bank and net worth">
        <line x1="30" x2={W} y1={y(0).toFixed(1)} y2={y(0).toFixed(1)} style={{ stroke: 'var(--line)' }} />
        <text x="0" y={top + 8} style={{ fill: 'var(--muted)', fontSize: 10 }}>{fks(hi)}</text>
        <text x="0" y={(y(0) + 3).toFixed(1)} style={{ fill: 'var(--muted)', fontSize: 10 }}>$0</text>
        {od > 0 && -od >= lo && <>
          <line x1="30" x2={W} y1={y(-od).toFixed(1)} y2={y(-od).toFixed(1)} style={{ stroke: 'var(--rust)', strokeDasharray: '4 3' }} />
          <text x={W} y={(y(-od) - 3).toFixed(1)} textAnchor="end" style={{ fill: 'var(--rust)', fontSize: 10 }}>Overdraft limit</text>
        </>}
        <path d={path('nw')} style={{ fill: 'none', stroke: 'var(--teal)', strokeWidth: 2.2 }} />
        <path d={path('b')} style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 2.2 }} />
        {n > 0 && <>
          <text x="30" y={Hh - 3} style={{ fill: 'var(--muted)', fontSize: 10 }}>Wk {cur[0]!.w}</text>
          <text x={W} y={Hh - 3} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 10 }}>Wk {cur[n - 1]!.w}</text>
        </>}
      </svg>
      <div className="legend"><span><i style={{ background: 'var(--ink)' }} />Cash in the bank</span><span><i style={{ background: 'var(--teal)' }} />Net worth</span></div>
    </>
  );
}

// ---------- the dashboard ----------

function Dashboard({ c, act, go, toBank }: { c: Career; act: Act; go: Go; toBank: () => void }) {
  const [N, setN] = useState(13);
  const H = c.hist || [], cur = H.slice(-N), prev = H.length > N ? H.slice(-2 * N, -N) : [], P = plOf(cur), Q = prev.length ? plOf(prev) : null;
  const W = c.whs, nw = game.worth(c), wih = workInHand(c.jobs), dr = debtors(c.recv), wkTurn = cur.length ? P.rev / cur.length : 0, rw = game.runwayWeeks(c);
  const od = game.odLimitOf(c), F = ownerFlags(c, cur), inBank = !!c.gst && gstInBank(game.tax(c)), mode = game.tax(c);
  const nw0 = cur.length ? cur[0]!.nw : nw, dnw = nw - nw0, odAmt = c.recv.filter((x) => x.due >= 9999 || x.due < c.week).reduce((a, x) => a + x.amt, 0);
  const fixed = game.overheads(c) + (c.loan.bal > 0 ? c.loan.weekly : 0);
  const FC = game.cashAhead(c, 12), G = c.gst, nb = G?.due.filter((d) => d.amt > 0)[0], low = FC.slice().sort((a, b) => a.bal - b.bal)[0]!;
  const neg = (v: number) => (v ? '−' + fk(v) : '–');
  const Row = ({ l, a, b, pt }: { l: ReactNode; a: ReactNode; b: ReactNode; pt?: boolean }) => (
    <><span className={pt ? 'pt' : undefined}>{l}</span><span className={pt ? 'pt' : undefined}>{a}</span><span className={pt ? 'pt' : undefined} style={{ color: 'var(--muted)' }}>{Q ? b : ''}</span></>
  );
  const JL = c.jlog || [], byK: Record<string, { rev: number; cost: number; n: number }> = {};
  for (const j of JL) {
    const g = j.kind === 'wet' || j.kind === 'dry' || j.kind === 'council' ? 'Hire' : j.kind === 'sub' ? 'Subcontract' : j.kind === 'private' ? 'Private' : 'Council';
    const b = (byK[g] = byK[g] || { rev: 0, cost: 0, n: 0 });
    if (!j.part) { b.rev += j.rev; b.cost += j.cost; b.n++; }
  }
  const jt = (j: (typeof JL)[number]) => (j.tn ? jobTitle(j.tn as never) : KIND_NAME[j.kind] ?? j.kind);
  const HCs = Object.keys(CLIENTS).filter((h) => !((c.blocked[h] ?? 0) > c.week + 5000)), pref = HCs.filter((h) => relOf(c.rel, h) >= 6).length;
  const fv = fleetValue(c.fleet, c.week), u = cur.length ? utilOf(cur) : null, mdays = hsum(cur, 'md'), am = alertMachines(c.fleet);
  const yr = (sev: string) => recentInc(W, [sev as never], 52, c.week), lti = lastInc(W, ['lti', 'serious']), y52 = H.slice(-52), hrs = hsum(y52, 'md') * 9, ltis = yr('lti') + yr('serious');
  const roles: Record<string, number> = {};
  for (const p of c.staff) { const nm = (ROLES as Record<string, { name: string }>)[p.role]?.name ?? p.role; roles[nm] = (roles[nm] || 0) + 1; }
  const TB = c.tb || { s: [0, 0], c: [0, 0], since: c.week }, hit = (x: [number, number]) => (x[0] ? x[1] + ' of ' + x[0] + ' (' + pct(x[1], x[0]) + '%)' : 'None yet');
  const age: [string, number][] = [['Due in the next 2 weeks', 0], ['Due in 3 to 4 weeks', 0], ['Due later', 0], ['Overdue', 0]];
  for (const x of c.recv) { const d = x.due - c.week; age[x.due >= 9999 || d < 0 ? 3 : d <= 2 ? 0 : d <= 4 ? 1 : 2]![1] += x.amt; }
  const byC: Record<string, number> = {};
  for (const x of c.recv) byC[x.client] = (byC[x.client] || 0) + x.amt;
  const topC = Object.keys(byC).sort((a, b) => byC[b]! - byC[a]!)[0], pays = (c.payables || []).reduce((a, x) => a + x.amt, 0);
  const BR = c.branch, BRh = BR ? (BR.hist || []).slice(-13) : [];
  return (
    <>
      <div className="card">
        <div className="row"><span className="grow"><span className="sub">The books</span><br /><b style={{ fontSize: 18 }}>{c.co}</b></span><span className="small muted">Week {c.week}</span></div>
        <div className="seg" aria-label="Period">{[13, 26, 52].map((k) => <button key={k} type="button" className={N === k ? 'on' : ''} onClick={() => setN(k)}>{k === 52 ? 'Year' : k + ' weeks'}</button>)}</div>
        {H.length < N && <div className="tiny muted">{H.length ? 'Only ' + H.length + ' week' + (H.length > 1 ? 's' : '') + ' on the books so far.' : 'The books start when you end your first week.'}</div>}
      </div>

      <div className="sub">Worth a look</div>
      <div className="card" style={{ gap: 0 }}>
        {F.length ? F.map(([lvl, t, to], i) => (
          <div key={i} className={'flag ' + lvl}>
            <span className="grow small">{t}</span>
            {to && <button type="button" className="btn" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => (to === 'bank' ? toBank() : go(to))}>{to === 'work' ? 'Work' : to === 'yard' ? 'Yard' : 'Bank'}</button>}
          </div>
        )) : <div className="flag ok"><span className="small">Nothing urgent. Cash, work in hand, the gear and the crew all look right.</span></div>}
      </div>

      <div className="tiles">
        <Tile l="Cash" v={fks(c.bank)} sub={od ? f(Math.max(0, od + Math.min(0, c.bank))) + ' of overdraft left' : 'No overdraft yet'} col={c.bank < 0 ? 'var(--rust)' : null} />
        <Tile l="Runway" v={rw >= 52 ? '52+ wks' : rw + ' wk' + (rw !== 1 ? 's' : '')} sub={'of fixed costs: ' + fk(fixed) + '/wk'} col={rw < 4 ? 'var(--rust)' : rw < 10 ? 'var(--warn)' : null} />
        <Tile l="Work in hand" v={fk(wih)} sub={wkTurn ? 'about ' + Math.round(wih / wkTurn) + ' weeks of turnover' : 'signed and not yet billed'} />
        <Tile l="Owed to you" v={fk(dr)} sub={odAmt ? <span style={{ color: 'var(--rust)', fontWeight: 700 }}>{fk(odAmt)} overdue</span> : 'none overdue'} />
        <Tile l={'Profit · ' + cur.length + ' wks'} v={cur.length ? fks(P.profit) : '–'} sub={cur.length && P.rev ? pct(P.profit, P.rev) + '% of turnover' : 'after all costs'} col={cur.length ? (P.profit < 0 ? 'var(--rust)' : 'var(--teal)') : null} />
        <Tile l="Net worth" v={fks(nw)} sub={cur.length > 1 ? (dnw >= 0 ? '▲ ' : '▼ ') + fk(Math.abs(dnw)) + ' in ' + cur.length + ' wks' : 'gear + cash + owed − debts'} />
      </div>

      <div className="sub">The next 12 weeks</div>
      <div className="card">
        <b className="small">Cash forecast</b>
        <ForecastChart c={c} F={FC} />
        <div className="pl" style={{ marginTop: 4 }}>
          <span className="ph">Week</span><span className="ph">In</span><span className="ph">Out</span>
          {FC.slice(0, 6).map((x) => (
            <Fragment key={x.w}>
              <span>{x.w}{x.bas && <> <span className="tiny" style={{ color: 'var(--warn)', fontWeight: 700 }}>BAS</span></>}</span>
              <span style={{ color: 'var(--teal)' }}>{fk(x.inn)}</span>
              <span style={{ color: 'var(--rust)' }}>−{fk(x.o)}</span>
            </Fragment>
          ))}
        </div>
        <div className="kv"><span>Lowest point</span><span className="num" style={{ color: low.bal < -od ? 'var(--rust)' : 'inherit' }}>{fks(low.bal)} in week {low.w}</span></div>
        {mode !== 'off' && G && <div className="kv"><span>{inBank ? 'GST held for the tax office' : 'GST your bookkeeper has set aside'}</span><span className="num">{fks(G.held)}{nb ? ' · BAS week ' + nb.due : ''}</span></div>}
        <div className="tiny muted">From invoices due, the work you have signed (billed at your recent rate, paid about four weeks later), overheads, loan repayments and subbies{inBank ? ' and the BAS' : ''}. New work and rain change it.{inBank ? ' Prices are plus GST: clients pay 10% on top, and it goes to the tax office each quarter.' : mode === 'auto' ? ' Your bookkeeper keeps the GST in a separate account and lodges the BAS, so it never touches your cash. On Hard it\'s all yours.' : ''}</div>
      </div>

      {cur.length >= 2 && (
        <Fold title="Trend" sum="Invoiced and costs, cash and net worth">
          <div className="card"><b className="small">Invoiced and costs</b><BarChart cur={cur} B={N >= 52 ? 4 : N >= 26 ? 2 : 1} /></div>
          <div className="card"><b className="small">Cash and net worth</b><LineChart c={c} cur={cur} /></div>
        </Fold>
      )}

      {cur.length > 0 && (
        <Fold title="Profit and loss" sum={<><span style={{ color: P.profit < 0 ? 'var(--rust)' : 'var(--teal)', fontWeight: 700 }}>{fks(P.profit)}</span> on {fk(P.rev)}{P.rev ? ' · ' + pct(P.profit, P.rev) + '%' : ''}</>}>
          <div className="card">
            <div className="pl">
              <Row l={<span className="ph">Last {cur.length} weeks</span>} a={<span className="ph">This</span>} b={<span className="ph">Before</span>} />
              <Row l="Invoiced" a={fk(P.rev)} b={Q ? fk(Q.rev) : ''} />
              <Row l="Job costs" a={neg(P.jc)} b={Q ? neg(Q.jc) : ''} />
              <Row l="Workshop and repairs" a={neg(P.ws)} b={Q ? neg(Q.ws) : ''} />
              <Row l="Overheads" a={neg(P.oh)} b={Q ? neg(Q.oh) : ''} />
              <Row l="Interest" a={neg(P.fin)} b={Q ? neg(Q.fin) : ''} />
              {(P.br || (Q && Q.br)) ? <Row l="Branch costs" a={neg(P.br)} b={Q ? neg(Q.br) : ''} /> : null}
              {(P.bd || (Q && Q.bd)) ? <Row l="Bad debts" a={neg(P.bd)} b={Q ? neg(Q.bd) : ''} /> : null}
              <Row l={P.ot < 0 ? 'Other income' : 'Other'} a={P.ot < 0 ? fk(-P.ot) : neg(P.ot)} b={Q ? (Q.ot < 0 ? fk(-Q.ot) : neg(Q.ot)) : ''} />
              <Row l="Profit" a={<span style={{ color: P.profit < 0 ? 'var(--rust)' : 'var(--teal)' }}>{fks(P.profit)}</span>} b={Q ? fks(Q.profit) : ''} pt />
            </div>
            <div className="kv"><span>Margin on turnover</span><span className="num">{P.rev ? pct(P.profit, P.rev) + '%' : '–'}{Q && Q.rev ? <> <span className="tiny muted">was {pct(Q.profit, Q.rev)}%</span></> : null}</span></div>
            <div className="kv"><span>Cash actually paid in</span><span className="num">{fk(P.pd)}</span></div>
            <div className="kv"><span>Spent on gear and the yard</span><span className="num">{fks(P.cap)}</span></div>
            <div className="tiny muted">On what you invoiced, not what's been paid yet. Job costs are fuel, casuals, hire-ins, subbies, gravel and floats. Overheads are wages, insurance, the yard, your drawings and the safety system. Machines you buy are assets, so they sit under Spent on gear, not costs. Other is injuries, fines, fees and odds and ends.</div>
          </div>
        </Fold>
      )}

      {JL.length > 0 && (
        <Fold title="How the jobs went" sum={JL.length + ' finished job' + (JL.length !== 1 ? 's' : '') + ' · last: ' + jt(JL[0]!).slice(0, 40)}>
          <div className="card">
            <div className="tiles" style={{ gridTemplateColumns: 'repeat(' + Math.min(3, Object.keys(byK).length) + ',minmax(0,1fr))' }}>
              {Object.keys(byK).map((g) => { const b = byK[g]!; return (
                <div key={g} className="tile" style={{ boxShadow: 'none', padding: 10 }}><span className="tl">{g}</span><span className="tv" style={{ fontSize: 18, color: b.rev && b.rev < b.cost ? 'var(--rust)' : 'inherit' }}>{b.rev ? pct(b.rev - b.cost, b.rev) + '%' : '–'}</span><span className="tiny muted">{b.n} job{b.n !== 1 ? 's' : ''}</span></div>
              ); })}
            </div>
            {JL.slice(0, 6).map((j, i) => {
              const m = j.rev ? pct(j.rev - j.cost, j.rev) : 0, col = j.rev < j.cost ? 'var(--rust)' : m < 15 ? 'var(--warn)' : 'var(--teal)', v = j.plan ? Math.round((j.cost / j.plan - 1) * 100) : null;
              return (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--soft)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="row" style={{ flexWrap: 'nowrap' }}><span className="grow small" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b>{jt(j)}</b></span><b className="num" style={{ color: col }}>{j.part ? '–' : m + '%'}</b></div>
                  <span className="tiny muted">{KIND_NAME[j.kind] ?? j.kind} · finished week {j.w} · {fk(j.rev)} earned, {fk(j.cost)} direct cost{j.sub ? ' (subbed out)' : ''}{j.cut ? ' · roads taken off you' : ''}</span>
                  {v != null && !j.part && <span className="tiny" style={{ color: v > 5 ? 'var(--rust)' : v < -5 ? 'var(--teal)' : 'var(--muted)' }}>Planned {fk(j.plan!)}, came in {v >= 0 ? v + '% over' : -v + '% under'}{j.oh ? '. Priced ' + fk(j.oh) + ' of overheads on top.' : '.'}</span>}
                  {j.part && <span className="tiny muted">Started before the books did, so its costs aren't complete.</span>}
                </div>
              );
            })}
            <div className="tiny muted">Margin is on direct costs: what's left to pay the overheads and you. Wages and wear on your own gear sit in overheads and the workshop.</div>
          </div>
        </Fold>
      )}

      {BR && (
        <Fold title={TOWNS[BR.town].name + ' branch'} sum={<><span style={{ color: brProfit(BR, 13) < 0 ? 'var(--rust)' : 'var(--teal)', fontWeight: 700 }}>{fks(brProfit(BR, 13))}</span> on {fk(BRh.reduce((a, x) => a + x.rev, 0))} over {BRh.length} wks · {brCrews(c.fleet).n} crew{brCrews(c.fleet).n !== 1 ? 's' : ''}</>}>
          <div className="card">
            <div className="pl">
              <span className="ph">Week</span><span className="ph">Invoiced</span><span className="ph">Costs</span>
              {BRh.slice(-6).reverse().map((x) => (
                <Fragment key={x.w}>
                  <span>{x.w} <span className="tiny muted">{x.days} crew-days</span></span><span style={{ color: 'var(--teal)' }}>{fk(x.rev)}</span><span style={{ color: 'var(--rust)' }}>−{fk(x.cost)}</span>
                </Fragment>
              ))}
            </div>
            <button type="button" className="btn full" onClick={() => go('yard')}>Manage the branch in the Yard</button>
          </div>
        </Fold>
      )}

      {c.won && HCs.length > 0 && (
        <Fold title="Head contractors" sum={pref ? pref + ' treat you as a preferred subbie' : 'Your standing with the four you work for'}>
          <div className="card">
            <Mentor c={c} k="rel" act={act} />
            {HCs.map((h) => { const T = TIER_TEXT[relTier(c.rel, h)]!, v = relOf(c.rel, h); return (
              <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0', borderBottom: '1px solid var(--soft)' }}>
                <div className="row" style={{ flexWrap: 'nowrap' }}><span className="grow small"><b>{h}</b> <span className="tiny muted">{CLIENT_PM[h] ?? ''}</span></span><b className="small" style={{ color: T.c }}>{T.t}</b></div>
                <div className="bar"><i style={{ width: (v + 10) * 5 + '%', background: T.c }} /></div>
              </div>
            ); })}
            <div className="tiny muted">Finish on time and they come back; finish late, walk off or chase them hard and they cool. Good standing adds tender points. Preferred subbies get work offered direct and paid a week sooner. On the outer, they stop asking you to price.</div>
          </div>
        </Fold>
      )}

      {(c.years || []).length > 0 && (
        <Fold title="Past years" sum={c.years!.length + ' financial year' + (c.years!.length > 1 ? 's' : '') + ' · last ' + fks(c.years![c.years!.length - 1]!.profit) + ' profit'}>
          <div className="card">
            {c.years!.slice().reverse().map((y) => (
              <div key={y.w} className="kv">
                <span><b>{fyName(y)}</b><span className="tiny muted" style={{ display: 'block' }}>No. {y.rank} of {y.of} in town · net worth {fk(y.nw)}</span></span>
                <span className="num" style={{ textAlign: 'right' }}>{fk(y.rev)}<span className="tiny" style={{ display: 'block', color: y.profit < 0 ? 'var(--rust)' : 'var(--teal)' }}>{fks(y.profit)} · {y.rev ? pct(y.profit, y.rev) : 0}%</span></span>
              </div>
            ))}
          </div>
        </Fold>
      )}

      <Fold title="The gear" sum={<>{c.fleet.length} machines{u != null ? ' · worked ' + u + '% of dry days' : ''}{am ? <> · <span style={{ color: 'var(--rust)' }}>{am} need the workshop</span></> : null}</>}>
        <div className="card">
          {u != null && <>
            <div className="row"><span className="grow small">Worked {u}% of dry days</span><span className="tiny muted">{mdays} machine-days</span></div>
            <div className="bar"><i style={{ width: u + '%', background: u >= 65 ? 'var(--teal)' : u >= 45 ? 'var(--warn)' : 'var(--rust)' }} /></div>
          </>}
          <div className="kv"><span>Machines</span><span className="num">{c.fleet.length} worth {fk(fv)}</span></div>
          <div className="kv"><span>Loan against them</span><span className="num">{fk(c.loan.bal)}{fv ? ' · ' + pct(c.loan.bal, fv) + '% geared' : ''}</span></div>
          {cur.length > 0 && <>
            <div className="kv"><span>Breakdowns, last {cur.length} wks</span><span className="num">{hsum(cur, 'brk')}</span></div>
            <div className="kv"><span>Workshop per machine-day</span><span className="num">{mdays ? f(P.ws / mdays) : '–'}</span></div>
          </>}
          <div className="kv"><span>Need the workshop now</span><span className="num" style={{ color: am ? 'var(--rust)' : 'inherit' }}>{am}</span></div>
          <div className="tiny muted">Most outfits want their gear working two days in three. Idle machines still cost insurance, finance and depreciation; worn ones cost repairs.</div>
        </div>
      </Fold>

      {c.unl?.swms != null && (
        <Fold title="Safety" sum={(lti == null ? 'No lost-time injuries' : c.week - lti + ' weeks since a lost-time injury') + ' · level ' + W.sys + ' of 3'}>
          <div className="card">
            <div className="row"><b className="grow small">{WHS_SYS[W.sys]!.n}</b><span className={'chip ' + (W.sys >= 2 ? 'c-job' : W.sys ? 'c-idle' : 'c-bad')}>LEVEL {W.sys} OF 3</span></div>
            <div className="tiles">
              <div className="tile" style={{ boxShadow: 'none', padding: 10 }}><span className="tl">Since last LTI</span><span className="tv" style={{ fontSize: 18 }}>{lti == null ? 'None' : c.week - lti + ' wks'}</span><span className="tiny muted">lost-time injury</span></div>
              <div className="tile" style={{ boxShadow: 'none', padding: 10 }}><span className="tl">LTIFR</span><span className="tv" style={{ fontSize: 18, color: ltis ? 'var(--rust)' : 'inherit' }}>{hrs >= 2000 ? ((ltis * 1e6) / hrs).toFixed(1) : '–'}</span><span className="tiny muted">per million hours, 12 months</span></div>
            </div>
            <div className="small"><b>Last 12 months:</b> {[['serious', 'serious'], ['lti', 'lost-time'], ['medical', 'medical'], ['first aid', 'first aid'], ['near miss', 'near misses reported']].map((x) => yr(x[0]!) + ' ' + x[1]).join(' · ')}</div>
            <div className="row tiny"><span className="grow">Crew culture</span><span className="num">{Math.round(W.cult)} of 100</span></div>
            <div className="bar"><i style={{ width: W.cult + '%', background: W.cult >= 70 ? 'var(--teal)' : W.cult >= 40 ? 'var(--warn)' : 'var(--rust)' }} /></div>
            <div className="kv"><span>Toolbox talks</span><span className="num">{W.talks ? 'Every Monday' : 'Not running'}</span></div>
            <div className="kv"><span>Insurance</span><span className="num">{f(game.premiumNow(c))} a week{Math.abs(c.ins - 1) > 0.005 ? ' · ' + (c.ins > 1 ? '+' : '') + Math.round((c.ins - 1) * 100) + '% on your record' : ''}</span></div>
            {c.won2 && <div className="kv"><span>Council tender points</span><span className="num">{whsNp(W, c.week) >= 0 ? '+' : ''}{whsNp(W, c.week)}</span></div>}
            <div className="tiny muted">LTIFR is how the industry compares safety: lost-time injuries for every million hours worked. Change your safety system and toolbox talks in the Yard.</div>
            <button type="button" className="btn full" onClick={() => go('yard')}>Safety settings in the Yard</button>
          </div>
        </Fold>
      )}

      <Fold title="People" sum={c.staff.length ? c.staff.length + ' on the payroll · ' + f(wages(c.staff)) + ' a week' : 'Just you'}>
        <div className="card">
          <div className="kv"><span>On the payroll</span><span className="num">{c.staff.length}{c.staff.length ? ' · ' + f(wages(c.staff)) + ' a week' : ''}</span></div>
          {c.staff.length ? <div className="small muted">{Object.keys(roles).map((k) => roles[k] + ' × ' + k.toLowerCase()).join(' · ')}</div> : <div className="small muted">Just you so far. Casuals from labour hire fill the gaps.</div>}
          {cur.length > 0 && P.rev > 0 && <div className="kv"><span>Wages as a share of turnover</span><span className="num">{pct(hsum(cur, 'wg'), P.rev)}%</span></div>}
          {c.staff.some((p) => p.off > 0) && <div className="kv"><span>Off work</span><span className="num">{c.staff.filter((p) => p.off > 0).map((p) => p.name + ' (' + p.off + ' wk' + (p.off > 1 ? 's' : '') + ')').join(', ')}</span></div>}
        </div>
      </Fold>

      {(TB.s[0] > 0 || TB.c[0] > 0 || c.won) && (
        <Fold title="Tenders" sum={'Subcontracts ' + hit(TB.s) + (TB.c[0] ? ' · council ' + hit(TB.c) : '')}>
          <div className="card">
            <div className="kv"><span>Subcontract packages won</span><span className="num">{hit(TB.s)}</span></div>
            {(c.won2 || TB.c[0] > 0) && <div className="kv"><span>Council tenders won</span><span className="num">{hit(TB.c)}</span></div>}
            <div className="tiny muted">Counted from week {TB.since}. Win too many and you're probably leaving money on the table; win too few and your overheads go unpaid.</div>
          </div>
        </Fold>
      )}

      <Fold title="Who owes what" sum={dr ? <>{fk(dr)} owed to you{age[3]![1] ? <> · <span style={{ color: 'var(--rust)' }}>{fk(age[3]![1])} overdue</span></> : null}</> : 'Nobody owes you anything'}>
        <div className="card">
          {age.filter((x) => x[1]).map((x) => <div key={x[0]} className="kv"><span>{x[0]}</span><span className="num" style={x[0] === 'Overdue' ? { color: 'var(--rust)' } : undefined}>{f(x[1])}</span></div>)}
          {!dr && <div className="small muted">Nobody owes you anything right now.</div>}
          {topC && dr > 0 && <div className="tiny muted">{topC} owes the most: {pct(byC[topC]!, dr)}% of it.{pct(byC[topC]!, dr) >= 60 ? ' A lot riding on one client.' : ''}</div>}
          {pays > 0 && <div className="kv"><span>You owe subbies</span><span className="num">{f(pays)}</span></div>}
          <button type="button" className="btn full" onClick={toBank}>Bank, loans and invoices</button>
        </div>
      </Fold>
    </>
  );
}

// ---------- the bank ----------

function Bank({ c, act, go }: { c: Career; act: Act; go: Go }) {
  const [msg, setMsg] = useState<string | null>(null);
  const L = c.loan, fv = fleetValue(c.fleet, c.week), od = game.odLimitOf(c), used = Math.max(0, -c.bank), room = game.canBorrow(c);
  const cap = lendCap(fv, c.won, c.won2, c.won3), Wk = WHS_SYS[c.whs.sys]!, tk = talksCost(!!c.whs.talks, rainCrews(c.jobs)), rent = YARDS[c.yard].rent, wg = wages(c.staff);
  const owed = c.recv.slice().sort((a, b) => a.due - b.due), pays = (c.payables || []).slice().sort((a, b) => a.due - b.due);
  const ring = () => act((x) => {
    const r = play.ringAround(x);
    setMsg(r === 'tooSoon' ? 'Nobody\'s calling back yet. Try again in a few weeks.' : r === 'nobody' ? 'Nobody in the district can afford to buy right now.' : null);
  });
  return (
    <>
      <div className="card">
        <div className="sub">Where you stand</div>
        <div className="kv"><span>In the bank</span><span className="num" style={{ color: c.bank < 0 ? 'var(--rust)' : 'inherit' }}>{f(c.bank)}</span></div>
        <div className="kv"><span>Overdraft limit</span><span className="num">{f(od)}</span></div>
        {used > 0 && <>
          <div className="kv"><span>Overdraft in use</span><span className="num">{f(used)} of {f(od)}</span></div>
          <div className="bar"><i style={{ width: Math.min(100, (used / Math.max(1, od)) * 100) + '%', background: used > od ? 'var(--rust)' : 'var(--warn)' }} /></div>
        </>}
        <div className="kv"><span>Loan</span><span className="num">{f(L.bal)}</span></div>
        <div className="kv"><span>Repayments</span><span className="num">{f(L.bal > 0 ? L.weekly : 0)} a week</span></div>
        <div className="kv"><span>Fleet worth</span><span className="num">{f(fv)}</span></div>
        <div className="kv"><span>The bank will lend up to</span><span className="num">{f(cap)}</span></div>
        <div className="tiny muted">65% of what your fleet's worth, plus {f(trackAllow(c.won, c.won2, c.won3))} on your track record. It grows as you move up the stages.</div>
      </div>
      {!c.won ? (
        <div className="card"><b>Equipment finance</b><div className="small muted">The bank won't finance machines or lend against your fleet until you've shown you can run a crew: get to Ready to subcontract first. Until then, buy with cash.</div></div>
      ) : (
        <>
          <div className="card">
            <b>Equipment finance</b>
            <div className="small muted">Buy a machine in the Market with 20% down and the rest on your loan over five years at 9.5%. Every listing shows the deposit and what it adds a week.</div>
            <div className="kv"><span>The bank will lend you</span><span className="num">{f(room)}</span></div>
            <button type="button" className="btn ink full" onClick={() => go('market')}>Find a machine to finance</button>
          </div>
          <div className="card">
            <b>Borrow against your fleet</b>
            <div className="small muted">Cash now for a deposit, a yard or a big job's start-up. 1% establishment fee, repaid with the loan.</div>
            {L.missed ? <div className="why">Not while you've got missed repayments.</div> : room < 5000 ? <div className="why">Nothing left to borrow right now. Pay the loan down, add machines, or move up a stage.</div> : (
              <div className="btns">
                {[25000, 50000, 100000].filter((x) => x <= room).map((x) => <button key={x} type="button" className="btn" onClick={() => act((y) => play.borrowAgainstFleet(y, x))}>{fk(x)}</button>)}
                <button type="button" className="btn" onClick={() => act((y) => play.borrowAgainstFleet(y, room))}>All {fk(room)}</button>
              </div>
            )}
          </div>
        </>
      )}
      {L.bal > 0 && (
        <div className="card">
          <b>Pay the loan down</b>
          <div className="small muted">Spare cash off the loan cuts the weekly repayments and the interest.</div>
          <div className="btns">
            {[10000, 50000].filter((x) => x < L.bal).map((x) => <button key={x} type="button" className="btn" disabled={c.bank < x} onClick={() => act((y) => play.payLoanDown(y, x))}>{fk(x)}</button>)}
            <button type="button" className="btn" disabled={c.bank < L.bal} onClick={() => act((y) => play.payLoanDown(y, L.bal))}>Clear it · {fk(L.bal)}</button>
          </div>
        </div>
      )}
      {meStretched(c as never, od) && (
        <div className="card" style={{ borderColor: 'var(--rust)', borderWidth: 2 }}>
          <b>Ring around about selling</b>
          <div className="small muted">You're stretched. A bigger outfit might buy your spare gear for cash this week, or take the whole business off your hands. Selling the business ends this career.</div>
          {msg && <div className="why">{msg}</div>}
          <button type="button" className="btn full" onClick={ring}>See who's buying</button>
        </div>
      )}
      <div className="sub">Money</div>
      <div className="card">
        {od > 0 && <>
          <div className="kv"><span>Overdraft limit</span><span className="num">{f(od)}</span></div>
          <div className="tiny muted">12% a year on whatever you use. Repayments only bounce if you go past the limit.{c.won2 ? ' Includes ' + f(claimFinance(c.recv, c.town)) + ' lent against council claims you\'re owed: 80% of them.' : ''}</div>
        </>}
        <div className="kv"><span>Loan left</span><span className="num">{f(L.bal)}</span></div>
        <div className="kv"><span>Repayment each week</span><span className="num">{f(L.bal > 0 ? L.weekly : 0)}</span></div>
        {(c.odOver ?? 0) > 0 && <div className="why">Over your limit {c.odOver} of 3 weeks. Get back under it or the bank takes a machine.</div>}
        {L.arrears > 0 && <div className="kv" style={{ color: 'var(--rust)', fontWeight: 600 }}><span>Missed so far</span><span className="num">{f(L.arrears)}</span></div>}
        <div className="kv"><span>Running costs each week</span><span className="num">{f(game.overheads(c))}</span></div>
        <div className="tiny muted">Insurance {f(game.premiumNow(c))}, your drawings $800{Wk.wk ? ', safety system ' + f(Wk.wk) : ''}{tk ? ', toolbox talks ' + f(tk) : ''}{rent ? ', yard rent ' + f(rent) : ''}{wg ? ', wages ' + f(wg) : ''}{c.erp ? ', less what ' + ERP_NAME + ' saves (' + f(game.erpSaving(c)) + ')' : ''}.</div>
        {pays.length > 0 && <>
          <div className="sub" style={{ marginTop: 6 }}>You owe subbies</div>
          {pays.map((x, i) => <div key={i} className="kv"><span>{x.to} <span className="tiny muted">due week {x.due}</span></span><span className="num">{f(x.amt)}</span></div>)}
        </>}
        <div className="sub" style={{ marginTop: 6 }}>Owed to you</div>
        {!owed.length && <div className="small muted">Nothing invoiced yet.</div>}
        {owed.map((x) => <div key={x.id} className="kv"><span>{x.client} <span className="tiny muted">{x.due >= 9999 ? 'overdue, sorting it out' : 'due week ' + x.due}</span></span><span className="num">{f(x.amt)}</span></div>)}
      </div>
    </>
  );
}

export function OfficeTab({ c, act, go }: { c: Career; act: Act; go: Go }) {
  const [v, setV] = useState<'dash' | 'bank'>('dash');
  return (
    <>
      {v === 'dash' && <Mentor c={c} k="office" act={act} />}
      <div className="seg" role="tablist" aria-label="Office">
        {([['dash', 'Dashboard'], ['bank', 'Bank and loans']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={v === k} className={v === k ? 'on' : ''} onClick={() => setV(k)}>{l}</button>
        ))}
      </div>
      {v === 'bank' ? <Bank c={c} act={act} go={go} /> : <Dashboard c={c} act={act} go={go} toBank={() => setV('bank')} />}
    </>
  );
}
