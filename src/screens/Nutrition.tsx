import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MEAL_LABELS, todayStr, type DiaryEntry, type FoodItem, type MealType } from '../db';
import { useNutritionTargets } from '../lib/useTargets';
import { per100Of, scaleTo, updateEntryGrams } from '../lib/diary';
import { fmtQty, portionLabel } from '../lib/servings';
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

/** Bir öğünün tüm besinlerini, öğün-bazlı makro toplamıyla birlikte gösterip düzenlemeyi
 * sağlayan detay ekranı — ana ekrandaki öğün satırına dokununca açılır. */
function MealDetail({
  meal,
  entries,
  foodMap,
  onClose,
  onAddFood,
}: {
  meal: MealType;
  entries: DiaryEntry[];
  foodMap: Map<string, FoodItem>;
  onClose: () => void;
  onAddFood: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editGrams, setEditGrams] = useState('');

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const removeEntry = async (id?: number) => {
    if (id == null) return;
    await db.diaryEntries.delete(id);
  };

  const startEdit = (e: DiaryEntry) => {
    setEditingId(e.id ?? null);
    setEditGrams(e.unitLabel && e.unitCount != null ? fmtQty(e.unitCount) : String(e.grams));
  };

  const editedGrams = (e: DiaryEntry) => {
    const n = Math.max(0, Number(editGrams.replace(',', '.')) || 0);
    return e.unitLabel && e.unitGrams ? n * e.unitGrams : n;
  };

  const saveEdit = async (e: DiaryEntry) => {
    const g = editedGrams(e);
    if (!(g > 0)) return;
    const n = Math.max(0, Number(editGrams.replace(',', '.')) || 0);
    await updateEntryGrams(e, per100Of(e, foodMap.get(e.foodId)), g, e.unitLabel ? n : undefined);
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#070a14]">
      <ScreenHeader title={`${MEAL_LABELS[meal]} Detayı`} onBack={onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {entries.length > 0 && (
          <Card className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-emerald-400">{totals.calories}</div>
              <div className="text-[10px] text-slate-400">kcal</div>
            </div>
            <div>
              <div className="text-lg font-bold">{Math.round(totals.proteinG * 10) / 10}g</div>
              <div className="text-[10px] text-slate-400">Protein</div>
            </div>
            <div>
              <div className="text-lg font-bold">{Math.round(totals.carbsG * 10) / 10}g</div>
              <div className="text-[10px] text-slate-400">Karb.</div>
            </div>
            <div>
              <div className="text-lg font-bold">{Math.round(totals.fatG * 10) / 10}g</div>
              <div className="text-[10px] text-slate-400">Yağ</div>
            </div>
          </Card>
        )}

        <Card className="!p-0">
          {entries.length === 0 && (
            <div className="p-4 text-sm text-slate-400">Bu öğüne henüz besin eklenmedi.</div>
          )}
          {entries.map((e, i) => {
            if (editingId === e.id) {
              const byUnit = !!e.unitLabel && !!e.unitGrams;
              const g = editedGrams(e);
              const preview = scaleTo(per100Of(e, foodMap.get(e.foodId)), g);
              return (
                <div key={e.id} className="border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5 last:border-b-0">
                  <div className="truncate text-sm font-medium">{e.foodName}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={byUnit ? 0.5 : 1}
                      autoFocus
                      value={editGrams}
                      onChange={(ev) => setEditGrams(ev.target.value)}
                      onKeyDown={(ev) => ev.key === 'Enter' && saveEdit(e)}
                      className="w-20 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-center text-base font-bold"
                      aria-label={byUnit ? e.unitLabel : 'Gram'}
                    />
                    <span className="text-xs text-slate-400">{byUnit ? e.unitLabel : 'g'}</span>
                    <span className="flex-1 text-xs tabular-nums text-slate-400">
                      → {preview.calories} kcal · P{preview.proteinG} K{preview.carbsG} Y{preview.fatG}
                      {byUnit && <span className="text-slate-500"> · {Math.round(g)} g</span>}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" className="flex-1 !py-1.5 !text-xs" onClick={() => setEditingId(null)}>
                      İptal
                    </Button>
                    <Button className="flex-1 !py-1.5 !text-xs" disabled={!(g > 0)} onClick={() => saveEdit(e)}>
                      Kaydet
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={e.id}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}
              >
                <button onClick={() => startEdit(e)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium">{e.foodName}</div>
                  <div className="text-xs tabular-nums text-slate-400">
                    {portionLabel(e)} · {e.calories} kcal · P{Math.round(e.proteinG * 10) / 10}
                    <span className="ml-1 text-slate-600">✏️</span>
                  </div>
                </button>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="btn-tap -mr-1 rounded-lg p-2 text-slate-600 active:bg-white/10"
                  aria-label="Kaydı sil"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </Card>

        <Button className="w-full" onClick={onAddFood}>
          + Besin Ekle
        </Button>
      </div>
    </div>
  );
}

export default function Nutrition() {
  const push = useNav((s) => s.push);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [detailMeal, setDetailMeal] = useState<MealType | null>(null);
  const profile = useLiveQuery(() => db.profile.get(1), []);
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const today = todayStr();
  const entries = useLiveQuery(() => db.diaryEntries.where('date').equals(today).toArray(), [today]) ?? [];
  const weekCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return todayStr(d);
  }, [today]);
  const weekEntries = useLiveQuery(() => db.diaryEntries.where('date').aboveOrEqual(weekCutoff).toArray(), [weekCutoff]) ?? [];
  const weekly = useMemo(() => computeNutritionWeeklyStats(weekEntries), [weekEntries]);

  const targets = useNutritionTargets();

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
            const mealProtein = mealEntries.reduce((a, e) => a + e.proteinG, 0);
            return (
              <div key={meal} className={`flex items-center gap-1 ${i > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                <button
                  onClick={() => setDetailMeal(meal)}
                  className="btn-tap min-w-0 flex-1 px-4 py-3 text-left"
                >
                  <div className="text-sm font-bold">{MEAL_LABELS[meal]}</div>
                  <div className="text-xs tabular-nums text-slate-400">
                    {mealEntries.length > 0
                      ? `${mealCal} kcal · ${Math.round(mealProtein)}g protein`
                      : 'Henüz besin eklenmedi'}
                  </div>
                </button>
                <button
                  onClick={() => push({ t: 'foodPicker', mealType: meal })}
                  aria-label={`${MEAL_LABELS[meal]} öğününe besin ekle`}
                  className="btn-tap mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-lg font-semibold text-emerald-400 active:bg-emerald-400/20"
                >
                  +
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

      {detailMeal && (
        <MealDetail
          meal={detailMeal}
          entries={entries.filter((e) => e.mealType === detailMeal)}
          foodMap={foodMap}
          onClose={() => setDetailMeal(null)}
          onAddFood={() => {
            const meal = detailMeal;
            setDetailMeal(null);
            push({ t: 'foodPicker', mealType: meal });
          }}
        />
      )}
    </div>
  );
}
