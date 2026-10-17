// Saved games: three careers side by side. A bar on the Career tab says which save you're in; the card lists all
// three with a way to switch, or to start a new career in an empty one.

import { TOWNS } from '@engine';
import { SLOTS, slotMetaAll } from './store';
import { fk } from './format';

export interface Saves {
  slot: number;
  switchSlot: (n: number) => void;
}

const fks = (n: number) => (n < 0 ? '−' : '') + fk(Math.abs(n));
const DIFF = (loan: number) => (loan <= 80000 ? { t: 'HARD', c: 'c-bad' } : loan >= 350000 ? { t: 'EASY', c: 'c-job' } : { t: 'NORMAL', c: 'c-idle' });

export function SlotsBar({ saves, onOpen }: { saves: Saves; onOpen: () => void }) {
  const used = Object.keys(slotMetaAll()).length;
  return (
    <div className="card">
      <div className="row">
        <span className="grow"><b className="small">Save {saves.slot} of {SLOTS}</b><br /><span className="tiny muted">{used > 1 ? used + ' careers saved' : 'Two empty saves for another career'}</span></span>
        <button type="button" className="btn" onClick={onOpen}>Saved games</button>
      </div>
    </div>
  );
}

export function SlotsCard({ saves, onClose }: { saves: Saves; onClose?: () => void }) {
  const M = slotMetaAll();
  return (
    <div className="card">
      <div className="row"><span className="sub grow">Saved games</span>{onClose && <button type="button" className="btn" onClick={onClose}>Close</button>}</div>
      <div className="small muted">Three careers side by side. Switching saves where you are first.</div>
      {Array.from({ length: SLOTS }, (_, k) => k + 1).map((i) => {
        const m = M[i], here = i === saves.slot, d = m ? DIFF(m.loan) : null;
        return (
          <div key={i} className="ycard" style={here ? { borderColor: 'var(--ink)', borderWidth: 2 } : undefined}>
            <div className="row"><b className="grow">Save {i}{m ? ' · ' + m.co : ''}</b>{here && <span className="chip c-dark">PLAYING</span>}</div>
            {m ? (
              <>
                <div className="small muted">{m.over ? 'Career over' : 'Week ' + m.week} · {TOWNS[m.town as keyof typeof TOWNS]?.name ?? ''} · worth {fks(m.nw || 0)}{m.hc ? ' · Hardcore' : ''}</div>
                {d && <div><span className={'chip ' + d.c}>{d.t}</span></div>}
              </>
            ) : <div className="small muted">{here ? 'Empty: set up your company here.' : 'Empty'}</div>}
            {!here && <button type="button" className="btn full" onClick={() => saves.switchSlot(i)}>{m ? 'Switch to this save' : 'Start a new career here'}</button>}
          </div>
        );
      })}
    </div>
  );
}
