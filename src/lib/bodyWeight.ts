import { db, type BodyWeightEntry } from '../db';
import type { ParsedEufyEntry } from './eufyImport';

/** Profildeki kiloyu en son ölçümle günceller (varsa), BMR/TDEE'nin güncel kalması için. */
export async function syncProfileWeight() {
  const profile = await db.profile.get(1);
  if (!profile) return;
  const all = await db.bodyWeights.toArray();
  if (all.length === 0) return;
  const latest = [...all].sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`))[0];
  if (latest.weightKg !== profile.weightKg) {
    await db.profile.update(1, { weightKg: latest.weightKg });
  }
}

export async function addManualWeight(date: string, weightKg: number) {
  await db.bodyWeights.add({ date, weightKg, source: 'manual' });
  await syncProfileWeight();
}

/** Zaten var olan (aynı tarih + aynı kilo) kayıtları atlayarak Eufy verisini içe aktarır. */
export async function importEufyEntries(entries: ParsedEufyEntry[]): Promise<number> {
  const existing = await db.bodyWeights.toArray();
  const existingKeys = new Set(existing.map((e) => `${e.date}_${e.weightKg}`));

  const toAdd: BodyWeightEntry[] = entries
    .filter((e) => !existingKeys.has(`${e.dateStr}_${e.weightKg}`))
    .map((e) => ({
      date: e.dateStr,
      time: e.timeStr,
      weightKg: e.weightKg,
      bmi: e.bmi,
      bodyFatPct: e.bodyFatPct,
      muscleMassKg: e.muscleMassKg,
      muscleMassPct: e.muscleMassPct,
      waterPct: e.waterPct,
      boneMassKg: e.boneMassKg,
      visceralFat: e.visceralFat,
      bodyAge: e.bodyAge,
      source: 'eufy',
    }));

  if (toAdd.length > 0) {
    await db.bodyWeights.bulkAdd(toAdd);
    await syncProfileWeight();
  }
  return toAdd.length;
}
