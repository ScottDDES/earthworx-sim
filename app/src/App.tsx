import { useGame } from './store';
import { SetupScreen } from './screens/Setup';
import { ShopScreen } from './screens/Shop';
import { GameScreen } from './screens/Game';
import { EndScreen } from './screens/End';
import { SeasonEndScreen } from './Seasons';
import type { Saves } from './Slots';

export function App() {
  const g = useGame();
  const c = g.career;
  const saves: Saves = { slot: g.slot, switchSlot: g.switchSlot, startSeason: g.startSeason, continueSeason: g.continueSeason, leaveSeason: g.leaveSeason, hasCareer: g.hasCareer };
  if (!c) return <SetupScreen onStart={g.start} saves={saves} />;
  if (c.phase === 'seasonEnd') return <SeasonEndScreen c={c} saves={saves} hasCareer={g.hasCareer} />;
  if (c.phase === 'shop') return <ShopScreen c={c} act={g.act} />;
  if (c.phase === 'sold' || c.phase === 'bust') return <EndScreen c={c} onNew={g.quit} onNextGen={g.nextGen} />;
  return <GameScreen c={c} act={g.act} onNew={g.quit} saves={saves} saveFailed={g.saveFailed} demo={g.demo} />;
}
