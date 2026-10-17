import { useGame } from './store';
import { SetupScreen } from './screens/Setup';
import { ShopScreen } from './screens/Shop';
import { GameScreen } from './screens/Game';
import { EndScreen } from './screens/End';

export function App() {
  const g = useGame();
  const c = g.career;
  if (!c) return <SetupScreen onStart={g.start} />;
  if (c.phase === 'shop') return <ShopScreen c={c} act={g.act} />;
  if (c.phase === 'sold' || c.phase === 'bust') return <EndScreen c={c} onNew={g.quit} />;
  return <GameScreen c={c} act={g.act} onNew={g.quit} />;
}
