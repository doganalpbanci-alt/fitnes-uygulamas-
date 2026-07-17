import { useNav, type Tab } from './store';
import Home from './screens/Home';
import Fasting from './screens/Fasting';
import Workout from './screens/Workout';
import Progress, { ExerciseDetail } from './screens/Progress';
import Settings from './screens/Settings';
import TemplateEditor from './screens/TemplateEditor';
import Session from './screens/Session';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Ana', icon: '🏠' },
  { key: 'fasting', label: 'Oruç', icon: '⏱️' },
  { key: 'workout', label: 'Antrenman', icon: '🏋️' },
  { key: 'progress', label: 'İlerleme', icon: '📈' },
  { key: 'settings', label: 'Ayarlar', icon: '⚙️' },
];

export default function App() {
  const { tab, view, setTab } = useNav();

  if (view.t === 'editTemplate') return <TemplateEditor id={view.id} />;
  if (view.t === 'session') return <Session templateId={view.templateId} />;
  if (view.t === 'exerciseDetail') return <ExerciseDetail exerciseId={view.exerciseId} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <div className="flex-1 pb-24">
        {tab === 'home' && <Home />}
        {tab === 'fasting' && <Fasting />}
        {tab === 'workout' && <Workout />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-[#0b1020]/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                tab === t.key ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
