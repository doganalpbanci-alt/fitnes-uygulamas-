import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MEAL_LABELS, todayStr, type MealType } from '../db';
import { calcBMR, calcTDEE, calcCalorieTarget, calcMacroTargets } from '../lib/nutrition';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

const MEALS: MealType[] = ['kahvalti', 'ogle', 'aksam', 'ara'];

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  const fraction = target > 0 ? consumed / target : 0;
  const f = Math.min(1, Math.max(0, fraction));
  const over = consumed > target;
  const stops: [string, string] = over ? ['#fb7185', '#e11d48'] : ['#34d399', '#10b981'];
  const remaining = target - consumed;

  return (
    <div className="relative mx-auto h-48 w-48">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="calRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="100%" stopColor={stops[1]} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="url(#calRing)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-3xl font-extrabold tabular-nums">{Math.round(consumed)}</div>
        <div className="text-xs text-slate-400">/ {Math.round(target)} kcal</div>
        <div className={`mt-1 text-xs font-semibold ${over ? 'text-rose-400' : 'text-emerald-400'}`}>
          {over ? `${Math.round(-remaining)} kcal aştın` : `${Math.round(remaining)} kcal kaldı`}
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target, color }: { label: string; consumed: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-500">
          {Math.round(consumed)} / {Math.round(target)}g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

export default function Nutrition() {
  const push = useNav((s) => s.push);
  const profile = useLiveQuery(() => db.profile.get(1), []);
  const today = todayStr();
  const entries = useLiveQuery(() => db.diaryEntries.where('date').equals(today).toArray(), [today]) ?? [];

  const targets = useMemo(() => {
    if (!profile) return null;
    const bmr = calcBMR(profile.sex, profile.weightKg, profile.heightCm, profile.age);
    const tdee = calcTDEE(bmr, profile.activityLevel);
    const calorieTarget = calcCalorieTarget(tdee, profile.goal, profile.goalRateKgPerWeek);
    const macros = calcMacroTargets(calorieTarget, profile.weightKg);
    return { calorieTarget, ...macros };
  }, [profile]);

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          proteinG: acc.proteinG + e.proteinG,
          carbsG: acc.carbsG + e.carbsG,
          fatG: acc.fatG + e.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      ),
    [entries],
  );

  const removeEntry = async (id?: number) => {
    if (id == null) return;
    await db.diaryEntries.delete(id);
  };

  if (!profile || !targets) {
    return (
      <div className="pb-4">
        <ScreenHeader title="Beslenme" />
        <div className="space-y-3 px-4">
          <Card className="space-y-3 text-center">
            <div className="text-3xl">🍽️</div>
            <div className="font-bold">Önce profilini oluştur</div>
            <div className="text-sm text-slate-400">
              Bazal metabolizma hızını ve günlük kalori/besin hedeflerini hesaplamak için birkaç bilgiye ihtiyacımız var.
            </div>
            <Button className="w-full" onClick={() => push({ t: 'nutritionProfile' })}>
              Profili Oluştur
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Beslenme"
        right={
          <Button variant="secondary" className="!py-2" onClick={() => push({ t: 'nutritionProfile' })}>
            ⚙️ Profil
          </Button>
        }
      />
      <div className="space-y-3 px-4">
        <Card className="flex items-center justify-between py-3" onClick={() => push({ t: 'weightHistory' })}>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <div>
              <div className="text-sm font-semibold">Kilo Takibi</div>
              <div className="text-xs text-slate-400">Güncel: {profile.weightKg} kg</div>
            </div>
          </div>
          <span className="text-slate-500">›</span>
        </Card>

        <Card>
          <CalorieRing consumed={totals.calories} target={targets.calorieTarget} />
          <div className="mt-3 space-y-2.5">
            <MacroBar label="Protein" consumed={totals.proteinG} target={targets.proteinG} color="bg-gradient-to-r from-sky-400 to-blue-500" />
            <MacroBar label="Karbonhidrat" consumed={totals.carbsG} target={targets.carbsG} color="bg-gradient-to-r from-amber-400 to-orange-500" />
            <MacroBar label="Yağ" consumed={totals.fatG} target={targets.fatG} color="bg-gradient-to-r from-fuchsia-400 to-pink-500" />
          </div>
        </Card>

        {MEALS.map((meal) => {
          const mealEntries = entries.filter((e) => e.mealType === meal);
          const mealCal = mealEntries.reduce((a, e) => a + e.calories, 0);
          return (
            <Card key={meal} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{MEAL_LABELS[meal]}</div>
                <div className="text-xs text-slate-400">{mealCal} kcal</div>
              </div>
              {mealEntries.length > 0 && (
                <div className="space-y-1.5">
                  {mealEntries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.foodName}</div>
                        <div className="text-xs text-slate-500">
                          {e.grams}g · {e.calories} kcal
                        </div>
                      </div>
                      <button
                        onClick={() => removeEntry(e.id)}
                        className="rounded-lg p-1.5 text-slate-500 active:bg-white/10"
                        aria-label="Kaydı sil"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => push({ t: 'foodPicker', mealType: meal })}
                className="btn-tap w-full rounded-lg border border-dashed border-white/15 py-2 text-sm font-semibold text-emerald-400"
              >
                + Ekle
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
