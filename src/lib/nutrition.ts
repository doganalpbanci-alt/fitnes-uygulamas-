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

/** 1 kg vücut yağı ≈ 7700 kcal. */
export const KCAL_PER_KG_FAT = 7700;

/** Güvenlik sınırları — hedef bunların altına indirilmez. */
const MAX_DEFICIT_RATIO = 0.25; // TDEE'nin en fazla %25'i açık
const MAX_SURPLUS_RATIO = 0.2; // TDEE'nin en fazla %20'si fazla
const ABSOLUTE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };
const MIN_FAT_G_PER_KG = 0.6; // hormonal sağlık için asgari yağ

/** Vücut yağ oranının makul (ölçüm hatası olmayan) bir değer olup olmadığı. */
function usableBodyFat(pct?: number): pct is number {
  return typeof pct === 'number' && isFinite(pct) && pct >= 3 && pct <= 70;
}

/** Mifflin-St Jeor formülü — bazal metabolizma hızı (kcal/gün). */
export function calcBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Katch-McArdle formülü — yağsız vücut kütlesine dayanır, vücut yağ oranı biliniyorsa
 * Mifflin-St Jeor'dan daha isabetlidir (kas/yağ dağılımını hesaba katar). */
export function calcBMRFromLeanMass(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export function calcTDEE(bmr: number, activity: ActivityLevel): number {
  const mult = ACTIVITY_LEVELS.find((a) => a.key === activity)?.mult ?? 1.2;
  return bmr * mult;
}

/** ~7700 kcal ≈ 1 kg vücut yağı; haftalık hedefi günlük kalori farkına çevirir. */
export function calcCalorieTarget(tdee: number, goal: NutritionGoal, rateKgPerWeek: number): number {
  const dailyAdjustment = (rateKgPerWeek * KCAL_PER_KG_FAT) / 7;
  if (goal === 'lose') return Math.round(tdee - dailyAdjustment);
  if (goal === 'gain') return Math.round(tdee + dailyAdjustment);
  return Math.round(tdee);
}

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface TargetsInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  goalRateKgPerWeek: number;
  /** Biliniyorsa (akıllı tartı ya da elle girilen ölçüm) daha isabetli hesap için kullanılır. */
  bodyFatPct?: number;
}

export interface NutritionTargets extends MacroTargets {
  bmr: number;
  bmrFormula: 'katch-mcardle' | 'mifflin-st-jeor';
  leanMassKg?: number;
  tdee: number;
  calorieTarget: number;
  /** Güvenlik sınırları uygulanmadan önceki ham hedef. */
  rawCalorieTarget: number;
  /** Hedef güvenlik sınırına takıldıysa nedeni (kullanıcıya gösterilir). */
  clampReason?: string;
  /** Protein hedefinin yağsız kütleye mi toplam kiloya mı dayandığı. */
  proteinBasis: 'lean' | 'weight';
}

/** Hedefe göre protein (g/kg). Yağsız kütle biliniyorsa ona, bilinmiyorsa toplam kiloya uygulanır.
 * Açıkta protein yüksek tutulur — kalori kısıtlıyken kas kaybını azaltır. */
function proteinPerKg(goal: NutritionGoal, basis: 'lean' | 'weight'): number {
  if (basis === 'lean') return goal === 'lose' ? 2.2 : 1.8;
  return goal === 'lose' ? 1.8 : 1.6;
}

/** Kalori hedefini makro dağılımına böler.
 *
 * Önceki sürümde karbonhidrat, protein+yağ hedefi aştığında sessizce 0'a kırpılıyordu; bu durumda
 * makroların toplamı kalori hedefini tutmuyordu. Artık önce yağ (asgari sınırına kadar), sonra
 * protein azaltılır — böylece makrolar her zaman kalori hedefiyle tutarlı kalır. */
