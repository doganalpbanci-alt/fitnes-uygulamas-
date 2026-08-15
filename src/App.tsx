import { useNav, type Tab } from './store';
import { useAppUpdate } from './lib/appUpdate';
import Home from './screens/Home';
import Fasting from './screens/Fasting';
import Nutrition from './screens/Nutrition';
import Workout from './screens/Workout';
import Progress, { ExerciseDetail } from './screens/Progress';
import Settings from './screens/Settings';
import TemplateEditor from './screens/TemplateEditor';
import Session from './screens/Session';
import WorkoutSummary from './screens/WorkoutSummary';
import SessionEdit from './screens/SessionEdit';
import NutritionProfile from './screens/NutritionProfile';
import FoodPicker from './screens/FoodPicker';
import WeightHistory from './screens/WeightHistory';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Ana', icon: '🏠' },
  { key: 'fasting', label: 'Oruç', icon: '⏱️' },
  { key: 'nutrition', label: 'Beslenme', icon: '🍎' },
  { key: 'workout', label: 'Antrenman', icon: '🏋️' },
  { key: 'progress', label: 'İlerleme', icon: '📈' },
  { key: 'settings', label: 'Ayarlar', icon: '⚙️' },
];

function UpdateBanner() {
  const { updateReady, reload } = useAppUpdate();
  if (!updateReady) return null;
  return (
    <button
      onClick={reload}
      className="btn-tap flex w-full items-center justify-center gap-2 border-b border-emerald-300/30 bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] text-sm font-semibold text-slate-950"
    >
      <span>✨ Yeni sürüm hazır</span>
      <span className="rounded-full bg-slate-950/15 px-2 py-0.5 text-xs">Yenile</span>
    </button>
  );
}

export default function App() {
  return (
    <>
      <UpdateBanner />
      <AppContent />
    </>
  );
}

function AppContent() {
  const { tab, view, setTab } = useNav();

  if (view.t === 'editTemplate') return <TemplateEditor id={view.id} />;
  if (view.t === 'session') return <Session templateId={view.templateId} />;
  if (view.t === 'exerciseDetail') return <ExerciseDetail exerciseId={view.exerciseId} />;
  if (view.t === 'sessionSummary') return <WorkoutSummary sessionId={view.sessionId} />;
  if (view.t === 'sessionEdit') return <SessionEdit sessionId={view.sessionId} />;
  if (view.t === 'nutritionProfile') return <NutritionProfile />;
  if (view.t === 'foodPicker') return <FoodPicker mealType={view.mealType} date={view.date} />;
  if (view.t === 'weightHistory') return <WeightHistory />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <div className="flex-1 pb-24">
        {tab === 'home' && <Home />}
        {tab === 'fasting' && <Fasting />}
        {tab === 'nutrition' && <Nutrition />}
        {tab === 'workout' && <Workout />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#070a14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-0.5 px-1.5 pb-[env(safe-area-inset-bottom)] pt-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn-tap flex flex-1 flex-col items-center gap-1 py-2"
            >
              <span
                className={`flex h-8 w-10 items-center justify-center rounded-full text-base leading-none transition-colors ${
                  tab === t.key ? 'bg-emerald-400/15 text-emerald-400' : 'text-slate-500'
                }`}
              >
                {t.icon}
              </span>
              <span className={`text-[9px] font-medium ${tab === t.key ? 'text-emerald-400' : 'text-slate-500'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
