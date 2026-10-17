// The Market tab: this week's auction lot, and machines for sale. Selling is done from the Yard.

import { useState } from 'react';
import { TYPES, YARDS, game } from '@engine';
import { hammerText, lotFrom, lotGuide } from '@engine/text/market';
import { MachineIcon } from '../Icon';
import { f } from '../format';
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
            <button type="button" className="btn grow" onClick={() => act((x) => game.bid(x, 1000))}>+$1,000</button>
            <button type="button" className="btn dark grow" onClick={() => act((x) => game.bid(x, 5000))}>+$5,000</button>
          </div>
          <button type="button" className="btn full" disabled={!mine} onClick={() => act((x) => game.hammer(x))}>{mine ? 'Let the hammer fall' : 'Outbid: bid again or let it go'}</button>
          {mine && total > c.bank && <div className="why">You're winning, but you can't pay {f(total)}.</div>}
        </>
      )}
    </div>
  );
}

export function MarketTab({ c, act }: { c: Career; act: Act }) {
  const [seg, setSeg] = useState<'auction' | 'buy'>('auction');
  const L = c.market?.listings ?? [];
  return (
    <>
      <div className="seg">
        <button type="button" className={seg === 'auction' ? 'on' : ''} onClick={() => setSeg('auction')}>Auction</button>
        <button type="button" className={seg === 'buy' ? 'on' : ''} onClick={() => setSeg('buy')}>Buy</button>
      </div>
      {seg === 'auction' ? <Auction c={c} act={act} /> : (
        <>
          <div className="small muted">New listings every week. To sell a machine, open it in the Yard.</div>
          {!L.length && <div className="card small muted">Nothing left this week.</div>}
          {L.map((m) => <ListingCard key={m.id} c={c} m={m} act={act} />)}
        </>
      )}
    </>
  );
}
