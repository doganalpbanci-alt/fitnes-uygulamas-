import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ActivityLevel, type NutritionGoal, type Sex } from '../db';
import { ACTIVITY_LEVELS, GOALS, computeTargets } from '../lib/nutrition';
import { useLatestBodyFatPct } from '../lib/useTargets';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

export default function NutritionProfile() {
  const back = useNav((s) => s.back);
  const existing = useLiveQuery(() => db.profile.get(1), []);

  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('30');
  const [heightCm, setHeightCm] = useState('175');
  const [weightKg, setWeightKg] = useState('75');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goal, setGoal] = useState<NutritionGoal>('maintain');
  const [rate, setRate] = useState('0.5');
  const [loaded, setLoaded] = useState(false);

  if (existing && !loaded) {
    setSex(existing.sex);
    setAge(String(existing.age));
    setHeightCm(String(existing.heightCm));
    setWeightKg(String(existing.weightKg));
    setActivityLevel(existing.activityLevel);
    setGoal(existing.goal);
    setRate(String(existing.goalRateKgPerWeek));
    setLoaded(true);
  }

  const ageN = Math.max(10, Number(age) || 0);
  const heightN = Math.max(50, Number(heightCm) || 0);
  const weightN = Math.max(20, Number(weightKg) || 0);
  const rateN = Math.max(0, Number(rate) || 0);
  const valid = ageN > 0 && heightN > 0 && weightN > 0;

  const bodyFatPct = useLatestBodyFatPct();
  const targets = valid
    ? computeTargets({
        sex,
        age: ageN,
        heightCm: heightN,
        weightKg: weightN,
        activityLevel,
        goal,
        goalRateKgPerWeek: rateN,
        bodyFatPct,
      })
    : null;
  const bmr = targets?.bmr ?? 0;
  const tdee = targets?.tdee ?? 0;
  const calorieTarget = targets?.calorieTarget ?? 0;
  const macros = targets ?? { proteinG: 0, fatG: 0, carbsG: 0 };

  const save = async () => {
    if (!valid) return;
    await db.profile.put({
      id: 1,
      sex,
      age: ageN,
      heightCm: heightN,
      weightKg: weightN,
      activityLevel,
      goal,
      goalRateKgPerWeek: rateN,
    });
    await db.bodyWeights.add({ date: new Date().toISOString().slice(0, 10), weightKg: weightN });
    back();
  };

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader
        title="Beslenme Profili"
        onBack={back}
        right={
          <Button className="!py-2" disabled={!valid} onClick={save}>
            Kaydet
          </Button>
        }
      />
      <div className="space-y-3 px-4">
        <Card className="space-y-3">
          <div className="font-semibold">Kişisel Bilgiler</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSex('male')}
              className={`btn-tap rounded-xl border px-3 py-2.5 font-semibold ${
                sex === 'male'
                  ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-300'
              }`}
            >
              Erkek
            </button>
            <button
              onClick={() => setSex('female')}
              className={`btn-tap rounded-xl border px-3 py-2.5 font-semibold ${
                sex === 'female'
                  ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-300'
              }`}
            >
              Kadın
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-xs text-slate-400">Yaş</span>
              <input
                type="number"
                inputMode="numeric"
                min={10}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Boy (cm)</span>
              <input
                type="number"
                inputMode="numeric"
                min={50}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Kilo (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min={20}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center"
              />
            </label>
          </div>
        </Card>

        <Card className="space-y-2">
          <div className="font-semibold">Aktivite Seviyesi</div>
          <div className="space-y-1.5">
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.key}
                onClick={() => setActivityLevel(a.key)}
                className={`btn-tap flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${
                  activityLevel === a.key
                    ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div>
                  <div className="font-semibold">{a.label}</div>
                  <div className="text-xs text-slate-400">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="font-semibold">Hedef</div>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGoal(g.key)}
                className={`btn-tap rounded-xl border px-2 py-2.5 text-sm font-semibold ${
                  goal === g.key
                    ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                    : 'border-white/[0.06] bg-white/[0.02] text-slate-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {goal !== 'maintain' && (
            <label className="block text-sm">
              <span className="text-slate-400">Haftalık hedef ({goal === 'lose' ? 'kayıp' : 'artış'}) kg</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
              />
            </label>
          )}
        </Card>

        {valid && (
          <Card className="space-y-3 border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.10] via-white/[0.03] to-transparent">
            <div className="font-semibold">Hesaplanan Hedeflerin</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
                <div className="text-xs text-slate-400">BMR</div>
                <div className="text-lg font-bold">{Math.round(bmr)}</div>
                <div className="text-[10px] text-slate-500">kcal/gün</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-2.5 text-center">
                <div className="text-xs text-slate-400">TDEE</div>
                <div className="text-lg font-bold">{Math.round(tdee)}</div>
                <div className="text-[10px] text-slate-500">kcal/gün</div>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
              <div className="text-xs text-emerald-300">Günlük Kalori Hedefi</div>
              <div className="text-3xl font-extrabold text-emerald-300">{calorieTarget}</div>
              <div className="text-xs text-slate-400">kcal</div>
            </div>
            {targets?.clampReason && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.08] p-2.5 text-xs text-amber-200">
                ⚠️ {targets.clampReason} (İstenen: {targets.rawCalorieTarget} kcal)
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="font-bold">{macros.proteinG}g</div>
                <div className="text-xs text-slate-400">Protein</div>
              </div>
              <div>
                <div className="font-bold">{macros.carbsG}g</div>
                <div className="text-xs text-slate-400">Karbonhidrat</div>
              </div>
              <div>
                <div className="font-bold">{macros.fatG}g</div>
                <div className="text-xs text-slate-400">Yağ</div>
              </div>
            </div>
            {targets && (
              <div className="border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-slate-500">
                {targets.bmrFormula === 'katch-mcardle' ? (
                  <>
                    BMR, ölçülen vücut yağ oranın (%{bodyFatPct}) kullanılarak{' '}
                    <b className="text-slate-400">Katch-McArdle</b> formülüyle hesaplandı — yağsız kütlen{' '}
                    {targets.leanMassKg} kg. Protein hedefi de yağsız kütleye göre belirlendi.
                  </>
                ) : (
                  <>
                    BMR <b className="text-slate-400">Mifflin-St Jeor</b> formülüyle hesaplandı. Kilo Takibi'ne
                    vücut yağ oranı içeren bir ölçüm eklersen daha isabetli olan Katch-McArdle'a geçilir.
                  </>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
