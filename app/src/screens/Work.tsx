// Work: council tenders, subbie tenders, what's on the go, and this week's offers.

import { useState } from 'react';
import {
  BID_ODDS, LD_OWN, LD_WEEK, MOB, RETAIN, ROLES, TREAT, TYPES, bookable, carryCash, crewDayCost, freeDriver, freeMachine, leftDays, monthIdx,
  npOf, ownFlow, rainChance, rvForm, stars, subTerms, tCost, whyNot, canTakeBack, game, subPrice, otherContracts, canTender,
  type Job, type Offer, type SubTender, play,
} from '@engine';
import { KIND_CHIP, KIND_LABEL, councilTitle, jobTitle, offerCatch, offerDetail, offerPay, offerTitle, pmOf, subTenderTitle } from '@engine/text/work';
import { Mentor } from '../Mentor';
import { f, fk } from '../format';
import { AdviceRow, CouncilCard, MarginRow, PlanSheet } from './Plan';
import { DamJobCard, EnquiryCard, HoldWarning, waitingOn } from './Bulk';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;

const FORM: Record<string, string> = {
  flatOut: 'Flat out, probably won\'t price', new: 'New in town, pricing sharp', stretched: 'Short of cash, pricing anything', hungry: 'No work lately, pricing sharp',
  sharp: 'Pricing sharp lately', high: 'Pricing high lately', growing: 'Winning work, buying gear', steady: 'Steady',
};
const starTxt = (n: number) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
const who = (c: Career, id: string | null) => (id === 'you' ? 'You' : c.staff.find((p) => p.id === id)?.name ?? 'A casual');

// ---------- offers ----------

function OfferCard({ c, o, act, onMsg }: { c: Career; o: Offer; act: Act; onMsg: (s: string) => void }) {
  const why = whyNot(c as never, o), bk = why ? bookable(c as never, o) : null;
  const WHY: Record<string, string> = { busy: 'Your ' + TYPES[o.type].short + ' is busy', noMachine: 'You don\'t own a ' + TYPES[o.type].short, noDriver: 'Nobody free who can drive a ' + TYPES[o.type].short + '. Hire staff in the Yard.' };
  const ring = () => act((x) => {
    const a = play.askWait(x, o.id);
    if (!a) return;
    const whoAsk = o.kind === 'council' ? 'The council' : o.client;
    if (a.yes) onMsg(`${whoAsk} is happy to wait ${a.wait} day${a.wait > 1 ? 's' : ''}. ${offerTitle(o)} is booked in.`);
    else onMsg(`You rang about ${offerTitle(o)}. No luck: ${{ rain: 'they want it done before the rain forecast this week', roster: 'the council needs it started this week and has another operator on the list', tooLong: 'they can\'t wait ' + a.wait + ' days', someoneElse: 'they\'ve got someone who can start tomorrow' }[a.why]}. The job's gone to someone else.`);
  });
  const left = bk ? bk.days - bk.done : 0;
  return (
    <div className="card">
      <div className="row"><span className={'chip ' + KIND_CHIP[o.kind]}>{KIND_LABEL[o.kind]}</span><span className="grow" /><span className="num" style={{ fontWeight: 600 }}>{offerPay(o)}</span></div>
      <b>{offerTitle(o)}</b>
      <div className="small muted">{offerDetail(o)}</div>
      <div className="small" style={{ color: 'var(--rust)' }}>{offerCatch(o)}</div>
      {why && bk ? (
        <>
          <button type="button" className="btn ink full" onClick={ring}>Ring and ask them to wait {left} day{left === 1 ? '' : 's'}</button>
          <div className="small muted">Your {TYPES[o.type].short} has {left} day{left === 1 ? '' : 's'} left on {jobTitle(bk)}. If they'll wait, it starts the next working day after that. If they say no, the job goes to someone else. Rain coming makes people keen to get it done now.</div>
        </>
      ) : (
        <>
          {!why && (() => { const w = waitingOn(c, o.type); return w.won.length + w.priced.length ? <div className="small" style={{ color: 'var(--rust)', fontWeight: 600 }}>Ties up the {TYPES[o.type].short} your farm work needs.</div> : null; })()}
          <button type="button" className="btn ink full" disabled={!!why} onClick={() => act((x) => play.accept(x, o.id))}>Take it</button>
          {why && <div className="why">{WHY[why]}</div>}
        </>
      )}
    </div>
  );
}

