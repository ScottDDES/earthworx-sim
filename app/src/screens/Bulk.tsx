// The Bulk and Ag pack on the Work tab: clients ringing about work, the jobs on the go, and the attachments.

import {
  ATTACH, BULK_CASUAL, laserFree, laserOwned, FIRE_MONTHS, KINDS, SURVEY_COST, TYPES, WAIT_WEEKS, damVolume, freeFor, isDam, jobEstimate, monthIdx, pricingVol, quotePrice,
  rateStep, wallQuality, meetsStd, game, type PlantStd, type Attachment, type BulkKind, type FarmEnquiry, type Job,
} from '@engine';
import { ATTACH_NAME, ATTACH_NOTE, DAM_KIND, SLOWEST, UNIT, damTitle, enquiryLine, needs, qty, surveyFind, surveyLabel, surveyRisk, wallWord } from '@engine/text/bulk';
import { jobTitle } from '@engine/text/work';
import { f } from '../format';

type Career = game.Career;
type Act = (fn: (c: Career) => unknown) => void;
const n0 = (n: number) => Math.round(n).toLocaleString('en-AU');
const money = (n: number) => (Number.isInteger(n) ? f(n) : '$' + n.toFixed(2));

/** A developer's plant standard, and which of your machines for the job fall short of it. */
function StdLine({ c, kind, std }: { c: Career; kind: BulkKind; std: PlantStd }) {
  const short = couldUse(c, kind).filter((m) => !meetsStd(m, std, c.week));
  return (
    <>
      <div className="tiny"><b>The developer's standard:</b> every machine on site {std.age} years old or newer and under {n0(std.hrs)} hours.</div>
      {short.length > 0 && <div className="tiny" style={{ color: 'var(--rust)' }}>Falls short: {short.map((m) => TYPES[m.type].short + ' (' + m.year + ', ' + n0(m.hours) + ' hrs)').join(', ')}. Late-model gear is in the Market, and new under New.</div>}
    </>
  );
}

/** Your machines a bulk job of this kind could use if they were free. */
function couldUse(c: Career, kind: BulkKind): Career["fleet"] {
  const asIf = c.fleet.map((m) => (m.status === 'auction' ? m : { ...m, status: 'idle' as const, down: 0 }));
  const ids = new Set(freeFor({ fleet: asIf } as never, kind).map((m) => m.id));
  return c.fleet.filter((m) => ids.has(m.id));
}

/** Bulk work that wants a machine of this type, if you hire your last free one out: jobs won and waiting, and prices sent. */
export function waitingOn(c: Career, type: string): { won: string[]; priced: string[] } {
  if (c.fleet.filter((m) => m.type === type && m.status === 'idle' && m.down === 0).length > 1) return { won: [], priced: [] };
  const uses = (k: unknown) => couldUse(c, k as BulkKind).some((m) => m.type === type);
  return {
    won: c.jobs.filter((j) => j.kind === 'bulk' && j.state === 'waiting' && uses(j.dk)).map((j) => j.client + "'s " + DAM_KIND[j.dk as BulkKind].toLowerCase()),
    priced: (c.bulk?.enq ?? []).filter((e) => e.quoted && uses(e.kind)).map((e) => e.farm + "'s " + DAM_KIND[e.kind].toLowerCase()),
  };
}

const and = (xs: string[]) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0]);

/** Above the offers: which bulk work a hire would keep waiting, once per machine type. */
export function HoldWarning({ c, types }: { c: Career; types: string[] }) {
  const lines = [...new Set(types)].flatMap((t) => {
    const w = waitingOn(c, t), m = TYPES[t as keyof typeof TYPES].short;
    if (!w.won.length && !w.priced.length) return [];
    const won = w.won.length ? and(w.won) + (w.won.length > 1 ? ' are' : ' is') + ' won and waiting for your ' + m + '. ' : '';
    const priced = !w.priced.length ? '' : w.won.length ? 'So might ' + and(w.priced) + '. '
      : "You've priced " + and(w.priced) + ', and ' + (w.priced.length > 1 ? 'they need' : 'it needs') + ' your ' + m + ' if the answer is yes. ';
    return [won + priced + 'Hire it out and the farm work waits.'];
  });
  if (!lines.length) return null;
  return <div className="card" style={{ border: '2px solid var(--rust)' }}>{lines.map((t) => <div key={t} className="small">{t}</div>)}</div>;
}

