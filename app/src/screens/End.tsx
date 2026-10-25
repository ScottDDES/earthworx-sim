// The end of a career: sold up, retired, handed on to the next generation, or gone into administration on
// Hardcore. A handed-on business can carry on as the next generation.

import { TICKETS, game } from '@engine';
import { stepsFor } from '@engine/text/career';
import { MachineIcon } from '../Icon';
import { f } from '../format';

const DIFF = (loan: number) => (!loan ? '—' : loan <= 100000 ? 'Hard' : loan >= 300000 ? 'Easy' : 'Normal');
const stage = (n: number, path?: string) => stepsFor(path)[Math.max(1, n || 1) - 1]?.t ?? '';

type Sold = { to: string; week: number; price: number; walk: number; fleet: number; earned: number; stage: number; peak?: number; retired?: boolean; legacy?: boolean };
type Bust = { week: number; nw: number; fleet: number; earned: number; tix: number; stage: number; peak?: number };

export function EndScreen({ c, onNew, onNextGen }: { c: game.Career; onNew: () => void; onNextGen: () => void }) {
  if (c.phase === 'bust') {
    const u = c.bustOut as Bust;
    return (
      <div className="wrap setup">
        <div className="hero">
          <div className="row"><span className="tiny grow" style={{ color: 'var(--head-muted)' }}>Hardcore · career over</span><span style={{ color: '#FFC700' }}><MachineIcon type="grader" mono /></span></div>
          <h1>{c.co} is in administration</h1>
          <p>Four weeks under water. In week {u.week} the administrators changed the locks on the yard. The gear goes to auction to pay the bank.</p>
        </div>
        <div className="card">
          <div className="kv"><span>Difficulty</span><span>{DIFF(c.loanStart)}, hardcore</span></div>
          <div className="kv"><span>Weeks you lasted</span><span className="num">{u.week}</span></div>
          <div className="kv"><span>Furthest stage</span><span>{stage(u.peak || u.stage, c.path)}</span></div>
          <div className="kv"><span>Machines lost</span><span className="num">{u.fleet}</span></div>
          <div className="kv"><span>Earned over the career</span><span className="num">{f(u.earned)}</span></div>
          <div className="kv"><span>Tickets</span><span className="num">{u.tix} of {TICKETS.length}</span></div>
          <div className="kv"><span>Owed at the end</span><span className="num" style={{ color: 'var(--rust)' }}>{f(-u.nw)}</span></div>
        </div>
        <button type="button" className="big" onClick={onNew}>Start a new career</button>
      </div>
    );
  }
  const u = c.soldUp as Sold;
  return (
    <div className="wrap setup">
      <div className="hero">
        <div className="row"><span className="tiny grow" style={{ color: 'var(--head-muted)' }}>Career over</span><span style={{ color: '#FFC700' }}><MachineIcon type="grader" mono /></span></div>
        <h1>{c.co}{u.legacy ? ' goes to the next generation' : u.retired ? " is sold. You've retired." : ' is sold'}</h1>
        <p>{u.to.charAt(0).toUpperCase() + u.to.slice(1)} took over in week {u.week}. {u.walk >= 0 ? 'You walked away with ' + f(u.walk) + '.' : 'Even after the sale you still owe the bank ' + f(-u.walk) + '.'}</p>
      </div>
      <div className="card">
        <div className="kv"><span>Difficulty</span><span>{DIFF(c.loanStart)}</span></div>
        <div className="kv"><span>Weeks in business</span><span className="num">{u.week}</span></div>
        <div className="kv"><span>Furthest stage</span><span>{stage(u.peak || u.stage, c.path)}</span></div>
        <div className="kv"><span>Machines handed over</span><span className="num">{u.fleet}</span></div>
        <div className="kv"><span>Sale price</span><span className="num">{f(u.price)}</span></div>
        <div className="kv"><span>Earned over the career</span><span className="num">{f(u.earned)}</span></div>
        <div className="kv"><span>Walked away with</span><span className="num" style={{ color: u.walk < 0 ? 'var(--rust)' : 'inherit' }}>{f(u.walk)}</span></div>
      </div>
      {u.legacy && <button type="button" className="big" onClick={onNextGen}>Start generation {(c.gen || 1) + 1}</button>}
      <button type="button" className={u.legacy ? 'btn full' : 'big'} onClick={onNew}>Start a new career</button>
    </div>
  );
}
