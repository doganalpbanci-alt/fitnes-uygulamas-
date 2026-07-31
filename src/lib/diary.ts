import { db, type DiaryEntry, type FoodItem } from '../db';

export interface Per100 {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/** Bir günlük kaydının 100 gram başına değerlerini bulur. Mümkünse besin kaydından okur —
 * böylece gramaj birkaç kez düzenlendiğinde yuvarlama hatası birikmez. Besin kaydı yoksa
 * (ör. yedekten gelen eski bir kayıt) kaydın kendi değerlerinden oranlayarak türetir. */
export function per100Of(entry: DiaryEntry, food?: FoodItem): Per100 {
  if (food) {
    return {
      caloriesPer100g: food.caloriesPer100g,
      proteinPer100g: food.proteinPer100g,
      carbsPer100g: food.carbsPer100g,
      fatPer100g: food.fatPer100g,
    };
  }
  const k = entry.grams > 0 ? 100 / entry.grams : 0;
  return {
    caloriesPer100g: entry.calories * k,
    proteinPer100g: entry.proteinG * k,
    carbsPer100g: entry.carbsG * k,
    fatPer100g: entry.fatG * k,
  };
}

export function scaleTo(per100: Per100, grams: number) {
  const f = grams / 100;
  return {
    calories: Math.round(per100.caloriesPer100g * f),
    proteinG: Math.round(per100.proteinPer100g * f * 10) / 10,
    carbsG: Math.round(per100.carbsPer100g * f * 10) / 10,
    fatG: Math.round(per100.fatPer100g * f * 10) / 10,
  };
}

/** Zaten eklenmiş bir kaydın miktarını değiştirir; kalori ve makrolar yeniden hesaplanır.
 * `newUnitCount` verilirse kayıt birimiyle (ör. "3 adet") güncellenir. */
export async function updateEntryGrams(
  entry: DiaryEntry,
  per100: Per100,
  newGrams: number,
  newUnitCount?: number,
) {
  if (entry.id == null || !(newGrams > 0)) return;
  await db.diaryEntries.update(entry.id, {
    grams: Math.round(newGrams * 10) / 10,
    ...scaleTo(per100, newGrams),
    ...(newUnitCount != null ? { unitCount: newUnitCount } : {}),
  });
}
