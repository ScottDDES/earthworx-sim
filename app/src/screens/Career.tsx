// The Career tab: your tickets, where you are on the ladder and what the next step needs, your track record,
// the district (the market and the other outfits), and selling up to retire.

import { useState } from 'react';
import { BETA } from '../channel';
import { buy, canBuy, hasBulk, restore, useShop } from '../shop';
import { adPrivacyOptions, adsAvailable } from '../ads';
import { MOODS, TICKETS, inherit, TIER, canBuyOut, checks, checks2, checks3, checks4, checks5, ownedCounts, routeRung, rung, rvForm, rvPhase, stars, game, play } from '@engine';
import { TICKET_CATS, TICKET_TEXT, checkWords, districtForm, starTxt, stepsFor } from '@engine/text/career';
import { diaryLines } from '@engine/text/diary';
import { sfx } from '../sound';
import { f, fk } from '../format';
import { SlotsBar, SlotsCard, type Saves } from '../Slots';
import { SeasonCard, SeasonPicker } from '../Seasons';
import { PRIVACY_URL } from '../board';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;

const tixNo = (n: number) => 'TKT ' + ('000' + n).slice(-4);

function Ticket({ c, id, small }: { c: Career; id: string; small?: boolean }) {
  const g = c.tix?.[id], T = TICKET_TEXT[id]!;
  return (
    <div className={'ticket' + (g ? ' got' : '')}>
      <span className="tno">{g ? tixNo(g.no) + ' · WK ' + g.w : 'NOT YET'}</span>
      <b>{T.n}</b>
      {!small && <span className="tiny muted">{T.d}</span>}
    </div>
  );
}

function Wallet({ c }: { c: Career }) {
  const [open, setOpen] = useState(false);
  const got = TICKETS.filter((t) => c.tix?.[t.id]), n = got.length;
  const recent = got.slice().sort((a, b) => c.tix![b.id]!.no - c.tix![a.id]!.no).slice(0, 3);
  const next = TICKETS.filter((t) => !c.tix?.[t.id]).slice(0, 2);
  return (
    <div className="card">
      <div className="row"><b className="grow" style={{ fontSize: 18 }}>Your tickets</b><span className="num"><b>{n}</b> of {TICKETS.length}</span></div>
      <div className="bar"><i style={{ width: (n / TICKETS.length) * 100 + '%', background: 'var(--hi)' }} /></div>
      {!open ? (
        <>
          {recent.length ? <div className="tix">{recent.map((t) => <Ticket key={t.id} c={c} id={t.id} small />)}</div>
            : <div className="small muted">Earn tickets by doing the real thing: your first hire job, a clean year, a program in early. They show here and on the board.</div>}
          {next.length > 0 && (
            <div className="tiny muted">Up next: {next.map((t, i) => <span key={t.id}>{i ? ', ' : ''}<b>{TICKET_TEXT[t.id]!.n}</b> ({TICKET_TEXT[t.id]!.d.replace(/\.$/, '').toLowerCase()})</span>)}.</div>
          )}
        </>
      ) : (
        Object.keys(TICKET_CATS).map((cat) => (
          <div key={cat}>
            <div className="sub" style={{ marginTop: 6 }}>{TICKET_CATS[cat]}</div>
            <div className="tix">{TICKETS.filter((t) => t.c === cat).map((t) => <Ticket key={t.id} c={c} id={t.id} />)}</div>
          </div>
        ))
      )}
      <button type="button" className="btn full" onClick={() => setOpen(!open)}>{open ? 'Close the wallet' : 'Open the wallet'}</button>
    </div>
  );
}

/** Has this outfit started on the other kind of work? A bulk outfit with a grader or a road job; a roads outfit with the pack and a bulk job or a dirt mover. */
function bothWays(c: Career): boolean {
  const owns = (ts: string[]) => c.fleet.some((m) => ts.includes(m.type) && m.status !== 'auction');
  if (c.path === 'bulk') return owns(['grader']) || (c.subsWon || 0) > 0;
  return !!c.packs?.bulk && (((c as { bulkDone?: number }).bulkDone || 0) > 0 || owns(['d6', 'd8', 'd9', 'd10', 'excavator', 'pull', 's623', 's627', 's631', 's637', 's651', 's657']));
}