// ---------- jobs on the go ----------

function Needs({ c, j }: { c: Career; j: Job }) {
  const row = (ok: boolean, t: string) => <span className="check"><span className={ok ? 'ok' : 'no'}>{ok ? '✓' : '○'}</span><span>{t}</span></span>;
  if (j.kind === 'own') {
    const boss = !c.youJob || c.staff.some((p) => (p.role === 'super' || p.role === 'ops') && !p.jobId && p.off === 0);
    return <div className="card" style={{ gap: 6, background: 'var(--bg)' }}><div className="sub">To start it needs</div>{row(boss, 'Someone to run it: you or a site supervisor')}<span className="tiny muted">Any machine of yours that isn't free is hired in, so the plant won't hold it up.</span></div>;
  }
  return (
    <div className="card" style={{ gap: 6, background: 'var(--bg)' }}>
      <div className="sub">To start it needs</div>
      {row(!!freeMachine(c as never, 'grader'), 'A grader')}
      {row(!!freeMachine(c as never, 'roller'), 'A roller')}
      {row(!!freeMachine(c as never, 'cart'), 'A water cart')}
      {row(!!freeDriver(c as never, 'grader'), 'Someone on the grader: you or a grader operator')}
      <span className="tiny muted">A second water cart is hired in if you don't have a spare. Roller and cart seats use your staff first, then casuals.</span>
    </div>
  );
}

function SubOffers({ c, j, act }: { c: Career; j: Job; act: Act }) {
  const qs = game.quotes(c, j.id), left = leftDays(j);
  return (
    <>
      <div className="sub" style={{ marginTop: 8 }}>Or sub it out until your gear is free</div>
      <div className="tiny muted">Local outfits that live off private work and dry hire. They price under you, but they're slower and the job counts for less on your track record. Take it back any week your own crew is free.</div>
      {!qs.length && <div className="small muted">Nobody local is free this week. Try again next week.</div>}
      {qs.map((q, i) => {
        const late = Math.max(0, c.week + q.wks - (j.due as number)), ldw = j.kind === 'own' ? ((j.ld as number) ?? LD_OWN) : LD_WEEK;
        const left2 = (j.price as number) - (j.claimed as number);
        const mine = j.kind === 'own' ? left2 - q.cost! : left * (j.rate - q.rate!);
        return (
          <div key={q.name} className="ycard">
            <div className="row"><b className="grow">{q.name}</b><span className="num small">{q.crews} crew{q.crews > 1 ? 's' : ''} · {Math.round(q.pace * 100)}% pace</span></div>
            <div className="small">{j.kind === 'own' ? `For ${f(q.cost!)} of the ${f(left2)} left to claim` : `At ${f(q.rate!)} a crew-day of your ${f(Math.round(j.rate))}`}. You keep about {f(mine)}. Paid 4 weeks after each claim.</div>
            <div className={'small ' + (late ? '' : 'muted')} style={late ? { color: 'var(--rust)', fontWeight: 600 } : undefined}>Done in about {q.wks} weeks{late ? `: ${late} week${late > 1 ? 's' : ''} late, about ${f(late * ldw)} in damages, and those are yours.` : ', inside the deadline.'}</div>
            <button type="button" className="btn ink" onClick={() => act((x) => play.subOut(x, j.id, i))}>Sub it to {q.name}</button>
          </div>
        );
      })}
    </>
  );
}

