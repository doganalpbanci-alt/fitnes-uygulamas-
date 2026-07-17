import { useNav, type Tab } from './store';
import Home from './screens/Home';
import Fasting from './screens/Fasting';
import Workout from './screens/Workout';
import Progress, { ExerciseDetail } from './screens/Progress';
import Settings from './screens/Settings';
import TemplateEditor from './screens/TemplateEditor';
import Session from './screens/Session';
import WorkoutSummary from './screens/WorkoutSummary';

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
  if (view.t === 'sessionSummary') return <WorkoutSummary sessionId={view.sessionId} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <div className="flex-1 pb-24">
        {tab === 'home' && <Home />}
        {tab === 'fasting' && <Fasting />}
        {tab === 'workout' && <Workout />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#070a14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-1 px-2 pb-[env(safe-area-inset-bottom)] pt-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn-tap flex flex-1 flex-col items-center gap-1 py-2"
            >
              <span
                className={`flex h-8 w-12 items-center justify-center rounded-full text-lg leading-none transition-colors ${
                  tab === t.key ? 'bg-emerald-400/15 text-emerald-400' : 'text-slate-500'
                }`}
              >
                {t.icon}
              </span>
              <span className={`text-[10px] font-medium ${tab === t.key ? 'text-emerald-400' : 'text-slate-500'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
