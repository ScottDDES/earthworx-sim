// The end of a career: sold up, or gone into administration on Hardcore.

import { game } from '@engine';
import { f } from '../format';

export function EndScreen({ c, onNew }: { c: game.Career; onNew: () => void }) {
  const sold = c.phase === 'sold', d = (sold ? c.soldUp : c.bustOut) as Record<string, number | string> | undefined;
  return (
    <div className="wrap setup">
      <div className="hero">
        <h1>{sold ? 'You sold the business' : 'The administrators have moved in'}</h1>
        <p>{sold ? `${c.co} now belongs to ${d?.to ?? 'a bigger outfit'}.` : `${c.co} owed more than it was worth for four weeks running.`}</p>
      </div>
      <div className="card">
        <div className="kv"><span>Weeks in business</span><span className="num">{c.week - 1}</span></div>
        {sold && d && <div className="kv"><span>Sale price</span><span className="num">{f(Number(d.price))}</span></div>}
        {sold && d && <div className="kv"><span>You walk away with</span><span className="num">{f(Number(d.walk))}</span></div>}
        {!sold && d && <div className="kv"><span>Net worth at the end</span><span className="num">{f(Number(d.nw))}</span></div>}
        <div className="kv"><span>Earned over the career</span><span className="num">{f(c.stats.earned)}</span></div>
      </div>
      <button type="button" className="big" onClick={onNew}>Start a new career</button>
    </div>
  );
}
