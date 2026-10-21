// Seasons on screen: the list to pick one from, the card at the top of the Career tab while you play one, and the
// screen when it's over. A season is about a year of real weather, the same for everyone, scored on net worth gained.

import { useEffect, useState } from 'react';
import { SEASONS, TOWNS, seasonDef, seasonScore, game, type SeasonId, type SeasonState } from '@engine';
import { BOARD_URL, blocked, getBoard, postScore, reportName, savedName, type Board } from './board';
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
      <PostScore c={c} />
      <button type="button" className="big" onClick={() => saves.startSeason(S.id as SeasonId)}>Play it again</button>
      <button type="button" className="btn full" onClick={saves.leaveSeason}>{hasCareer ? 'Back to my career' : 'Start a career'}</button>
    </div>
  );
}

/** Post the season to the public board under a nickname, then show the board and where you came. */
function PostScore({ c }: { c: game.Career }) {
  const S = c.season as SeasonState;
  const [name, setName] = useState(savedName());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [posted, setPosted] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [hide, setHide] = useState<number[]>(blocked);
  const [asking, setAsking] = useState<number | null>(null);
  useEffect(() => {
    if (BOARD_URL) getBoard(S.id).then(setBoard).catch(() => {});
  }, [S.id]);
  if (!BOARD_URL) return <div className="small note">The public board isn't up yet. When it is, you'll be able to post seasons like this one.</div>;
  const send = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await postScore(c, name);
      setPosted(true);
      setMsg(r.me ? `On the board at #${r.me.rank}. The board played your season again and got ${signed(r.score)}.` : 'Posted.');
      setBoard(await getBoard(S.id));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {!posted && (
        <div className="card">
          <b>Put it on the board</b>
          <div className="small muted">Every score is played again from its moves before it counts, so the board is the same game for everyone.</div>
          <label className="small" htmlFor="nick">Your name on the board</label>
          <input id="nick" className="field" maxLength={20} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="2 to 20 letters" />
          <button type="button" className="btn dark full" disabled={busy || name.trim().length < 2} onClick={send}>{busy ? 'Checking your season…' : 'Post my score'}</button>
        </div>
      )}
      {msg && <div className="card" style={{ border: '2px solid var(--ink)' }}><div className="small">{msg}</div></div>}
      {board && (
        <div className="card">
          <div className="sub">The board · {SEASON_TEXT[S.id].n}</div>
          {!board.rows.length && <div className="small muted">Nobody's on the board for this season yet.</div>}
          {board.rows.map((r, i) => {
            const mine = board.me?.id === r.id;
            if (!mine && hide.includes(r.id)) return null;
            return (
              <div key={r.id}>
                <div className={'lb' + (i === 0 ? ' first' : '')} style={mine ? { fontWeight: 700 } : undefined}>
                  <span className="rank">{i + 1}</span>
                  <div className="who"><b>{r.name}</b><span className="tiny muted">{r.co} · {r.week} weeks</span></div>
                  <b className="num">{signed(r.score)}</b>
                  {!mine && <button type="button" className="lb-flag" aria-label={'Report ' + r.name} onClick={() => setAsking(asking === r.id ? null : r.id)}>⚑</button>}
                </div>
                {asking === r.id && (
                  <div className="row small" style={{ gap: 8, padding: '4px 0 8px 38px' }}>
                    <span className="grow">Report this name as offensive? It's hidden for you straight away.</span>
                    <button type="button" className="btn" onClick={() => { void reportName(r.id); setHide(blocked()); setAsking(null); }}>Report</button>
                    <button type="button" className="btn" onClick={() => setAsking(null)}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
          {board.rows.length > 0 && <div className="tiny muted">Tap ⚑ to report a name.</div>}
          {board.me && board.me.rank > board.rows.length && <div className="small">You: #{board.me.rank}, {signed(board.me.score)}</div>}
        </div>
      )}
    </>
  );
}
