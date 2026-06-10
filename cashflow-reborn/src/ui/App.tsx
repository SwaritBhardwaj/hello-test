import { useGameStore } from './store';
import { SetupScreen } from './components/SetupScreen';
import { BoardScreen } from './components/BoardScreen';

export default function App() {
  const state = useGameStore((s) => s.state);
  if (!state) return <SetupScreen />;
  return <BoardScreen />;
}
