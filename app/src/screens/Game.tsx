// The game screen: the site-office header, the tab you're on, the dock (End week and the tabs),
// and the sheets that come up over it: a card waiting for you, selling a machine, the week's docket.

import { useEffect, useState } from 'react';
import { CARD_TEXT } from '@engine/text/cards';
import { TOWNS, cardOptions, choose, forecast, monthIdx, yearOf, game } from '@engine';
import { Icon, WeatherIcon } from '../Icon';
import { MONTHS, f } from '../format';
import { YardTab } from './Yard';
import { WorkTab } from './Work';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
type Tab = 'yard' | 'work' | 'market' | 'career' | 'bank';

const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: 'yard', label: 'Yard', icon: 'yard' },
  { k: 'work', label: 'Work', icon: 'work' },
  { k: 'market', label: 'Market', icon: 'market' },
  { k: 'career', label: 'Career', icon: 'career' },
  { k: 'bank', label: 'Office', icon: 'office' },
];

export function TopBar({ c }: { c: Career }) {
  const L = c.loan, td = forecast({ town: c.town, wxStart: c.wxStart }, c.week, 0);
  return (
    <header className="top">
      <div className="wrap">
        <div className="co">
          <b>{c.co}{c.hardcore && <> <span className="chip c-bad" style={{ verticalAlign: 2 }}>HARDCORE</span></>}</b>
          <span><WeatherIcon pc={td.pc} wetGround={td.wetGround} />Week {c.week} · {MONTHS[monthIdx(c.week)]} {yearOf(c.week)} · {TOWNS[c.town].name}</span>
        </div>
        <div className="bank">
          <small>BANK</small>
          <div className="num" style={{ color: c.bank < 0 ? 'var(--head-neg)' : 'var(--head-fg)' }}>{f(c.bank)}</div>
          {L.bal > 0 && (
            <div className="pips" aria-label={L.missed + ' of 3 missed repayments'}>
              {[0, 1, 2].map((i) => <span key={i} className={'pip' + (L.missed > i ? ' on' : '')} />)}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** The card at the front of the queue, with its options. */
function CardSheet({ c, act }: { c: Career; act: Act }) {
  const q = c.queue[0]!;
  // drawing the card is part of the game (it can set its seed), so it goes through act
  const opts = cardOptions(c, q);
  const T = CARD_TEXT[q.k];
  // a card that no longer applies just goes, once the screen has drawn
  useEffect(() => {
    if (!opts) act((x) => choose(x, 0));
  });
  if (!opts) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={T?.title ?? q.k}>
      <div className="sheet curve">
        <div className="sub">{T?.tag ?? 'Decision'}</div>
        <h2>{T?.title ?? q.k}</h2>
        {opts.map((o, i) => (
          <button key={o.id} type="button" className="choice" onClick={() => act((x) => choose(x, i))}>
            <b>{T?.options[o.id]?.label ?? o.id}</b>
            {T?.options[o.id]?.sub && <span>{T.options[o.id]!.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The week's docket: what got done and what it came to. Words for each event come in a later step. */
function Docket({ r, co, onClose }: { r: game.Report; co: string; onClose: () => void }) {
  const net = Math.round(r.paid - r.costs);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={'Week ' + r.week + ' report'}>
      <div className="sheet docket" aria-live="polite">
        <div className="row docket-head"><span className="sub grow">Docket {('000' + r.week).slice(-4)} · {co}</span><span className="sub">Week {r.week}</span></div>
        <h2>{r.worked ? r.worked + ' machine-day' + (r.worked > 1 ? 's' : '') + ' worked' : r.rain >= 4 ? 'Rained out' : 'A quiet week'}</h2>
        <div className="docket-net" style={{ color: net >= 0 ? 'var(--teal)' : 'var(--rust)' }}>{net >= 0 ? '+' : '−'}{f(Math.abs(net))} <span className="small muted">cash this week</span></div>
        <div className="card">
          <div className="kv"><span>Invoiced</span><span className="num">{f(r.invoiced)}</span></div>
          <div className="kv"><span>Paid to you</span><span className="num">{f(r.paid)}</span></div>
          <div className="kv"><span>Costs</span><span className="num">{f(r.costs)}</span></div>
          <div className="kv"><span>Days rained off</span><span className="num">{r.rain}</span></div>
          <div className="kv"><span>Rain</span><span className="num">{r.mm} mm</span></div>
        </div>
        <button type="button" className="big" onClick={onClose}>Carry on</button>
      </div>
    </div>
  );
}

function ComingNext({ name }: { name: string }) {
  return (
    <div className="card">
      <b>{name}</b>
      <div className="small muted">This screen is next on the list. Everything behind it already works in the engine.</div>
    </div>
  );
}

export function GameScreen({ c, act, onNew }: { c: Career; act: Act; onNew: () => void }) {
  const [tab, setTab] = useState<Tab>('yard');
  const [report, setReport] = useState<game.Report | null>(null);
  const endWeek = () => act((x) => { const r = game.endWeek(x); if (r) setReport(r); });
  return (
    <>
      <TopBar c={c} />
      <div className="wrap">
        <main>
          {c.hardcore && c.under ? (
            <div className="card" style={{ border: '2px solid var(--rust)' }}>
              <div className="row"><b className="grow" style={{ color: 'var(--rust)' }}>Trading insolvent</b><span className="chip c-bad">WEEK {c.under} OF 4</span></div>
              <div className="small">You owe more than the business is worth. Get above water or it goes into administration.</div>
            </div>
          ) : null}
          {tab === 'yard' && <YardTab c={c} act={act} />}
          {tab === 'work' && <WorkTab c={c} act={act} />}
          {tab === 'market' && <ComingNext name="Market: buying and the auction" />}
          {tab === 'career' && <ComingNext name="Career: the ladder and your tickets" />}
          {tab === 'bank' && <ComingNext name="Office: money, the bank and the books" />}
          <div className="btns"><button type="button" className="btn" onClick={() => { if (confirm('Start a new career? This one will be gone.')) onNew(); }}>Start a new career</button></div>
        </main>
      </div>
      <div className="dock">
        <div className="wrap">
          <div className="endrow">
            <button type="button" className="big" disabled={c.queue.length > 0} onClick={endWeek}>End week {c.week}<Icon k="go" /></button>
          </div>
          <nav className="tabs" aria-label="Sections" style={{ gridTemplateColumns: `repeat(${TABS.length},minmax(0,1fr))` }}>
            {TABS.map((t) => (
              <button key={t.k} type="button" className={'tab' + (tab === t.k ? ' on' : '')} aria-current={tab === t.k ? 'page' : undefined} onClick={() => setTab(t.k)}>
                <Icon k={t.icon} /><span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      {report ? <Docket r={report} co={c.co} onClose={() => setReport(null)} /> : c.queue.length > 0 && <CardSheet c={c} act={act} />}
    </>
  );
}