/** What the machines a waiting job could use are doing instead. */
function heldUp(c: Career, j: Job): string[] {
  return couldUse(c, j.dk as BulkKind).filter((m) => m.status !== 'idle' || m.down > 0).map((m) => {
    const on = m.jobId ? c.jobs.find((x) => x.id === m.jobId) : undefined;
    const where = !on ? ' is busy' : on.kind === 'dry' ? ' is out on dry hire to ' + on.client : on.kind === 'wet' ? ' is out on wet hire to ' + on.client : ' is on ' + jobTitle(on);
    return 'Your ' + TYPES[m.type].short + (m.down > 0 ? ' is broken down' : where) + '.';
  });
}

/** A client's enquiry: the quantity, the survey, what your spread would take, and your price. */
export function EnquiryCard({ c, e, act }: { c: Career; e: FarmEnquiry; act: Act }) {
  const K = KINDS[e.kind], u = K.unit, vol = pricingVol(e), spread = freeFor(c, e.kind), est = jobEstimate(c as never, spread, e, vol), price = quotePrice(e);
  const att = K.att && !c.bulk?.att?.[K.att] ? K.att : null;
  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="chip c-job">{e.kind === 'dev' ? 'DEVELOPER' : 'FARM'}</span><span className="chip c-idle">{DAM_KIND[e.kind].toUpperCase()}</span>
        {e.tested && <span className="chip c-rain">TESTED</span>}<span className="grow" /><span className="tiny muted">{e.quoted ? 'Price sent' : 'Rang week ' + e.week}</span>
      </div>
      <b>{damTitle(e)}</b>
      <div className="small muted">{enquiryLine(e)}</div>
      {isDam(e.kind) && e.dam && <div className="kv"><span>The dam sum (floor {n0(damVolume(e.dam).floorLength)} × {n0(damVolume(e.dam).floorWidth)} m)</span><span className="num">{qty(e.vol, u)}</span></div>}
      {!isDam(e.kind) && <div className="kv"><span>On the plans</span><span className="num">{qty(e.vol, u)}</span></div>}
      {K.survey && (e.surveyed
        ? <div className="kv"><span>{e.kind === 'channel' ? 'The geotech' : 'The surveyor'}</span><b className="num">{surveyFind(e)}</b></div>
        : !e.quoted && <button type="button" className="btn full" disabled={c.bank < SURVEY_COST} onClick={() => act((x) => game.damSurvey(x, e.id))}>{surveyLabel(e)} · {f(SURVEY_COST)}</button>)}
      {K.survey && !e.surveyed && <div className="tiny muted">{surveyRisk(e)}</div>}
      {e.tested && isDam(e.kind) && <div className="tiny">An engineer's spec: the wall gets compaction tests at the end, and pays about 15% more. Fail and you rework it at your cost. Roll it, water it, and think about preconditioning the pit.</div>}
      {e.kind === 'rake' && <div className="tiny">Windrows can't be burnt in fire season (August and September). Finish then and you wait for your money.</div>}
      {att && <div className="tiny" style={{ color: 'var(--rust)' }}>Needs the {ATTACH_NAME[att]} ({f(ATTACH[att])} in the Market).</div>}
      {e.std && <StdLine c={c} kind={e.kind} std={e.std} />}
      {e.kind === 'laser' && !att && laserFree(c as never) <= 0 && <div className="tiny" style={{ color: 'var(--rust)' }}>Your Laser Gear is on another job. Win this and it waits for it, or buy another in the Market.</div>}
      {e.kind === 'laser' && !c.fleet.some((m) => m.laser && TYPES[m.type] && ['pull', 's623', 's627', 's631', 's637', 's651', 's657'].includes(m.type)) && <div className="tiny" style={{ color: 'var(--rust)' }}>Needs Laser Buckets or scrapers fitted with laser control (in the Yard).</div>}
      <div className="tiny" style={{ background: 'var(--soft)', borderRadius: 10, padding: '10px 12px' }}>
        {est.perDay > 0
          ? <>With what's free in your yard: about <b>{est.days} working day{est.days === 1 ? '' : 's'}</b> at {qty(Math.round(est.perDay * 10) / 10, u)} a day, held up by {SLOWEST[est.slowest] ?? est.slowest}. The spread costs about {f(est.dayCost)} a day in fuel, servicing{est.casuals ? ' and ' + est.casuals + ' labour-hire operator' + (est.casuals > 1 ? 's' : '') + ' at ' + f(BULK_CASUAL) : ''}: {f(est.cost)} all up.</>
          : <>Nothing free in your yard can do it yet. {needs(e.kind)}</>}
      </div>
      {e.quoted ? (
        <div className="small"><b>Price sent: {f(e.quoted)}.</b> {e.farm} will ring back next week.</div>
      ) : (
        <>
          <div className="small" style={{ paddingTop: 6 }}>Your rate</div>
          <div className="row" style={{ paddingBottom: 6 }}>
            <button type="button" className="btn" onClick={() => act((x) => game.damRate(x, e.id, -1))}>−{money(rateStep(e))}</button>
            <b className="num grow" style={{ textAlign: 'center' }}>{money(e.rate)} {UNIT[u].per}</b>
            <button type="button" className="btn" onClick={() => act((x) => game.damRate(x, e.id, 1))}>+{money(rateStep(e))}</button>
          </div>
          <div className="kv"><b>Your price</b><b className="num" style={{ fontSize: 18 }}>{f(price)}</b></div>
          {est.perDay > 0 && <div className="tiny muted">After the spread's running costs: {f(price - est.cost)}. Wages, repayments and the yard come out of that.</div>}
          {est.perDay <= 0 && <div className="tiny" style={{ color: 'var(--rust)' }}>Win it and you've {WAIT_WEEKS} weeks to get the gear before {e.farm} gets someone else, and they'll tell people.</div>}
          <button type="button" className="btn dark full" onClick={() => act((x) => game.damQuote(x, e.id))}>{est.perDay > 0 ? 'Send the price' : 'Send the price anyway'}</button>
        </>
      )}
    </div>
  );
}

/** A bulk job on the go: work done, the spread and who's driving, and what's holding it up. */
export function DamJobCard({ c, j, act }: { c: Career; j: Job; act: Act }) {
  const kind = j.dk as BulkKind, u = KINDS[kind].unit;
  const ms = c.fleet.filter((m) => m.jobId === j.id), crew = (j.crew || {}) as Record<string, string>;
  const est = j.est as number, done = Math.min(j.m3 as number, j.truth as number), pct = Math.min(100, Math.round((done / est) * 100));
  const who = (id: string) => (id === 'you' ? 'You' : id === 'casual' ? 'labour hire' : c.staff.find((p) => p.id === id)?.name ?? '?');
  const left = WAIT_WEEKS - (c.week - (j.won as number));
  return (
    <div className="card">
      <div className="row"><span className="chip c-job">{DAM_KIND[kind].toUpperCase()}</span>{j.tested ? <span className="chip c-rain">TESTED</span> : null}<span className="grow" /><span className="tiny muted">{kind === 'dev' ? 'Contract ' : 'Fixed '}{f(j.fixed as number)}</span></div>
      <b>{damTitle(j as never)}</b>
      {j.state === 'waiting' ? (
        <>
          <div className="small muted">Waiting to start. {needs(kind)} {left} week{left === 1 ? '' : 's'} before {j.client} gets someone else.</div>
          {heldUp(c, j).map((t) => <div key={t} className="small" style={{ color: 'var(--rust)' }}>{t}</div>)}
          {j.std ? <StdLine c={c} kind={kind} std={j.std as PlantStd} /> : null}
        </>
      ) : j.state === 'burn' ? (
        <div className="small muted">Raked and windrowed. It's fire season, so the windrows wait to be burnt{FIRE_MONTHS.includes(monthIdx(c.week)) ? ' until October' : ''}, and so does the money.</div>
      ) : (
        <>
          <div className="row tiny"><span className="grow">{qty(Math.round(done * 10) / 10, u)} done of about {qty(Math.round(est * 10) / 10, u)} priced</span><span className="num">{pct}%</span></div>
          <div className="bar"><i style={{ width: pct + '%', background: 'var(--teal)' }} /></div>
          {(j.m3 as number) > est && <div className="tiny" style={{ color: 'var(--rust)' }}>Past what you priced: there's more in it than you allowed for, and the price is fixed.</div>}
          {kind === 'dev' && <div className="tiny muted">Claimed {f((j.claimed as number) || 0)}, {f((j.retained as number) || 0)} held in retention. Due by the end of week {j.due as number}{c.week > (j.due as number) ? ': late, damages are running' : ''}.</div>}
          <div className="tiny muted">{ms.map((m) => TYPES[m.type].short + (m.down > 0 ? ' (broken down)' : '') + ': ' + who(crew[m.id] ?? 'casual')).join(' · ')}</div>
          {kind !== 'channel' && kind !== 'rake' && kind !== 'cutter' && <div className="tiny">The work so far: <b>{wallWord(wallQuality(j))}</b>{j.tested ? ' (tested at the end)' : ''}.</div>}
          {!!j.tested && isDam(kind) && (
            <div className="row" style={{ paddingTop: 4 }}>
              <span className="grow"><b className="small">Precondition the pit</b><br /><span className="tiny muted">A dozer and a moxy water cart wet the dirt before it's picked up. Slower spread, much better wall.</span></span>
              <button type="button" className={'btn' + (j.precon ? ' dark' : '')} aria-pressed={!!j.precon} onClick={() => act((x) => game.damPrecon(x, j.id, !j.precon))}>{j.precon ? 'On' : 'Off'}</button>
            </div>
          )}
          {j.slowest ? <div className="tiny muted">Held up by {SLOWEST[j.slowest as string] ?? (j.slowest as string)}. Spent so far {f(j.spent || 0)}.</div> : null}
        </>
      )}
    </div>
  );
}

/** The Bulk and Ag attachments, in the Market. */
export function Attachments({ c, act }: { c: Career; act: Act }) {
  const own = c.bulk?.att ?? {};
  return (
    <div className="card">
      <div className="sub">Attachments</div>
      {(Object.keys(ATTACH) as Attachment[]).map((a) => (
        <div key={a} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
          <span className="grow"><b className="small">{ATTACH_NAME[a]}</b><br /><span className="tiny muted">{ATTACH_NOTE[a]}</span></span>
          {a === 'laser' && own[a] ? (
            // more than one Laser Gear: one a job, as many laser machines on it as you like
            <span style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
              <span className="chip c-job">OWN {laserOwned(c as never)} · {laserFree(c as never)} FREE</span>
              <button type="button" className="btn" disabled={c.bank < ATTACH[a]} onClick={() => act((x) => game.buyAttach(x, a))}>Buy another · {f(ATTACH[a])}</button>
            </span>
          ) : own[a] ? <span className="chip c-job">OWNED</span>
            : <button type="button" className="btn" disabled={c.bank < ATTACH[a]} onClick={() => act((x) => game.buyAttach(x, a))}>Buy · {f(ATTACH[a])}</button>}
        </div>
      ))}
    </div>
  );
}