function JobCard({ c, j, act }: { c: Career; j: Job; act: Act }) {
  if (j.kind === 'bulk') return <DamJobCard c={c} j={j} act={act} />;
  const due = j.due as number, late = c.week > due;
  if (j.state === 'subbed') {
    const q = j.sub as { name: string; crews: number; pace: number; rate?: number }, ldw = j.kind === 'own' ? ((j.ld as number) ?? LD_OWN) : LD_WEEK;
    const prog = j.kind === 'own' ? Math.round((1 - leftDays(j) / ((j.g0 as number) + (j.s0 as number) / TREAT.resheet.per)) * 100) : Math.round((j.done / j.days) * 100);
    const can = canTakeBack(c as never, j);
    return (
      <div className="card">
        <div className="row"><span className={'chip ' + KIND_CHIP[j.kind]}>{KIND_LABEL[j.kind]}</span><span className="chip c-idle">SUBBED OUT</span><span className="grow" /><span className="tiny" style={{ color: late ? 'var(--rust)' : 'var(--muted)', fontWeight: late ? 700 : 400 }}>{late ? 'Late: ' + f((c.week - due) * ldw) + ' damages so far' : 'Due by end of week ' + due}</span></div>
        <b>{jobTitle(j)}</b>
        <div className="row tiny"><span className="grow">{prog}% done by {q.name}</span><span className="num">Claimed {f(j.earned)}</span></div>
        <div className="bar"><i style={{ width: prog + '%', background: 'var(--teal)' }} /></div>
        <div className="btns"><button type="button" className="btn" disabled={!can} onClick={() => act((x) => play.takeBack(x, j.id))}>Take it back in-house</button></div>
      </div>
    );
  }
  if (j.kind === 'own') {
    const U0 = (j.g0 as number) + (j.s0 as number) / TREAT.resheet.per, prog = Math.round((1 - (Math.max(0, j.gLeft as number) + Math.max(0, j.sLeft as number) / TREAT.resheet.per) / U0) * 100), fo = ownFlow(j);
    return (
      <div className="card">
        <div className="row"><span className={'chip ' + (j.major ? 'c-dark' : 'c-rain')}>{j.major ? 'RECOVERY PROGRAM' : 'COUNCIL CONTRACT'}</span><span className="grow" /><span className="tiny" style={{ color: late ? 'var(--rust)' : 'var(--muted)', fontWeight: late ? 700 : 400 }}>{j.major ? `Due 30 June ${j.dlYear} (week ${due})` : late ? 'Late: ' + f((c.week - due) * LD_OWN) + ' damages so far' : 'Due by end of week ' + due}</span></div>
        <b>{jobTitle(j)}</b>
        {j.state === 'waiting' ? (
          <><div className="why">Waiting for someone to run it. Not started by week {due + 3} and the council terminates it.</div><Needs c={c} j={j} /><SubOffers c={c} j={j} act={act} /></>
        ) : (
          <>
            <div className="row tiny"><span className="grow">{prog}% done · {j.prog ? 'program' : (j.gLeft as number) > 0 ? 'grading' : 'resheeting'}</span><span className="num">Claimed {f(j.earned)}</span></div>
            <div className="bar"><i style={{ width: prog + '%', background: 'var(--teal)' }} /></div>
            <div className="tiny muted">{j.crews as number} crew{(j.crews as number) > 1 ? 's' : ''}. Water {Math.round(fo.wf * 100)}% ({j.carts as number} carts, {j.waterKm as number} km). Gravel {Math.round(fo.supply)} m³ a day of {Math.round(fo.need)}. Hire-ins {f(j.hireWeek as number)} a week, {j.casuals as number} casuals. {f(j.retained as number)} in retention.</div>
          </>
        )}
      </div>
    );
  }
  if (j.kind === 'sub') {
    const pct = Math.min(100, (j.done / j.days) * 100);
    return (
      <div className="card">
        <div className="row"><span className="chip c-dark">SUBCONTRACT</span><span className="grow" /><span className="tiny" style={{ color: late ? 'var(--rust)' : 'var(--muted)', fontWeight: late ? 700 : 400 }}>{late ? 'Late: ' + f((c.week - due) * LD_WEEK) + ' damages so far' : 'Due by end of week ' + due}</span></div>
        <b>{jobTitle(j)}</b>
        {j.state === 'waiting' ? (
          <><div className="why">Waiting for your crew. Not started by week {due + 3} and {j.client} terminates it.</div><Needs c={c} j={j} /><SubOffers c={c} j={j} act={act} /></>
        ) : (
          <>
            <div className="row tiny"><span className="grow">{j.done} of {j.days} crew-days{j.days > (j.base as number) ? ` (${j.days - (j.base as number)} unpaid)` : ''}</span><span className="num">Claimed {f(j.earned)}</span></div>
            <div className="bar"><i style={{ width: pct + '%', background: 'var(--teal)' }} /></div>
            <div className="tiny muted">{who(c, j.who)} on the grader.{j.hireIn ? ' Second cart hired at ' + f(j.hireIn) + ' a week.' : ''} Crew costs {f(j.dayCost as number)} a working day. {f(j.retained as number)} held in retention.</div>
          </>
        )}
      </div>
    );
  }
  if (j.after) {
    const pj = c.jobs.find((x) => x.id === j.after);
    return (
      <div className="card">
        <div className="row"><span className={'chip ' + KIND_CHIP[j.kind]}>{KIND_LABEL[j.kind]}</span><span className="grow" /><span className="chip c-idle">BOOKED IN</span></div>
        <b>{jobTitle(j)}</b>
        <div className="small muted">Starts the day after {pj ? jobTitle(pj) : 'the current job'} finishes. {j.days} days of work.</div>
      </div>
    );
  }
  const pct = Math.min(100, (j.done / j.days) * 100), unit = j.kind === 'dry' ? 'weeks' : 'days';
  return (
    <div className="card">
      <div className="row"><span className={'chip ' + KIND_CHIP[j.kind]}>{KIND_LABEL[j.kind]}</span><span className="grow" /><span className="tiny muted">{j.kind === 'dry' ? 'Their operator' : driving(c, j)}</span></div>
      <b>{jobTitle(j)}</b>
      <div className="row tiny"><span className="grow">{j.done} of {j.days} {unit}</span><span className="num">{j.kind === 'private' ? 'Fixed ' + f((j.fixed || 0) + j.extra) : 'Earned ' + f(j.earned)}</span></div>
      <div className="bar"><i style={{ width: pct + '%', background: 'var(--teal)' }} /></div>
      {j.hireIn ? <div className="tiny muted">Hiring in a roller at {f(j.hireIn)} a week.</div> : null}
    </div>
  );
}

