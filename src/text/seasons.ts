// The seasons in words: each one's name and what you're in for.

import type { SeasonId } from '../seasons';

export const SEASON_TEXT: Record<SeasonId, { n: string; d: string }> = {
  wet2010: { n: 'The big wet', d: 'Charters Towers, April 2010 to March 2011, one of the wettest summers on record. One grader and a $180k loan. The work will come, if the rain lets you do it.' },
  dry2019: { n: 'Bone dry', d: 'Goondiwindi through the 2019 drought. Hardly any flood money and every outfit chasing the same jobs. Start on a shoestring and last the year.' },
  prog2022: { n: 'The program', d: '2022. You\'re a regional contractor with two crews and a depot, and you\'ve just won a flood recovery program. Deliver it by 30 June, on budget, in the real 2022 wet, and pick up what other work you can.' },
};
