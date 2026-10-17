// Before opening: buy your first machine (a grader, at least), then open for business.

import { TOWNS, YARDS, machineName, game, type Listing } from '@engine';
import { MachineIcon } from '../Icon';
import { f } from '../format';
import { TopBar } from './Game';

type Career = game.Career;

export function ListingCard({ c, m, act }: { c: Career; m: Listing; act: (fn: (c: Career) => unknown) => void }) {
  const full = game.room(c) <= 0, can = c.bank >= m.price && !full;
  const seller = m.seller === 'dealer' ? <span className="chip c-job">DEALER</span> : m.seller === 'private' ? <span className="chip c-idle">PRIVATE</span>
    : <span className="chip c-bad">{(m.who || 'RIVAL').toUpperCase()}{m.distress ? ' · NEEDS CASH' : ' SELLING'}</span>;
  const condTxt = m.revealed ? 'Condition ' + m.cond + '%' : 'Seller says ' + m.claimed + '%';
  const note = m.seller === 'dealer' ? '8 weeks\' warranty. Costs the most, least risk.' : m.seller === 'private' ? (m.revealed ? 'Checked by your mechanic.' : 'No warranty. A mechanic can check it for $600.')
    : m.distress ? 'They\'re short of cash and want it gone. Cheap, but no warranty.' : 'Selling up. Ask yourself why.';
  return (
    <div className="card">
      <div className="row">{seller}<span className="grow" /><span className="num" style={{ fontWeight: 600, fontSize: 16 }}>{f(m.price)}</span></div>
      <div className="mhead"><MachineIcon type={m.type} /><b className="grow">{machineName(m)}, {m.year}</b></div>
      <div className="small muted">{m.hours.toLocaleString('en-AU')} hrs · {condTxt} · {note}</div>
      <div className="btns">
        <button type="button" className="btn dark" disabled={!can} onClick={() => act((x) => game.buy(x, m.id))}>Buy</button>
      </div>
      {full ? <div className="why">Your yard is full ({YARDS[c.yard].slots} machines). Move to a bigger yard or sell one first.</div> : !can && <div className="why">You have {f(c.bank)}.</div>}
    </div>
  );
}

export function ShopScreen({ c, act }: { c: Career; act: (fn: (c: Career) => unknown) => void }) {
  const hasGrader = game.owns(c, 'grader');
  return (
    <>
      <TopBar c={c} />
      <div className="wrap">
        <main>
          <div>
            <h2 style={{ fontSize: 24 }}>Buy your first machine</h2>
            <div className="small muted">Most of the work around {TOWNS[c.town].name} needs a grader. Keep some cash back: the first payments can take weeks to come in.</div>
          </div>
          {c.fleet.length > 0 && (
            <div className="card">
              <div className="sub">Your fleet</div>
              {c.fleet.map((m) => <div key={m.id} className="kv"><span>{machineName(m)}, {m.year}</span><span className="num">{Math.round(m.cond)}%</span></div>)}
            </div>
          )}
          {c.market!.listings.map((m) => <ListingCard key={m.id} c={c} m={m} act={act} />)}
        </main>
      </div>
      <div className="dock">
        <div className="wrap">
          <button type="button" className="big" disabled={!hasGrader} onClick={() => act((x) => game.open(x))}>{hasGrader ? 'Open for business' : 'Buy a grader to start'}</button>
        </div>
      </div>
    </>
  );
}
