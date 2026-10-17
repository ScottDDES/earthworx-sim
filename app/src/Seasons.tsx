// Seasons on screen: the list to pick one from, the card at the top of the Career tab while you play one, and the
// screen when it's over. A season is about a year of real weather, the same for everyone, scored on net worth gained.

import { SEASONS, TOWNS, seasonDef, seasonScore, game, type SeasonId, type SeasonState } from '@engine';
import { SEASON_TEXT } from '@engine/text/seasons';
import { MachineIcon } from './Icon';
import { seasonSaved } from './store';
import { f } from './format';
import type { Saves } from './Slots';

const signed = (n: number) => (n >= 0 ? '+' : '−') + f(Math.abs(n));

export function SeasonPicker({ saves }: { saves: Saves }) {
  const cont = seasonSaved();
  return (
    <div className="card">
      <b>Seasons</b>
      <div className="small muted">A short game: about a year of real weather, the same for everyone, scored on net worth gained. Separate from your career, which stays as it is.</div>
      {cont && <button type="button" className="btn dark full" onClick={saves.continueSeason}>Continue {SEASON_TEXT[(cont.season as SeasonState).id].n} · week {cont.week}</button>}
      {SEASONS.map((D) => (
        <div key={D.id} className="ycard">
          <div className="row"><b className="grow">{SEASON_TEXT[D.id].n}</b><span className="chip c-rain">{TOWNS[D.town].name.toUpperCase()} · {D.year}</span></div>
          <div className="small muted">{SEASON_TEXT[D.id].d}</div>
          <button type="button" className="btn full" onClick={() => saves.startSeason(D.id)}>Play {SEASON_TEXT[D.id].n}</button>
        </div>
      ))}
    </div>
  );
}

/** At the top of the Career tab during a season. */
export function SeasonCard({ c, saves, hasCareer }: { c: game.Career; saves: Saves; hasCareer: boolean }) {
  const S = c.season as SeasonState, T = SEASON_TEXT[S.id], sc = seasonScore(c);
  return (
    <div className="card" style={{ border: '2px solid var(--hi)' }}>
      <div className="row"><b className="grow" style={{ fontSize: 18 }}>{T.n}</b><span className="chip c-rain">WEEK {Math.min(c.week, S.weeks)} OF {S.weeks}</span></div>
      <div className="small muted">{T.d}</div>
      <div className="bar"><i style={{ width: Math.min(100, ((c.week - 1) / S.weeks) * 100) + '%', background: 'var(--hi)' }} /></div>
      <div className="kv"><b>Net worth gained so far</b><b className="num" style={{ color: sc >= 0 ? 'var(--teal)' : 'var(--rust)' }}>{signed(sc)}</b></div>
      <div className="btns">
        <button type="button" className="btn" onClick={saves.leaveSeason}>{hasCareer ? 'Back to my career' : 'Leave the season'}</button>
        <button type="button" className="btn" onClick={() => saves.startSeason(S.id)}>Restart it</button>
      </div>
      <div className="tiny muted">The season is saved on this device. Your career isn't touched.</div>
    </div>
  );
}

export function SeasonEndScreen({ c, saves, hasCareer }: { c: game.Career; saves: Saves; hasCareer: boolean }) {
  const S = c.season as SeasonState, D = seasonDef(S.id)!, sc = S.score ?? 0;
  return (
    <div className="wrap setup">
      <div className="hero">
        <div className="row"><span className="tiny grow" style={{ color: 'var(--head-muted)' }}>Season over · {SEASON_TEXT[S.id].n}</span><span style={{ color: '#FFC700' }}><MachineIcon type="grader" /></span></div>
        <h1>{signed(sc)}</h1>
        <p>Net worth gained by {c.co} in {S.done} weeks of real {TOWNS[D.town].name} weather, {D.year} to {D.year + 1}.</p>
      </div>
      <div className="card">
        <div className="kv"><span>Machines at the end</span><span className="num">{c.fleet.length}</span></div>
        <div className="kv"><span>Paid in over the season</span><span className="num">{f(c.stats.earned)}</span></div>
        <div className="kv"><span>Tickets earned</span><span className="num">{Object.keys(c.tix || {}).length}</span></div>
      </div>
      <div className="small note">Scores will go on the public board once it's running: every one is played again from its moves before it counts.</div>
      <button type="button" className="big" onClick={() => saves.startSeason(S.id as SeasonId)}>Play it again</button>
      <button type="button" className="btn full" onClick={saves.leaveSeason}>{hasCareer ? 'Back to my career' : 'Start a career'}</button>
    </div>
  );
}
