// Diesel on the Yard tab: this week's price, the bulk tank and keeping it topped up.

import { BULK_OFF, TANKS, TANK_ORDER, bulkPrice, daysLeft, hasOps, loadOf, newFuel, pumpPrice, rationed, tankCost, tankOk, game, play } from '@engine';
import { TANK_NAME, TANK_NEEDS, lastsFor, perL } from '@engine/text/fuel';
import { f } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');

/** The pump price over the last few months, as a little line. */
function Spark({ hist }: { hist: number[] }) {
  if (hist.length < 3) return null;
  const lo = Math.min(...hist) - 0.02, hi = Math.max(...hist) + 0.02, W = 120, H = 28;
  const pts = hist.map((p, i) => [(i / (hist.length - 1)) * W, H - ((p - lo) / (hi - lo)) * H] as const);
  const last = pts[pts.length - 1]!;
  return (
    <svg width={W} height={H + 4} viewBox={`0 -2 ${W} ${H + 4}`} aria-label="Diesel price, the last few months" style={{ flex: 'none' }}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--rust)" />
    </svg>
  );
}

export function FuelCard({ c, act }: { c: Career; act: Act }) {
  const F = c.fuel ?? newFuel(), ci = game.costIdx(c), pump = pumpPrice(F, c.week, ci), bulk = bulkPrice(F, c.week, ci), war = rationed(F, c.week);
  const prev = F.hist.length >= 2 ? F.hist[F.hist.length - 2]! : null, move = prev == null ? 0 : Math.round((pump - prev) * 100);
  const next = TANK_ORDER.find((t) => !F.tank || TANK_ORDER.indexOf(t) > TANK_ORDER.indexOf(F.tank));
  const full = F.tank ? loadOf(F, c.week, true, ci) : null, half = F.tank ? loadOf(F, c.week, false, ci) : null;
  const left = F.tank ? daysLeft(F) : null, cap = F.tank ? TANKS[F.tank].L : 0, pct = cap ? Math.round((F.L / cap) * 100) : 0;
  return (
    <>
      <div className="sub">Diesel</div>
      <div className="card">
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <span className="grow">
            <b>{perL(pump)}</b> at the pump
            {move !== 0 && <span className={'chip ' + (move > 0 ? 'c-rain' : 'c-job')} style={{ marginLeft: 6, verticalAlign: 2 }}>{move > 0 ? '▲ ' : '▼ '}{Math.abs(move)}c</span>}
            <br /><span className="tiny muted">{F.tank ? 'A load from the depot: ' + perL(bulk) : 'Bulk loads run about ' + Math.round(BULK_OFF * 100) + 'c a litre cheaper, if you have a tank.'}</span>
          </span>
          <Spark hist={F.hist} />
        </div>
        {war && <div className="why">War overseas. Diesel loads are rationed: half loads only, and two weeks to come.</div>}
        {(F.levy ?? 0) >= c.week && <div className="tiny muted">Your fuel levy is on: clients pay back about half the rise.</div>}

        {!F.tank ? (
          <div className="small muted">You're buying at the pump, from the fuel truck on site. A tank in the yard buys diesel by the load, but keeping it full is on you: if it runs dry, the work you fuel stands idle a day waiting on the fuel truck.</div>
        ) : (
          <>
            <div className="row tiny"><span className="grow"><b className="small">{TANK_NAME[F.tank]}</b></span><span className="num">{n0(F.L)} of {n0(cap)} L</span></div>
            <div className="bar"><i style={{ width: pct + '%', background: pct < 25 ? 'var(--rust)' : 'var(--teal)' }} /></div>
            <div className={left != null && left < 5 ? 'why' : 'tiny muted'}>{lastsFor(left)}</div>
            {F.order ? (
              <div className="row small" style={{ alignItems: 'center' }}>
                <span className="grow">On its way: {n0(F.order.L)} litres at {perL(F.order.at)}, {f(F.order.L * F.order.at)}. Here {F.order.due <= c.week + 1 ? 'next week' : 'in ' + (F.order.due - c.week) + ' weeks'}.</span>
                <button type="button" className="btn" onClick={() => act((x) => play.cancelDiesel(x))}>Cancel</button>
              </div>
            ) : (
              <div className="btns">
                {!war && full && full.L > 0 && <button type="button" className="btn dark" onClick={() => act((x) => play.orderDiesel(x, true))}>Fill it · {f(full.cost)}</button>}
                {half && half.L > 0 && (war || half.L < (full?.L ?? 0)) && <button type="button" className={'btn' + (war ? ' dark' : '')} onClick={() => act((x) => play.orderDiesel(x, false))}>{war ? 'Half a load (rationed)' : 'Half a load'} · {f(half.cost)}</button>}
                {full && full.L <= 0 && <span className="tiny muted">Full.</span>}
              </div>
            )}
            {F.tank && (hasOps(c) ? (
              <div className="row" style={{ paddingTop: 4, alignItems: 'center' }}>
                <span className="grow"><b className="small">Your operations manager keeps it topped up</b><br /><span className="tiny muted">Orders a full load whenever it drops below 30%, at whatever the price is that week.</span></span>
                <button type="button" className={'btn' + (F.auto ? ' dark' : '')} aria-pressed={!!F.auto} onClick={() => act((x) => play.fuelAuto(x, !F.auto))}>{F.auto ? 'On' : 'Off'}</button>
              </div>
            ) : <div className="tiny muted">An operations manager can keep the tank topped up for you.</div>)}
          </>
        )}

        {next && (tankOk(c.yard, next) ? (
          <div className="ycard">
            <div className="row"><b className="grow">{F.tank ? 'Upgrade: ' : ''}{TANK_NAME[next]}</b><span className="num small">{f(tankCost(F, next, c.week, ci))}</span></div>
            <div className="small muted">{F.tank ? 'Your diesel moves across.' : 'Comes with a load in it' + (war ? ' (half, while rationed)' : '') + ': ' + f(TANKS[next].cost) + ' for the tank, the rest is diesel at ' + perL(bulk) + '.'}</div>
            <button type="button" className="btn dark" disabled={c.bank < tankCost(F, next, c.week, ci)} onClick={() => act((x) => play.buyFuelTank(x, next))}>Put it in</button>
          </div>
        ) : <div className="tiny muted">{F.tank ? 'A bigger tank: ' : 'A bulk fuel tank: '}{TANK_NEEDS[next]}</div>)}
      </div>
    </>
  );
}