/** The career ladder, one route at a time: the outfit's own, and (once it does both kinds of work) the other. */
function Ladder({ c, route, other }: { c: Career; route: 'roads' | 'bulk'; other?: boolean }) {
  const [all, setAll] = useState(false);
  const r = { ...c, path: route } as never, rg = routeRung(c as never, route), st = { ...c, path: route, owned: ownedCounts(c.fleet) };
  const ok: Record<number, boolean[]> = { 3: checks(r), 4: checks2(r), 5: checks3(r), 7: checks4(r), 8: checks5(r) };
  const STEPS = stepsFor(route), later = STEPS.length - (rg + 1);
  return (
    <div className="card">
      {other !== undefined && (
        <div className="sub">{route === 'bulk' ? 'Bulk and Ag work' : 'Road work'}{other ? '' : ' (where you started)'}</div>
      )}
      {STEPS.map((s, i) => {
        const k = i + 1, cls = k < rg ? 'done' : k === rg ? 'here' : '';
        if (k > rg + 1 && !all) {
          if (k !== rg + 2) return null;
          return (
            <div key={k} className="row" style={{ padding: '4px 0 2px' }}>
              <span className="small muted grow">{later} more step{later > 1 ? 's' : ''} after that, up to {STEPS[STEPS.length - 1]!.t}.</span>
              <button type="button" className="btn" onClick={() => setAll(true)}>Show all</button>
            </div>
          );
        }
        return (
          <div key={k} className="step">
            <span className={'dot ' + cls}>{k < rg ? '✓' : k}</span>
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 10 }}>
              <b style={{ color: k > rg ? 'var(--muted)' : 'var(--ink)' }}>{s.t}{k === rg && <> <span className="chip c-dark" style={{ marginLeft: 4 }}>YOU</span></>}</b>
              <span className="small muted">{s.d}</span>
              {s.u && k > rg && <span className="tiny" style={{ color: 'var(--teal)', fontWeight: 600 }}>Unlocks: {s.u}</span>}
              {ok[k] && checkWords(k, st, ok[k]!).map((x) => (
                <span key={x.t} className="check"><span className={x.ok ? 'ok' : 'no'}>{x.ok ? '✓' : '○'}</span>{x.t}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function District({ c, act }: { c: Career; act: Act }) {
  const md = game.mood(c), M = MOODS[md];
  const order = ['big', 'mid', 'small'];
  const rv = c.rivals.slice().sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || b.stars - a.stars);
  return (
    <div className="card">
      <div className="row"><b className="grow">Around the district</b><span className={'chip ' + (md === 'boom' ? 'c-job' : md === 'bust' ? 'c-bad' : 'c-idle')}>{M.t.toUpperCase()}</span></div>
      <div className="small muted">{M.d}</div>
      {rv.map((x) => (
        <div key={x.name}>
          <div className="kv">
            <span>{x.name}<br /><span className="tiny muted">{TIER[x.tier].t} · {x.fleet} machines · {districtForm(rvForm(x, true), x.jobs.length, x.idle)}</span></span>
            <span style={{ color: 'var(--gold)', letterSpacing: 1 }}>{starTxt(x.stars)}</span>
          </div>
          {canBuyOut(c as never) && rvPhase(x) === 'stretched' && (
            <button type="button" className="btn full" onClick={() => act((y) => play.approachRival(y, x.name))}>Approach {x.name} about buying them out</button>
          )}
        </div>
      ))}
      {c.news?.length > 0 && (
        <>
          <div className="sub" style={{ marginTop: 6 }}>Lately</div>
          <Log lines={diaryLines(c, c.news.slice(0, 5))} />
        </>
      )}
    </div>
  );
}

/** Diary lines: the week, then what happened. */
function Log({ lines }: { lines: { w: number; t: string }[] }) {
  return <div className="log">{lines.map((e, i) => <div key={i}><span className="num">Wk {e.w}</span><span>{e.t}</span></div>)}</div>;
}

function RetireSheet({ c, act, onClose }: { c: Career; act: Act; onClose: () => void }) {
  const o = game.retireQuote(c), who = o.who ?? 'A contractor from the coast';
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Sell up and retire">
      <div className="sheet">
        <div className="sub">Sell up and retire</div>
        <h2>{who} will buy the business</h2>
        <div className="card">
          <div className="kv"><span>Your machines</span><span className="num">{c.fleet.filter((m) => m.status !== 'auction').length}, worth about {f(o.v)}</span></div>
          <div className="kv"><span>Their offer, for the gear, the name and your track record</span><span className="num">{f(o.price)}</span></div>
          <div className="kv"><b>You walk away with</b><b className="num" style={{ color: o.walk < 0 ? 'var(--rust)' : 'var(--teal)' }}>{f(o.walk)}</b></div>
          <div className="tiny muted">After the loan, overdraft and anything owed to subbies are paid out, plus what clients still owe you. The market is {MOODS[game.mood(c)].t.toLowerCase()}: offers are better in a boom.</div>
        </div>
        <div className="small">This ends the career. What you walk away with goes on the board as your final result.</div>
        <button type="button" className="big" onClick={() => { act((x) => { play.retireNow(x); sfx('win', x.sound); }); onClose(); }}>Sign and retire · {f(o.walk)}</button>
        {c.won3 && (
          <div className="card">
            <b>Or hand it to the next generation</b>
            <div className="small muted">Your kids take over {c.co} and start again from one machine, with the family name, a star of track record, and {f(inherit(o.walk))} of the family money. Your tickets and the family history carry on.</div>
            <button type="button" className="btn dark full" onClick={() => { act((x) => { play.handOnNow(x); sfx('win', x.sound); }); onClose(); }}>Hand it on</button>
          </div>
        )}
        <button type="button" className="btn full" onClick={onClose}>Not yet</button>
      </div>
    </div>
  );
}

/** Starting again wipes this save only. */
function ResetSheet({ c, slot, onYes, onNo }: { c: Career; slot: number; onYes: () => void; onNo: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Start again">
      <div className="sheet">
        <h2>Start a new career in save {slot}?</h2>
        <div className="small muted">{c.co} and everything in it will be gone. Your other saves stay as they are.</div>
        <button type="button" className="big" onClick={onYes}>Yes, start again</button>
        <button type="button" className="btn full" onClick={onNo}>Keep playing</button>
      </div>
    </div>
  );
}

/** The pack (free in the beta, bought in the store build), no ads, restore, and Google's ad choices. */
function ShopRows({ c, act }: { c: Career; act: (fn: (c: Career) => unknown) => void }) {
  const S = useShop();
  const packOn = () => act((x) => game.setPack(x, 'bulk', !x.packs?.bulk));
  return (
    <>
      {hasBulk() ? (
        <div className="row">
          <span className="grow"><b className="small">Bulk and Ag pack</b><br /><span className="tiny muted">{BETA ? 'Free in the beta. ' : ''}Dozers, scrapers and moxies in the Market; farmers and developers ringing on the Work tab.</span></span>
          <button type="button" className={'btn' + (c.packs?.bulk ? ' dark' : '')} aria-pressed={!!c.packs?.bulk} onClick={packOn}>{c.packs?.bulk ? 'On' : 'Off'}</button>
        </div>
      ) : canBuy() ? (
        <div className="row">
          <span className="grow"><b className="small">Bulk and Ag pack</b><br /><span className="tiny muted">Farm dams, channels, clearing, laser levelling and developers' bulk earthworks, with dozers, scrapers and moxies. One purchase, every save.</span></span>
          <button type="button" className="btn dark" disabled={S.busy} onClick={() => void buy('bulk').then((ok) => ok && act((x) => game.setPack(x, 'bulk', true)))}>{S.price.bulk ?? 'Buy'}</button>
        </div>
      ) : null}
      {canBuy() && !S.owned.noads && (
        <div className="row">
          <span className="grow"><b className="small">No ads</b><br /><span className="tiny muted">Takes the banner off the Market and Office tabs. The ads you choose to watch for a reward stay on offer.</span></span>
          <button type="button" className="btn dark" disabled={S.busy} onClick={() => void buy('noads')}>{S.price.noads ?? 'Buy'}</button>
        </div>
      )}
      {canBuy() && (
        <div className="row">
          <span className="grow tiny muted">Bought these on another phone, or reinstalled?</span>
          <button type="button" className="btn" disabled={S.busy} onClick={() => void restore()}>Restore purchases</button>
        </div>
      )}
      {S.err && <div className="small" style={{ color: 'var(--rust)' }}>{S.err}</div>}
      {adsAvailable() && (
        <div className="row">
          <span className="grow tiny muted">Ads are from Google.</span>
          <button type="button" className="btn" onClick={() => void adPrivacyOptions()}>Ad choices</button>
        </div>
      )}
    </>
  );
}

export function CareerTab({ c, act, onNew, saves }: { c: Career; act: Act; onNew: () => void; saves: Saves }) {
  const [retire, setRetire] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [slots, setSlots] = useState(false);
  const n = stars(c.rep);
  // a season: just the season, the district and the diary
  if (c.season) {
    return (
      <>
        <SeasonCard c={c} saves={saves} hasCareer={saves.hasCareer} />
        <District c={c} act={act} />
        <div className="card">
          <div className="sub">Site diary</div>
          <Log lines={diaryLines(c, (c.log || []).slice(0, 14))} />
        </div>
      </>
    );
  }
  return (
    <>
      {slots ? <SlotsCard saves={saves} onClose={() => setSlots(false)} /> : <SlotsBar saves={saves} onOpen={() => setSlots(true)} />}
      <Wallet c={c} />
      {(c.gen || 1) > 1 && (
        <div className="card">
          <div className="row"><b className="grow">The family business</b><span className="chip c-dark">GENERATION {c.gen}</span></div>
          {(c.dyn as game.Generation[] | undefined || []).map((d) => (
            <div key={d.gen} className="kv"><span>Generation {d.gen} <span className="tiny muted">{stepsFor(c.path)[d.stage - 1]?.t ?? ''}</span></span><span className="num">{d.weeks} wks · {fk(d.walk)}</span></div>
          ))}
          <div className="tiny muted">What each generation built before handing it on.</div>
        </div>
      )}
      {(c.ownWon ?? 0) > 0 && (
        <div className="card">
          <div className="sub">Council contracts</div>
          <div className="kv"><span>Won</span><span className="num">{c.ownWon}</span></div>
          <div className="kv"><span>Finished</span><span className="num">{c.ownDone || 0}</span></div>
          <div className="kv"><span>Finished late</span><span className="num">{c.ownLate || 0}</span></div>
        </div>
      )}
      {c.subsWon > 0 && (
        <div className="card">
          <div className="sub">Subcontracting</div>
          <div className="kv"><span>Packages won</span><span className="num">{c.subsWon}</span></div>
          <div className="kv"><span>Finished</span><span className="num">{c.subsDone}</span></div>
          <div className="kv"><span>Finished late</span><span className="num">{c.lds}</span></div>
        </div>
      )}
      <div className="card">
        <div className="row"><b className="grow">Track record</b><span style={{ color: 'var(--gold)', fontSize: 20, letterSpacing: 2 }} aria-label={n + ' of 3 stars'}>{starTxt(n)}</span></div>
        <div className="tiny muted">{c.rep} points. Finished jobs earn points (council work earns 2). Walking off a job costs one.</div>
      </div>
      {bothWays(c) && (
        <div className="card">
          <b>Two ways up</b>
          <div className="small muted">You can climb on road work or on bulk work, and your standing is whichever is further along: step {rung(c as never)}, {stepsFor(routeRung(c as never, 'bulk') > routeRung(c as never, 'roads') ? 'bulk' : 'roads')[rung(c as never) - 1]?.t.toLowerCase()}. What each step unlocks counts for both.</div>
        </div>
      )}
      <Ladder c={c} route={c.path === 'bulk' ? 'bulk' : 'roads'} other={bothWays(c) ? false : undefined} />
      {bothWays(c) && <Ladder c={c} route={c.path === 'bulk' ? 'roads' : 'bulk'} other />}
      <District c={c} act={act} />
      {(c.week >= 13 || rung(c as never) >= 2) && <SeasonPicker saves={saves} />}
      <div className="card">
        <div className="sub">Site diary</div>
        <Log lines={diaryLines(c, (c.log || []).slice(0, 14))} />
      </div>
      <div className="card">
        <div className="row">
          <span className="grow"><b className="small">Sound</b><br /><span className="tiny muted">A stamp for wins and tickets, a diesel turn-over each week.</span></span>
          <button type="button" className={'btn' + (c.sound ? ' dark' : '')} aria-pressed={!!c.sound} onClick={() => act((x) => { x.sound = !x.sound; sfx('win', x.sound); })}>{c.sound ? 'On' : 'Off'}</button>
        </div>
        {!c.season && <ShopRows c={c} act={act} />}
        <div className="tiny muted"><a href={PRIVACY_URL} target="_blank" rel="noopener">Privacy policy</a></div>
      </div>
      {c.won && c.phase === 'play' && (
        <div className="card">
          <b>Sell up and retire</b>
          <div className="small muted">End the career on your terms: a buyer takes the gear, the name and your track record, and what you walk away with goes on the board as your final result.</div>
          <button type="button" className="btn full" onClick={() => setRetire(true)}>See what it's worth</button>
        </div>
      )}
      <div className="card">
        <div className="small muted">Starting again wipes save {saves.slot}. Your other saves aren't touched.</div>
        <button type="button" className="btn full" onClick={() => setWipe(true)}>Start a new career in save {saves.slot}</button>
      </div>
      {retire && <RetireSheet c={c} act={act} onClose={() => setRetire(false)} />}
      {wipe && <ResetSheet c={c} slot={saves.slot} onYes={() => { setWipe(false); onNew(); }} onNo={() => setWipe(false)} />}
    </>
  );
}
