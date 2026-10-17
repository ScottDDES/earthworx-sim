// Col's notes: one short piece of advice where it matters, shown until you say "Got it".

import { mentorOff, mentorOk, mentorShown, game, type MentorNote } from '@engine';
import { MENTOR, MENTOR_WHO } from '@engine/text/coach';

type Act = (fn: (c: game.Career) => unknown) => void;

export function Mentor({ c, k, act }: { c: game.Career; k: MentorNote; act: Act }) {
  if (!mentorShown(c, k)) return null;
  return (
    <div className="mentor">
      <span className="who">{MENTOR_WHO}</span>
      <div className="small">"{MENTOR[k]}"</div>
      <div className="row">
        <button type="button" className="btn" style={{ minHeight: 38 }} onClick={() => act((x) => mentorOk(x, k))}>Got it</button>
        <button type="button" className="linkbtn tiny" onClick={() => act((x) => mentorOff(x))}>No more notes from Col</button>
      </div>
    </div>
  );
}
