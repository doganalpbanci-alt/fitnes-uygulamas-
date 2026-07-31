import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { computeTargets, type NutritionTargets } from './nutrition';

/** En son ölçülen vücut yağ oranı (akıllı tartı ya da elle girilen kayıtlardan). */
export function useLatestBodyFatPct(): number | undefined {
  const entries = useLiveQuery(() => db.bodyWeights.toArray(), []) ?? [];
  const withFat = entries.filter((e) => e.bodyFatPct != null);
  if (withFat.length === 0) return undefined;
  const latest = [...withFat].sort((a, b) =>
    `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`),
  )[0];
  return latest.bodyFatPct;
}

/** Profil + en güncel vücut kompozisyonundan beslenme hedeflerini hesaplar.
 * Profil yoksa null döner. Tüm ekranlar aynı hesabı kullansın diye tek yerde toplandı. */
export function useNutritionTargets(): NutritionTargets | null {
  const profile = useLiveQuery(() => db.profile.get(1), []);
  const bodyFatPct = useLatestBodyFatPct();
  if (!profile) return null;
  return computeTargets({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    goalRateKgPerWeek: profile.goalRateKgPerWeek,
    bodyFatPct,
  });
}
