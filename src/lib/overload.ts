import type { WorkoutSession } from '../db';

export interface OverloadResult {
  ready: boolean;
  /** Öneri verilen mevcut ağırlık */
  weightKg?: number;
  suggestedKg?: number;
  /** Kuralı sağlayan ardışık oturum sayısı */
  streak: number;
}

export function weightIncrement(): number {
  const v = Number(localStorage.getItem('weightIncrementKg'));
  return v > 0 ? v : 2.5;
}

/**
 * Progressive overload kuralı: aynı hareket, arka arkaya `needed` antrenmanda,
 * aynı ağırlıkla, HER sette repMin–repMax tekrar aralığına ulaşıldıysa
 * ağırlık artırma önerisi ver.
 *
 * `sessions` tarihe göre YENİDEN ESKİYE sıralı olmalı.
 */
export function checkOverload(
  sessions: WorkoutSession[],
  exerciseId: string,
  needed = 3,
): OverloadResult {
  const relevant = sessions
    .filter((s) => s.finishedAt && s.entries.some((e) => e.exerciseId === exerciseId && e.sets.length > 0))
    .slice(0, needed);

  if (relevant.length < needed) return { ready: false, streak: 0 };

  let weight: number | undefined;
  let streak = 0;

  for (const s of relevant) {
    const entry = s.entries.find((e) => e.exerciseId === exerciseId)!;
    const sets = entry.sets.filter((set) => set.reps != null);
    if (sets.length === 0) return { ready: false, streak };

    const w = sets[0].weightKg;
    if (w == null) return { ready: false, streak };
    if (weight == null) weight = w;
    if (w !== weight) return { ready: false, streak };

    const allInRange = sets.every(
      (set) =>
        set.weightKg === weight &&
        set.reps! >= entry.repMin &&
        set.reps! <= entry.repMax,
    );
    if (!allInRange) return { ready: false, streak };
    streak++;
  }

  return {
    ready: true,
    weightKg: weight,
    suggestedKg: weight! + weightIncrement(),
    streak,
  };
}
