import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MEAL_LABELS, todayStr, type MealType } from '../db';
import { calcBMR, calcTDEE, calcCalorieTarget, calcMacroTargets } from '../lib/nutrition';
import { computeNutritionWeeklyStats, type DayNutritionSummary } from '../lib/weeklyStats';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

const MEALS: MealType[] = ['kahvalti', 'ogle', 'aksam', 'ara'];

function WeeklyCalorieBars({ days, target }: { days: DayNutritionSummary[]; target: number }) {
  const h = 90;
  const maxVal = Math.max(target, ...days.map((d) => d.calories), 1);
  return (
    <div>
      <div className="relative" style={{ height: h }}>
        <div className="absolute inset-x-0 flex items-center" style={{ bottom: (target / maxVal) * h }}>
          <div className="flex-1 border-t border-dashed border-amber-300/40" />
          <span className="ml-1 shrink-0 text-[9px] font-semibold text-amber-300/70">hedef</span>
        </div>
        <div className="absolute inset-0 flex items-end gap-1.5">
          {days.map((d) => {
            const barH = d.calories === 0 ? 2 : Math.max(4, (d.calories / maxVal) * h);
            const over = d.calories > target;
            return (
              <div key={d.date} className="flex-1">
                <div
                  className={`w-full rounded-t-md ${
                    d.calories === 0
                      ? 'bg-white/[0.08]'
                      : over
                        ? 'bg-gradient-to-t from-rose-500 to-rose-400'
                        : 'bg-gradient-to-t from-emerald-500 to-emerald-400'
                  }`}
                  style={{ height: barH }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-1.5">
        {days.map((d, i) => (
          <div key={d.date} className={`flex-1 text-center text-[10px] ${i === days.length - 1 ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
            {i === days.length - 1
              ? 'Bugün'
              : new Date(d.date + 'T00:00:00').toLocaleDateString('tr-TR', { weekday: 'short' })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  const fraction = target > 0 ? consumed / target : 0;
  const f = Math.min(1, Math.max(0, fraction));
  const over = consumed > target;
  const stops: [string, string] = over ? ['#fb7185', '#e11d48'] : ['#34d399', '#10b981'];
  const remaining = target - consumed;

  return (
    <div className="relative mx-auto h-40 w-40">
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
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const profile = useLiveQuery(() => db.profile.get(1), []);
  const today = todayStr();
  const entries = useLiveQuery(() => db.diaryEntries.where('date').equals(today).toArray(), [today]) ?? [];
  const weekCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return todayStr(d);
  }, [today]);
  const weekEntries = useLiveQuery(() => db.diaryEntries.where('date').aboveOrEqual(weekCutoff).toArray(), [weekCutoff]) ?? [];
  const weekly = useMemo(() => computeNutritionWeeklyStats(weekEntries), [weekEntries]);

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
        <Card>
          <CalorieRing consumed={totals.calories} target={targets.calorieTarget} />
          <div className="mt-3 space-y-2.5">
            <MacroBar label="Protein" consumed={totals.proteinG} target={targets.proteinG} color="bg-gradient-to-r from-sky-400 to-blue-500" />
            <MacroBar label="Karbonhidrat" consumed={totals.carbsG} target={targets.carbsG} color="bg-gradient-to-r from-amber-400 to-orange-500" />
            <MacroBar label="Yağ" consumed={totals.fatG} target={targets.fatG} color="bg-gradient-to-r from-fuchsia-400 to-pink-500" />
          </div>
        </Card>

        <Card className="!p-0">
          {MEALS.map((meal, i) => {
            const mealEntries = entries.filter((e) => e.mealType === meal);
            const mealCal = mealEntries.reduce((a, e) => a + e.calories, 0);
            return (
              <div key={meal} className={i > 0 ? 'border-t border-white/[0.06]' : ''}>
                <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
                  <div className="text-sm font-bold">{MEAL_LABELS[meal]}</div>
                  {mealCal > 0 && <div className="text-xs tabular-nums text-slate-400">{mealCal} kcal</div>}
                </div>
                {mealEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-1">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{e.foodName}</div>
                      <div className="text-xs tabular-nums text-slate-500">
                        {e.grams}g · {e.calories} kcal
                      </div>
                    </div>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="btn-tap -mr-1 rounded-lg p-2 text-slate-600 active:bg-white/10"
                      aria-label="Kaydı sil"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => push({ t: 'foodPicker', mealType: meal })}
                  className="btn-tap w-full px-4 pb-3 pt-1.5 text-left text-sm font-semibold text-emerald-400"
                >
                  + Besin ekle
                </button>
              </div>
            );
          })}
        </Card>

        <Card className="space-y-3">
          <button className="flex w-full items-center justify-between" onClick={() => setWeeklyOpen((v) => !v)}>
            <div className="font-semibold">Haftalık Özet</div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {weekly.daysLogged > 0 && <span className="tabular-nums">Ort. {weekly.avgCalories} kcal</span>}
              <span>{weekly.daysLogged}/7 gün</span>
              <span className="text-slate-500">{weeklyOpen ? '▾' : '▸'}</span>
            </div>
          </button>
          {weeklyOpen &&
            (weekly.daysLogged === 0 ? (
              <div className="text-sm text-slate-400">Bu hafta henüz kayıt yok.</div>
            ) : (
              <>
                <WeeklyCalorieBars days={weekly.days} target={targets.calorieTarget} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">Ort. kalori (kayıtlı günler)</div>
                    <div className="font-bold tabular-nums">{weekly.avgCalories} kcal</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Hedefe göre</div>
                    <div className={`font-bold tabular-nums ${weekly.avgCalories > targets.calorieTarget ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {weekly.avgCalories > targets.calorieTarget ? '+' : ''}
                      {weekly.avgCalories - targets.calorieTarget} kcal
                    </div>
                  </div>
                </div>
              </>
            ))}
        </Card>

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
      </div>
    </div>
  );
}
