// The game screen: the site-office header, the tab you're on, the dock (End week and the tabs),
// and the sheets that come up over it: a card waiting for you, selling a machine, the week's docket.

import { useEffect, useState } from 'react';
import { cardView, resultText, type CardView } from '@engine/text/cardView';
import { MOODS, TOWNS, alertMachines, canRunOn, coachOff, coachOk, coachOn, coachStep, runOn, tabIsNew, tabSeen, tabShown, whyNot, type Handled, type RunStop, type RunSummary, choose, dayOffset, drawCard, forecast, gstInBank, monthIdx, recordDate, yearOf, game, play } from '@engine';
import { docketLines, docketStamps } from '@engine/text/docket';
import { TICKET_TEXT } from '@engine/text/career';
import { rw } from '@engine/text/real';
import { BULK_COACH_TEXT, COACH_TEXT, RUN_STOP, handledLine, nextGoal } from '@engine/text/coach';
import { COACH } from '@engine';
import { Mentor } from '../Mentor';
import { Icon, WeatherIcon } from '../Icon';
import { sfx } from '../sound';
import { showBanner, useAds, watchReward } from '../ads';
import { useBackButton } from '../back';
import { MONTHS, f, fk } from '../format';
import { YardTab } from './Yard';
import { WorkTab } from './Work';
import { MarketTab } from './Market';
import { CareerTab } from './Career';
import type { Saves } from '../Slots';
import { OfficeTab } from './Office';
import { MapTab } from './Map';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
type Tab = 'yard' | 'work' | 'map' | 'market' | 'career' | 'bank';

const TABS: { k: Tab; label: string; icon: string }[] = [
  { k: 'yard', label: 'Yard', icon: 'yard' },
  { k: 'work', label: 'Work', icon: 'work' },
  { k: 'map', label: 'Map', icon: 'map' },
  { k: 'market', label: 'Market', icon: 'market' },
  { k: 'bank', label: 'Office', icon: 'office' },
  { k: 'career', label: 'Career', icon: 'career' },
];

export function TopBar({ c, goal }: { c: Career; goal?: { tip?: boolean; t: string; go: () => void } | null }) {
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
      {goal && (
        <button type="button" className="hgoal" onClick={goal.go}>
          <div className="wrap"><i aria-hidden="true" /><span className="hgoal-k">{goal.tip ? 'Tip' : 'Next'}</span><span className="hgoal-t">{goal.t.replace(/^Next:\s*/, '')}</span></div>
        </button>
      )}
    </header>
  );
}

/** What you chose and what came of it, before the next card. */
export interface Outcome { tag: string; title: string; chosen: string; res: string }

/** A tender result: who priced what and how they scored, then why the top two scored what they did. */
function ResultTable({ t }: { t: NonNullable<CardView['table']> }) {
  return (
    <div className="card">
      <div className="row tiny muted">
        <span className="grow">Firm</span>
        <span style={{ width: t.council ? 70 : 84, textAlign: 'right' }}>Price</span>
        {t.council && <span style={{ width: 52, textAlign: 'right' }}>Method</span>}
        <span style={{ width: t.council ? 48 : 52, textAlign: 'right' }}>Score</span>
      </div>
      {t.rows.map((e) => (
        <div key={e.name} className="row small" style={e.you ? { fontWeight: 700 } : undefined}>
          <span className="grow">{e.name}</span>
          <span className="num" style={{ width: t.council ? 70 : 84, textAlign: 'right' }}>{fk(e.price)}</span>
          {t.council && <span className="num" style={{ width: 52, textAlign: 'right' }}>{e.method}/6</span>}
          <span className="num" style={{ width: t.council ? 48 : 52, textAlign: 'right' }}>{e.score.toFixed(1)}</span>
        </div>
      ))}
      {t.why.map((w, i) => <div key={i} className={'tiny' + (w.you ? '' : ' muted')}>{w.text}</div>)}
    </div>
  );
}

// These tags are plain news; the rest are curve balls.
const PLAIN = new Set(['Tender result', 'Your branch', 'Tax office', 'Year in review', 'The industry', 'The bank']);

