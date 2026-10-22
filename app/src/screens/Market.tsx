// The Market tab: this week's auction lot, and machines for sale. Selling is done from the Yard.

import { useState } from 'react';
import { DELIVERY_MAX, DELIVERY_MIN, NEW_DEPOSIT, TRADE_SHARE, TYPES, YARDS, dealerTypes, game, machineName, newPrice, play, tradeCredit, type MachineType } from '@engine';
import { hammerText, lotFrom, lotGuide } from '@engine/text/market';
import { MachineIcon } from '../Icon';
import { Attachments } from './Bulk';
import { f, fk } from '../format';
import { ListingCard } from './Shop';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;

function Auction({ c, act }: { c: Career; act: Act }) {
  const lot = c.market?.lot;
  if (!lot) return <div className="card small muted">No auction this week.</div>;
  const total = Math.round(lot.bid * 1.08), mine = lot.leader === 'you';
  return (
    <div className="card">
      <div className="row"><span className="chip c-bad">{lot.done ? 'SOLD' : 'LIVE'}</span><span className="tiny muted grow">{lotFrom(lot.from)}</span></div>
      <div className="mhead"><MachineIcon type={lot.type} /><b className="grow" style={{ fontSize: 18 }}>{TYPES[lot.type].name}, {lot.year}</b></div>
      <div className="kv"><span>Hours</span><span className="num">{lot.hours.toLocaleString('en-AU')}</span></div>
      <div className="kv"><span>{lot.unknown}</span><span style={{ color: 'var(--rust)', fontWeight: 600 }}>Not inspected</span></div>
      <div className="kv"><span>Similar machines sell for</span><span className="num">{lotGuide(lot)}</span></div>
      <div className="row" style={{ marginTop: 4 }}>
        <span className="small grow">Top bid · <b>{mine ? 'You' : 'Another bidder'}</b></span>
        <span className="num" style={{ fontSize: 26, fontWeight: 600 }}>{f(lot.bid)}</span>
      </div>
      <div className="tiny muted">Plus 8% buyer's fee: {f(total)}. You have {f(c.bank)}.</div>
      {lot.done ? (
        <div className="small" style={{ fontWeight: 600 }}>{lot.result ? hammerText(lot.result) : ''}</div>
      ) : game.room(c) <= 0 ? (
        <div className="why">Your yard is full ({YARDS[c.yard].slots} machines). You can't bid until there's room.</div>
      ) : (
        <>
          <div className="btns">
            <button type="button" className="btn grow" onClick={() => act((x) => play.bid(x, 1000))}>+$1,000</button>
            <button type="button" className="btn dark grow" onClick={() => act((x) => play.bid(x, 5000))}>+$5,000</button>
          </div>
          <button type="button" className="btn full" disabled={!mine} onClick={() => act((x) => play.hammer(x))}>{mine ? 'Let the hammer fall' : 'Outbid: bid again or let it go'}</button>
          {mine && total > c.bank && <div className="why">You're winning, but you can't pay {f(total)}.</div>}
        </>
      )}
    </div>
  );
}

/** New from the dealer: order any machine at list price, delivered in a few weeks, an old one traded in against it. */
function Dealer({ c, act }: { c: Career; act: Act }) {
  const [trade, setTrade] = useState('');
  const md = game.mood(c), types = dealerTypes(!!c.packs?.bulk);
  const idle = c.fleet.filter((m) => m.status === 'idle' && !m.jobId && m.down === 0);
  const tr = idle.find((m) => m.id === trade), credit = tr ? tradeCredit(tr, c.week) : 0;
  const space = game.room(c) + (tr ? 1 : 0);
  const order = (t: MachineType, fin: boolean) => { act((x) => play.orderNew(x, t, fin, tr ? tr.id : null)); setTrade(''); };
  return (
    <>
      <div className="small muted">New from the dealer at list price: delivered in {DELIVERY_MIN} to {DELIVERY_MAX} weeks, with two years' warranty. Developers' jobs want late-model gear.</div>
      {(c.orders ?? []).length > 0 && (
        <div className="card">
          <div className="sub">On order</div>
          {c.orders!.map((o) => <div key={o.id} className="kv"><span>{TYPES[o.type].name}</span><span className="num">week {o.w}</span></div>)}
        </div>
      )}
      <div className="card">
        <label className="small" htmlFor="trade">Trade in</label>
        <select id="trade" className="field" value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="">Nothing</option>
          {idle.map((m) => <option key={m.id} value={m.id}>{machineName(m)}, {m.year} · {fk(tradeCredit(m, c.week))}</option>)}
        </select>
        <div className="tiny muted">The dealer takes it when you order, and allows {Math.round(TRADE_SHARE * 100)}% of what it'd fetch.</div>
      </div>
      {space <= 0 && <div className="why">Your yard is full ({YARDS[c.yard].slots} machines, counting what's on order). Trade one in, sell one, or move to a bigger yard.</div>}
      {types.map((t) => {
        const price = newPrice(t, md), owe = price - credit, dep = Math.round(Math.max(0, owe) * NEW_DEPOSIT);
        return (
          <div key={t} className="card">
            <div className="mhead"><MachineIcon type={t} /><b className="grow">{TYPES[t].name}</b><span className="num" style={{ fontWeight: 600 }}>{f(price)}</span></div>
            {tr && <div className="tiny muted">Less {fk(credit)} for the {machineName(tr)}: {owe >= 0 ? f(owe) + ' to pay.' : 'the dealer pays you ' + f(-owe) + '.'}</div>}
            <div className="btns">
              <button type="button" className="btn" disabled={space <= 0 || c.bank < owe} onClick={() => order(t, false)}>{owe >= 0 ? 'Order · ' + fk(owe) : 'Order · get ' + fk(-owe) + ' back'}</button>
              {c.won && owe > 0 && <button type="button" className="btn" disabled={space <= 0 || c.bank < dep} onClick={() => order(t, true)}>On finance · {fk(dep)} down</button>}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function MarketTab({ c, act }: { c: Career; act: Act }) {
  const [seg, setSeg] = useState<'auction' | 'buy' | 'new'>('auction');
  const L = c.market?.listings ?? [];
  return (
    <>
      <div className="seg">
        <button type="button" className={seg === 'auction' ? 'on' : ''} onClick={() => setSeg('auction')}>Auction</button>
        <button type="button" className={seg === 'buy' ? 'on' : ''} onClick={() => setSeg('buy')}>Buy</button>
        <button type="button" className={seg === 'new' ? 'on' : ''} onClick={() => setSeg('new')}>New</button>
      </div>
      {seg === 'auction' ? <Auction c={c} act={act} /> : seg === 'new' ? <Dealer c={c} act={act} /> : (
        <>
          <div className="small muted">New listings every week. To sell a machine, open it in the Yard.</div>
          {!L.length && <div className="card small muted">Nothing left this week.</div>}
          {L.map((m) => <ListingCard key={m.id} c={c} m={m} act={act} />)}
          {c.packs?.bulk && <Attachments c={c} act={act} />}
        </>
      )}
    </>
  );
}
