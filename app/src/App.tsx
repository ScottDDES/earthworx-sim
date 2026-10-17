import { useGame } from './store';
import { SetupScreen } from './screens/Setup';
import { ShopScreen } from './screens/Shop';
import { GameScreen } from './screens/Game';
import { EndScreen } from './screens/End';
import type { Saves } from './Slots';

export function App() {
  const g = useGame();
  const c = g.career, saves: Saves = { slot: g.slot, switchSlot: g.switchSlot };
  if (!c) return <SetupScreen onStart={g.start} saves={saves} />;
  if (c.phase === 'shop') return <ShopScreen c={c} act={g.act} />;
  if (c.phase === 'sold' || c.phase === 'bust') return <EndScreen c={c} onNew={g.quit} onNextGen={g.nextGen} />;
  return <GameScreen c={c} act={g.act} onNew={g.quit} saves={saves} saveFailed={g.saveFailed} demo={g.demo} />;
}
