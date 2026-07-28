import type { ActivityLevel, NutritionGoal, Sex } from '../db';

export const ACTIVITY_LEVELS: { key: ActivityLevel; label: string; desc: string; mult: number }[] = [
  { key: 'sedentary', label: 'Hareketsiz', desc: 'Masa başı iş, egzersiz yok', mult: 1.2 },
  { key: 'light', label: 'Az Aktif', desc: 'Haftada 1–3 gün hafif egzersiz', mult: 1.375 },
  { key: 'moderate', label: 'Orta Aktif', desc: 'Haftada 3–5 gün egzersiz', mult: 1.55 },
  { key: 'active', label: 'Aktif', desc: 'Haftada 6–7 gün egzersiz', mult: 1.725 },
  { key: 'very_active', label: 'Çok Aktif', desc: 'Günde 2 kez / fiziksel iş', mult: 1.9 },
];

export const GOALS: { key: NutritionGoal; label: string }[] = [
  { key: 'lose', label: 'Kilo Ver' },
  { key: 'maintain', label: 'Koru' },
  { key: 'gain', label: 'Kilo Al' },
];

/** Mifflin-St Jeor formülü — bazal metabolizma hızı (kcal/gün) */
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calcTDEE(bmr: number, activity: ActivityLevel): number {
  const mult = ACTIVITY_LEVELS.find((a) => a.key === activity)?.mult ?? 1.2;
  return bmr * mult;
}

/** ~7700 kcal ≈ 1 kg vücut yağı; haftalık hedefi günlük kalori farkına çevirir. */
export function calcCalorieTarget(tdee: number, goal: NutritionGoal, rateKgPerWeek: number): number {
  const dailyAdjustment = (rateKgPerWeek * 7700) / 7;
  if (goal === 'lose') return Math.max(1000, Math.round(tdee - dailyAdjustment));
  if (goal === 'gain') return Math.round(tdee + dailyAdjustment);
  return Math.round(tdee);
}

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** Protein ~1.8g/kg, yağ kalorinin ~%25'i, kalan karbonhidrat. */
export function calcMacroTargets(calorieTarget: number, weightKg: number): MacroTargets {
  const proteinG = Math.round(weightKg * 1.8);
  const proteinCal = proteinG * 4;
  const fatCal = calorieTarget * 0.25;
  const fatG = Math.round(fatCal / 9);
  const carbsCal = Math.max(0, calorieTarget - proteinCal - fatCal);
  const carbsG = Math.round(carbsCal / 4);
  return { proteinG, fatG, carbsG };
}