// ---------- subbie tenders ----------

function TenderCard({ t, onPrice }: { t: SubTender; onPrice: () => void }) {
  const q = t.q;
  return (
    <div className="card" style={t.direct ? { border: '2px solid var(--teal)' } : undefined}>
      <div className="row"><span className="chip c-dark">SUBCONTRACT</span>{t.direct && <span className="chip c-job">OFFERED DIRECT</span>}<span className="grow" /><span className="tiny muted">Closes end of week {t.close}</span></div>
      <b>{subTenderTitle(t)}</b>
      {t.direct && <div className="small" style={{ color: 'var(--teal)', fontWeight: 600 }}>{pmOf(t.hc)} wants you on it without a tender. Price it under their budget and it's yours.</div>}
      <div className="small muted">For {t.hc}. {q.hfg} km heavy, {q.mfg} km medium and {q.lfg || 0} km light formation grading, {q.resheet.toLocaleString('en-AU')} m³ of gravel resheeting with a {t.haul} km haul.</div>
      <div className="small">About {t.crewDays} crew-days. {t.weeks} weeks to finish.</div>
      {t.bid && <div className="small" style={{ color: 'var(--teal)', fontWeight: 700 }}>Your bid is in: {f(t.bid)}</div>}
      <button type="button" className={'btn ' + (t.bid ? '' : 'ink ') + 'full'} onClick={onPrice}>{t.bid ? 'Change your price' : 'Price it'}</button>
    </div>
  );
}

function PriceSheet({ c, t, act, onClose }: { c: Career; t: SubTender; act: Act; onClose: () => void }) {
  const [workings, setWorkings] = useState(false);
  const day = crewDayCost(c.fleet, c.yard), cost = tCost(t, day), SP = subPrice(t, game.overheads(c), otherContracts(c.jobs), day), price = SP.price, q = t.q;
  const rows: [string, number, string, number][] = [
    [TREAT.hfg.name, q.hfg, 'km', day / TREAT.hfg.per], [TREAT.mfg.name, q.mfg, 'km', day / TREAT.mfg.per], [TREAT.lfg.name, q.lfg || 0, 'km', day / TREAT.lfg.per],
    [TREAT.resheet.name, q.resheet, 'm³', day / TREAT.resheet.per + t.cart], ['Mobilisation, float in and out', 1, 'item', 2 * MOB],
  ];
  const wetDays = Math.round(rainChance(c.town, monthIdx(c.week)) * 5 * t.weeks), terms = subTerms(c.rel, t.hc), carry = carryCash(t, c.rel);
  const np = npOf('sub', null, t.hc, game.standing(c), () => 0), capped = game.capFull(c) && !t.bid;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={'Price ' + subTenderTitle(t)}>
      <div className="sheet">
        <div className="sub">Price a package · closes end of week {t.close}</div>
        <h2>{subTenderTitle(t)}</h2>
        <div className="small muted">For {t.hc}. Progress claims paid in {terms} weeks, {RETAIN * 100}% held as retention until the end. {t.weeks} weeks allowed, then {f(LD_WEEK)} a week in damages.</div>
        <Mentor c={c} k="overheads" act={act} />
        {t.direct && <div className="card" style={{ border: '2px solid var(--teal)' }}><b>Offered direct by {pmOf(t.hc)}</b><div className="small">No other bidders. They have about {fk(t.budget!)} for it: price at or under that and it's yours.</div></div>}
        <div className="card" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
          <div className="kv"><span>Cash to carry it</span><span className="num">{f(carry)}</span></div>
          <div className="tiny" style={{ color: 'var(--on-warn)' }}>Fuel, casuals and gravel trucks get paid every week; the first claim lands about {terms} weeks in. You have {f(c.bank)}.</div>
        </div>
        <div className="card">
          {workings && (
            <>
              {rows.map((x) => { const rate = x[3] * (1 + t.mk) * (1 + SP.oh / Math.max(1, cost)); return (
                <div key={x[0]} className="row small"><span className="grow">{x[0]}</span><span className="num" style={{ width: 72, textAlign: 'right' }}>{x[1].toLocaleString('en-AU')} {x[2]}</span><span className="num" style={{ width: 64, textAlign: 'right' }}>${rate < 100 ? rate.toFixed(2) : Math.round(rate).toLocaleString('en-AU')}</span><span className="num" style={{ width: 64, textAlign: 'right' }}>{fk(rate * x[1])}</span></div>
              ); })}
              <div className="tiny muted">A crew-day costs you {f(day)}: fuel, casuals on the roller ({f(ROLES.roller.casual)}) and two carts ({f(ROLES.cart.casual)} each), and wear. Gravel cartage on a {t.haul} km haul is ${t.cart.toFixed(2)}/m³.</div>
            </>
          )}
          <div className="kv"><span>Direct cost of the job</span><span className="num">{f(cost)}</span></div>
          <div className="row" style={{ padding: '6px 0', flexWrap: 'nowrap' }}>
            <span className="grow"><span className="small">Company overheads</span><span className="tiny muted" style={{ display: 'block' }}>{f(SP.wk)} a week × {SP.wks} week{SP.wks !== 1 ? 's' : ''} × {Math.round(SP.sh * 100)}%{t.oh == null ? ' (suggested)' : ''}</span></span>
            <button type="button" className="btn" disabled={!(SP.sh > 0)} onClick={() => act((x) => play.setOverheadShare(x, t.id, -0.25))}>−</button>
            <b className="num" style={{ minWidth: 64, textAlign: 'right' }}>{f(SP.oh)}</b>
            <button type="button" className="btn" disabled={!(SP.sh < 1)} onClick={() => act((x) => play.setOverheadShare(x, t.id, 0.25))}>+</button>
          </div>
          <div className="kv"><span>Cost all up</span><span className="num">{f(cost + SP.oh)}</span></div>
          <MarginRow mk={t.mk} id={t.id} act={act} />
          <div className="kv"><b>Your price</b><b className="num" style={{ fontSize: 18 }}>{f(price)}</b></div>
          {!t.direct && <AdviceRow c={c} t={t} kind="sub" act={act} />}
          <div className="tiny muted">Profit if it all goes to plan, after overheads: {f(price - cost - SP.oh)}. Expect about {wetDays} wet days in {t.weeks} weeks, and your crew sits idle on each one.</div>
          <button type="button" className="btn full" onClick={() => setWorkings(!workings)}>{workings ? 'Hide the workings' : 'Show the workings'}</button>
        </div>
        <div className="card">
          <div className="sub">Who else is pricing it</div>
          {c.rivals.filter((x) => BID_ODDS.sub[x.tier] >= 0.5).map((x) => (
            <div key={x.name} className="kv"><span>{x.name} <span className="tiny muted">{FORM[rvForm(x, false)]}</span></span><span style={{ color: 'var(--gold)', letterSpacing: 1 }}>{starTxt(x.stars)}</span></div>
          ))}
        </div>
        <div className="card">
          <div className="sub">How they'll score you</div>
          <div className="kv"><span>Price</span><span className="num">out of 60</span></div>
          <div className="kv"><span>Track record <span className="tiny muted">{starTxt(stars(c.rep))}</span></span><span className="num">{np.rec}</span></div>
          <div className="kv"><span>Safety</span><span className="num">{np.saf > 0 ? '+' : ''}{np.saf}</span></div>
          <div className="kv"><span>Finances</span><span className="num">{np.fin ? np.fin + ' · behind with the bank' : 'Sound'}</span></div>
          <div className="kv"><span>Work already on</span><span className="num">{np.load ? String(np.load) : 'Free to start'}</span></div>
          <div className="kv"><span>Standing with {t.hc}</span><span className="num">{np.rel > 0 ? '+' : ''}{np.rel}</span></div>
          <div className="kv"><b>Non-price</b><b className="num">{Math.max(0, np.tot)} of 40</b></div>
        </div>
        {capped && <div className="why">You're running two contracts, as many as you can keep on top of yourself. Hire an operations manager to take on more.</div>}
        <button type="button" className="big" disabled={capped} onClick={() => act((x) => play.submitBid(x, t.id))}>{t.bid ? 'Resubmit at ' : 'Submit at '}{f(price)}</button>
        {t.bid && <button type="button" className="btn full" onClick={() => act((x) => play.withdrawBid(x, t.id))}>Withdraw your bid</button>}
        <button type="button" className="btn full" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ---------- the tab ----------

/** Who's on the machine: "Shaz driving", "You, covering for Shaz", or "Shaz off, nobody driving". */
function driving(c: Career, j: Job): string {
  const p = j.who && j.who !== 'you' ? c.staff.find((x) => x.id === j.who) : null;
  if (p && p.off > 0) return c.opCover > 0 && c.coverFor === p.id ? 'You, covering for ' + p.name : p.name + ' off, nobody driving';
  return who(c, j.who) + ' driving';
}

export function WorkTab({ c, act }: { c: Career; act: Act }) {
  const [pricing, setPricing] = useState<string | null>(null);
  const [planning, setPlanning] = useState<string | null>(null);
  const ct = planning ? c.ctenders.find((t) => t.id === planning) : undefined;
  const [msg, setMsg] = useState<string | null>(null);
  const pt = pricing ? c.tenders.find((t) => t.id === pricing) : undefined;
  const can = canTender((t) => game.owns(c, t), c.rep, c.whs.sys);
  const [showAll, setShowAll] = useState(false);
  const shut = (o: Offer) => !!whyNot(c as never, o) && !bookable(c as never, o);
  const offersNow = c.offers.filter((o) => !shut(o)).sort((a, b) => Number(!!whyNot(c as never, a)) - Number(!!whyNot(c as never, b)));
  const offersNot = c.offers.filter(shut);
  // farmers and developers ringing (the Bulk and Ag pack)
  const bulkRinging = c.packs?.bulk ? (
        <>
          <div className="sub">Bulk and Ag: who's ringing</div>
          {(c.bulk?.enq ?? []).length ? c.bulk!.enq.map((e) => <EnquiryCard key={e.id} c={c} e={e} act={act} />)
            : <div className="card"><div className="small muted">Nobody's rung this week. Farmers and developers ring most weeks.</div></div>}
        </>
  ) : null;
  return (
    <>
      {msg && <div className="card" style={{ borderColor: 'var(--teal)', borderWidth: 2 }}><div className="small">{msg}</div><div className="btns"><button type="button" className="btn" onClick={() => setMsg(null)}>OK</button></div></div>}
      {c.won2 && (
        <>
          <div className="sub">Council tenders</div>
          {c.ctenders.length ? c.ctenders.map((t) => (
            <CouncilCard key={t.id} t={t} onPlan={() => act((x) => { play.openProgram(x, t.id); setPlanning(t.id); })} />
          )) : <div className="card"><div className="small muted">No council packages out right now. They come out most months.</div></div>}
        </>
      )}
      {(can || c.tenders.length > 0 || c.subsWon > 0) && (
        <>
          <div className="sub">Tenders</div>
          {c.tenders.length ? c.tenders.map((t) => <TenderCard key={t.id} t={t} onPrice={() => setPricing(t.id)} />)
            : <div className="card"><div className="small muted">{can ? 'No packages out to price this week. Head contractors send them out most weeks.' : 'You need a grader, roller, water cart and 1 star to be asked to price.'}</div></div>}
        </>
      )}
      <div className="sub">On the go</div>
      {!c.jobs.length && <div className="card"><b>Nothing on.</b><div className="small muted">Idle machines still cost you repayments. Take some work below.</div></div>}
      {c.jobs.map((j) => <JobCard key={j.id} c={c} j={j} act={act} />)}
      {c.path === 'bulk' && bulkRinging}
      <div className="sub">Work on offer this week</div>
      {!c.offers.length && <div className="card"><div className="small muted">Nothing else this week. New work comes up every Monday.</div></div>}
      {c.packs?.bulk && <HoldWarning c={c} types={offersNow.filter((o) => !whyNot(c as never, o)).map((o) => o.type)} />}
      {/* the work you can take (or ring about) first; the rest fold away under one line */}
      {offersNow.map((o) => <OfferCard key={o.id} c={c} o={o} act={act} onMsg={setMsg} />)}
      {offersNot.length > 0 && (
        <button type="button" className="btn full" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Hide' : 'Show'} {offersNot.length} {offersNow.length ? 'more ' : ''}job{offersNot.length === 1 ? '' : 's'} you can't take now · {[...new Set(offersNot.map((o) => TYPES[o.type].short))].join(', ')}
        </button>
      )}
      {showAll && offersNot.map((o) => <OfferCard key={o.id} c={c} o={o} act={act} onMsg={setMsg} />)}
      {c.path !== 'bulk' && bulkRinging}
      {pt && <PriceSheet c={c} t={pt} act={act} onClose={() => setPricing(null)} />}
      {ct && <PlanSheet c={c} t={ct} act={act} onClose={() => setPlanning(null)} />}
    </>
  );
}