export function calcMacroTargets(
  calorieTarget: number,
  weightKg: number,
  goal: NutritionGoal = 'maintain',
  leanMassKg?: number,
): MacroTargets {
  const basis: 'lean' | 'weight' = leanMassKg != null ? 'lean' : 'weight';
  const basisKg = leanMassKg ?? weightKg;

  let proteinG = Math.round(basisKg * proteinPerKg(goal, basis));
  const minFatG = Math.round(weightKg * MIN_FAT_G_PER_KG);
  let fatG = Math.max(minFatG, Math.round((calorieTarget * 0.25) / 9));

  // Protein + yağ hedefi aşıyorsa: önce yağı asgariye kadar indir, sonra proteini kıs.
  let remaining = calorieTarget - proteinG * 4 - fatG * 9;
  if (remaining < 0) {
    const reducibleFatG = Math.max(0, fatG - minFatG);
    const cutFatG = Math.min(reducibleFatG, Math.ceil(-remaining / 9));
    fatG -= cutFatG;
    remaining += cutFatG * 9;
  }
  if (remaining < 0) {
    const cutProteinG = Math.min(proteinG, Math.ceil(-remaining / 4));
    proteinG -= cutProteinG;
    remaining += cutProteinG * 4;
  }

  return { proteinG, fatG, carbsG: Math.max(0, Math.round(remaining / 4)) };
}

/** Tüm beslenme hedeflerini tek yerden hesaplar — ekranlar bunu kullanır. */
export function computeTargets(input: TargetsInput): NutritionTargets {
  const { sex, age, heightCm, weightKg, activityLevel, goal, goalRateKgPerWeek, bodyFatPct } = input;

  const hasBodyFat = usableBodyFat(bodyFatPct);
  const leanMassKg = hasBodyFat ? Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10 : undefined;
  const bmrFormula = leanMassKg != null ? 'katch-mcardle' : 'mifflin-st-jeor';

  // BMR ve TDEE bir kez yuvarlanır ve tüm alt hesaplar bu yuvarlanmış değerlerden türer —
  // böylece kullanıcıya gösterilen sayılar kendi aralarında birebir tutarlı olur.
  const bmr = Math.round(
    leanMassKg != null ? calcBMRFromLeanMass(leanMassKg) : calcBMR(sex, weightKg, heightCm, age),
  );
  const tdee = Math.round(calcTDEE(bmr, activityLevel));
  const rawCalorieTarget = calcCalorieTarget(tdee, goal, goalRateKgPerWeek);

  let calorieTarget = rawCalorieTarget;
  let clampReason: string | undefined;

  if (goal === 'lose') {
    // Açık en fazla TDEE'nin %25'i; hedef ne BMR'ın ne de mutlak alt sınırın altına inebilir.
    const byDeficit = tdee * (1 - MAX_DEFICIT_RATIO);
    const floor = Math.round(Math.max(byDeficit, bmr, ABSOLUTE_FLOOR[sex]));
    if (rawCalorieTarget < floor) {
      calorieTarget = floor;
      clampReason =
        floor === Math.round(byDeficit)
          ? 'Haftalık hedefin çok yüksek — açık, TDEE’nin %25’iyle sınırlandı.'
          : floor === Math.round(bmr)
            ? 'Hedef bazal metabolizma hızının altına inmesin diye yükseltildi.'
            : `Hedef, güvenli alt sınır olan ${floor} kcal’ye yükseltildi.`;
    }
  } else if (goal === 'gain') {
    const ceiling = Math.round(tdee * (1 + MAX_SURPLUS_RATIO));
    if (rawCalorieTarget > ceiling) {
      calorieTarget = ceiling;
      clampReason = 'Haftalık hedefin çok yüksek — fazlalık, TDEE’nin %20’siyle sınırlandı.';
    }
  }

  const macros = calcMacroTargets(calorieTarget, weightKg, goal, leanMassKg);

  return {
    bmr,
    bmrFormula,
    leanMassKg,
    tdee,
    calorieTarget,
    rawCalorieTarget,
    clampReason,
    proteinBasis: leanMassKg != null ? 'lean' : 'weight',
    ...macros,
  };
}