/** The card at the front of the queue: what's happened, and your options. */
function CardSheet({ c, act, onDone }: { c: Career; act: Act; onDone: (o: Outcome) => void }) {
  const q = c.queue[0]!;
  const [adMsg, setAdMsg] = useState('');
  // drawing a card sets its seed the first time, so the same card always reads the same
  const d = drawCard(c, q);
  // a card that no longer applies just goes, once the screen has drawn
  useEffect(() => {
    if (!d) act((x) => play.choose(x, 0));
  });
  if (!d) return null;
  const v = cardView(c, q, d);
  // by id, not position: an ad choice can come or go while the card's open
  const take = (id: string) => act((x) => {
    const dx = drawCard(x, x.queue[0]!), i = dx ? dx.opts.findIndex((o) => o.id === id) : -1;
    if (i < 0) return;
    // winning a tender gets the two bright notes
    if ((q.k === 'tresult' || q.k === 'cresult') && /^You won|^The council picked you/.test(v.title)) sfx('win', x.sound);
    const a = play.choose(x, i);
    if (a) onDone({ tag: v.tag, title: v.title, chosen: v.opts.find((o) => o.id === id)!.label, res: resultText(x, a) });
  });
  // an ad choice: the ad first, the reward only if they watched it through
  const pick = (id: string) => {
    if (!id.startsWith('ad')) return take(id);
    setAdMsg('');
    void watchReward().then((ok) => {
      if (!ok) return setAdMsg("The ad didn't finish, so no reward this time. Pick another option, or try again in a minute.");
      act((x) => { x.adsOn = true; });
      take(id);
    });
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={v.title}>
      <div className="sheet curve">
        <div className="sub" style={{ color: 'var(--rust)' }}>{PLAIN.has(v.tag) ? '' : 'Curve ball · '}{v.tag}</div>
        <h2 style={{ fontSize: 22 }}>{v.title}</h2>
        <div style={{ fontSize: 15, color: 'var(--ink)' }}>{v.body}</div>
        {v.table && <ResultTable t={v.table} />}
        {q.k === 'bas' && <Mentor c={c} k="bas" act={act} />}
        {q.k === 'yearend' && <Mentor c={c} k="year" act={act} />}
        {(q.k === 'tresult' || q.k === 'cresult') && <Mentor c={c} k="score" act={act} />}
        {adMsg && <div className="small" style={{ color: 'var(--rust)' }}>{adMsg}</div>}
        {v.opts.map((o) => (
          <button key={o.id} type="button" className="choice" onClick={() => pick(o.id)}>
            <b>{o.label}</b>
            <span>{o.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultSheet({ r, onClose }: { r: Outcome; onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={r.title}>
      <div className="sheet curve">
        <div className="sub">{r.tag}</div>
        <h2>{r.title}</h2>
        <div className="card" style={{ border: '2px solid var(--ink)' }}>
          <div className="sub">You chose</div>
          <b>{r.chosen}</b>
          <div className="small">{r.res}</div>
        </div>
        <button type="button" className="big" onClick={onClose}>Carry on</button>
      </div>
    </div>
  );
}

/** The week's docket: what got done, what it came to, the rain day by day, and everything that happened. */
function Docket({ c, r, onClose }: { c: Career; r: game.Report & { run?: RunSummary; stop?: RunStop | null; handled?: Handled[] }; onClose: () => void }) {
  const R = r.run, net = Math.round(R ? R.paid - R.costs : r.paid - r.costs), lines = docketLines(c, r), stamps = docketStamps(c, r);
  const wx = { town: c.town, wxStart: c.wxStart }, held = c.gst && gstInBank(game.tax(c)) ? c.gst.held : 0;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={'Week ' + r.week + ' report'}>
      <div className="sheet docket" aria-live="polite">
        <div className="row docket-head"><span className="sub grow">Docket {('000' + r.week).slice(-4)} · {c.co}</span><span className="sub">Week {r.week}</span></div>
        <h2>{R ? R.n + ' weeks run: weeks ' + R.from + ' to ' + R.to : r.worked ? r.worked + ' machine-day' + (r.worked > 1 ? 's' : '') + ' worked' : r.rain >= 4 ? 'Rained out' : 'A quiet week'}</h2>
        {R && <div className="small muted">{R.worked} machine-days worked, {R.rain} days rained off, {f(R.invoiced)} invoiced.{R.n >= 4 && ' Stopped after four quiet weeks.'} The details below are from the last week.</div>}
        {r.handled && r.handled.length > 0 && (
          <div className="card">
            <div className="sub">Handled for you</div>
            {r.handled.map((h, i) => <div key={i} className="small">{handledLine(h)}</div>)}
          </div>
        )}
        {r.stop && <div className="small" style={{ fontWeight: 700 }}>{RUN_STOP[r.stop]}</div>}
        <div className="docket-net" style={{ color: net >= 0 ? 'var(--teal)' : 'var(--rust)' }}>{net >= 0 ? '+' : '−'}{f(Math.abs(net))} <span className="small muted">{R ? 'cash over ' + R.n + ' weeks' : 'cash this week'}</span></div>
        {stamps.length > 0 && <div className="stamps">{stamps.map((t, i) => <span key={i} className="stamp">{t}</span>)}</div>}
        <div className="card">
          {r.shut ? <div className="kv"><b>Christmas shutdown</b><span>Nobody working</span></div> : <div className="kv"><span>Rained off</span><span className="num">{r.rain} of 5 days</span></div>}
          <div className="fc">
            {r.days.map((x, d) => (
              <div key={d} className={'fcd' + (x.wet ? ' wet' : '')}>
                <b>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d]}</b>
                <Icon k={x.mm >= 4 ? 'rain' : x.wet ? 'mud' : x.mm >= 1 ? 'cloud' : 'sun'} />
                <span className="fcp">{x.mm}</span><span className="tiny" style={{ opacity: 0.8 }}>mm</span>
              </div>
            ))}
          </div>
          <div className="tiny muted">Real rainfall at {TOWNS[c.town].name}, the week of {recordDate(wx, dayOffset(r.week, 0)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}. Weather data: Open-Meteo.com (CC BY 4.0).</div>
          <div className="kv"><span>Machine-days lost</span><span className="num">{r.lost}</span></div>
          <div className="kv"><span>Invoiced</span><span className="num">{f(r.invoiced)}</span></div>
          <div className="kv"><span>Paid in</span><span className="num" style={{ color: 'var(--teal)' }}>{f(r.paid)}</span></div>
          <div className="kv"><span>Costs out</span><span className="num" style={{ color: 'var(--rust)' }}>−{f(r.costs)}</span></div>
          {held > 0 && <div className="kv"><span>GST held for the tax office</span><span className="num">{f(held)}</span></div>}
          <div className="kv"><b>In the bank</b><b className="num">{f(c.bank)}</b></div>
          <div className="kv"><span>The market</span><b>{MOODS[game.mood(c)].t}</b></div>
        </div>
        {r.tix.length > 0 && (
          <div className="card" style={{ border: '2px solid var(--ink)' }}>
            <div className="sub">New ticket{r.tix.length > 1 ? 's' : ''}</div>
            {r.tix.map((id) => <div key={id}><b>{TICKET_TEXT[id]?.n ?? id}</b><div className="small muted">{TICKET_TEXT[id]?.d}</div></div>)}
          </div>
        )}
        {lines.length > 0 && <div className="card">{lines.map((t, i) => <div key={i} className="small">{t}</div>)}</div>}
        <button type="button" className="big" onClick={onClose}>{c.queue.length ? "Something's come up" : 'Start week ' + c.week}</button>
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

/** The coach's step: what to do, and a button to the tab that shows you. */
function CoachCard({ c, tab, act, go }: { c: Career; tab: Tab; act: Act; go: (t: Tab) => void }) {
  const step = coachStep(c);
  if (!step) return null;
  const T0 = (c.path === 'bulk' ? BULK_COACH_TEXT : COACH_TEXT)[step.id], T = { t: rw(T0.t), d: rw(T0.d) };
  return (
    <div className="card coach">
      <div className="row"><span className="sub grow">Getting started · {c.coach!.i + 1} of {COACH.length}</span><button type="button" className="linkbtn" onClick={() => act((x) => play.coachOff(x))}>Skip the tips</button></div>
      <b style={{ fontSize: 17 }}>{T.t}</b>
      <div className="small">{T.d}</div>
      <div className="btns">
        {step.tab && tab !== step.tab && <button type="button" className="btn dark" onClick={() => go(step.tab as Tab)}>Show me</button>}
        {step.ok && <button type="button" className="btn" onClick={() => act((x) => play.coachOk(x))}>Got it</button>}
      </div>
    </div>
  );
}

export function GameScreen({ c, act, onNew, saves, saveFailed, demo }: { c: Career; act: Act; onNew: () => void; saves: Saves; saveFailed: boolean; demo: boolean }) {
  const [tab0, setTab0] = useState<Tab>(coachStep(c)?.id === 'earn' ? 'work' : 'yard');
  const [report, setReport] = useState<(game.Report & { run?: RunSummary }) | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // a stamp for a week with a ticket or something finished, otherwise the diesel turning over
  const weekSound = (x: Career, r: game.Report) => sfx(r.tix.length || docketStamps(x, r).length ? 'stamp' : 'start', x.sound);
  const endWeek = () => act((x) => { const r = play.endWeek(x); if (r) { weekSound(x, r); setReport(r); } });
  const runWeeks = () => act((x) => { const r = play.runOn(x); if (r) { weekSound(x, r); setReport(r); } });
  // a tab that hasn't appeared yet can't be open; looking at a new one clears its NEW badge
  const tab: Tab = tabShown(c, tab0) ? tab0 : 'yard';
  // rewarded ads on offer when one's loaded (never in a season: the engine checks)
  const ads = useAds();
  c.adsOn = ads.ready;
  // the banner: Market and Office only, never over a card or the docket
  const banner = (tab === 'market' || tab === 'bank') && !report && !outcome && c.queue.length === 0;
  useEffect(() => { void showBanner(banner); }, [banner]);
  useEffect(() => () => { void showBanner(false); }, []);
  const setTab = (t: Tab) => setTab0(t);
  useEffect(() => { if (tabIsNew(c, tab)) act((x) => tabSeen(x, tab)); });
  useBackButton(tab, () => setTab('yard'));
  const shown = TABS.filter((t) => tabShown(c, t.k));
  const offers = c.offers.filter((o) => !whyNot(c as never, o)).length + c.tenders.filter((t) => !t.bid).length + c.ctenders.filter((t) => !t.bid).length;
  const badge = (k: Tab): string | number => ({ yard: alertMachines(c.fleet), work: offers, bank: c.odOver || c.loan.missed ? '!' : 0 } as Record<string, string | number>)[k] || (tabIsNew(c, k) ? 'NEW' : 0);
  const NG = nextGoal(c);
  return (
    <>
      <TopBar c={c} goal={NG ? { tip: NG.tip, t: NG.t, go: () => setTab(NG.tab as Tab) } : null} />
      <div className="wrap">
        <main>
          {c.hardcore && c.under ? (
            <div className="card" style={{ border: '2px solid var(--rust)' }}>
              <div className="row"><b className="grow" style={{ color: 'var(--rust)' }}>Trading insolvent</b><span className="chip c-bad">WEEK {c.under} OF 4</span></div>
              <div className="small">You owe more than the business is worth. Get above water or it goes into administration.</div>
            </div>
          ) : null}
          {saveFailed && (
            <div className="card" style={{ border: '2px solid var(--rust)' }}>
              <b style={{ color: 'var(--rust)' }}>This device couldn't save your game</b>
              <div className="small">Its storage may be full or blocked (a private window does this). Keep this tab open, or your progress since the last save is lost.</div>
            </div>
          )}
          {demo && !location.search.includes('shots') && <div className="card"><div className="small muted">A demo career: nothing you do here is saved, and your own saves aren't touched.</div></div>}
          <CoachCard c={c} tab={tab} act={act} go={setTab} />
          {!coachOn(c) && c.week >= 6 && tab !== 'bank' && <Mentor c={c} k="runon" act={act} />}
          {tab === 'yard' && <YardTab c={c} act={act} go={setTab} />}
          {tab === 'work' && <WorkTab c={c} act={act} />}
          {tab === 'map' && <MapTab c={c} />}
          {tab === 'market' && <MarketTab c={c} act={act} />}
          {tab === 'career' && <CareerTab c={c} act={act} onNew={onNew} saves={saves} />}
          {tab === 'bank' && <OfficeTab c={c} act={act} go={setTab} />}
        </main>
      </div>
      <div className="dock">
        <div className="wrap">
          <div className="endrow">
            <button type="button" className="big" disabled={c.queue.length > 0} onClick={endWeek}>End week {c.week}<Icon k="go" /></button>
            {!coachOn(c) && (
              <button type="button" className="runon" disabled={!canRunOn(c)} onClick={runWeeks} aria-label="Run up to four weeks, making the small calls for you and stopping when something bigger needs you"><b>Run on</b><span>up to 4 wks</span></button>
            )}
          </div>
          <nav className="tabs" aria-label="Sections" style={{ gridTemplateColumns: `repeat(${shown.length},minmax(0,1fr))` }}>
            {shown.map((t) => {
              const b = badge(t.k);
              return (
                <button key={t.k} type="button" className={'tab' + (tab === t.k ? ' on' : '')} aria-current={tab === t.k ? 'page' : undefined} onClick={() => setTab(t.k)}>
                  <Icon k={t.icon} /><span>{t.label}</span>
                  {b ? <span className="badge" aria-label={b + ' to look at'}>{b}</span> : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
      {outcome ? <ResultSheet r={outcome} onClose={() => setOutcome(null)} /> : report ? <Docket c={c} r={report} onClose={() => setReport(null)} /> : c.queue.length > 0 && <CardSheet key={JSON.stringify(c.queue[0])} c={c} act={act} onDone={setOutcome} />}
    </>
  );
}
