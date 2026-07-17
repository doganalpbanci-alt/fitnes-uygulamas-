import type { SetEntry, WorkoutSession } from '../db';

export interface ExerciseRecords {
  maxWeightKg: number | null;
  maxReps: number | null;
  maxDurationMin: number | null;
}

/** Bir hareketin tüm zamanların rekorları: en yüksek ağırlık, en yüksek tekrar, en uzun süre (kardiyo). */
export function getExerciseRecords(sessions: WorkoutSession[], exerciseId: string): ExerciseRecords {
  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let maxDurationMin: number | null = null;
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    for (const set of entry.sets) {
      if (set.weightKg != null && (maxWeightKg == null || set.weightKg > maxWeightKg)) maxWeightKg = set.weightKg;
      if (set.reps != null && (maxReps == null || set.reps > maxReps)) maxReps = set.reps;
      if (set.durationMin != null && (maxDurationMin == null || set.durationMin > maxDurationMin))
        maxDurationMin = set.durationMin;
    }
  }
  return { maxWeightKg, maxReps, maxDurationMin };
}

/**
 * Bir hareketin belirli bir set index'inde en son (en yeni tamamlanmış oturumdaki)
 * performansını döndürür. `sessions` en yeniden en eskiye sıralı olmalı.
 */
export function lastSetPerformance(
  sessions: WorkoutSession[],
  exerciseId: string,
  setIndex: number,
): SetEntry | null {
  for (const s of sessions) {
    if (!s.finishedAt) continue;
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (entry?.sets[setIndex]) return entry.sets[setIndex];
  }
  return null;
}
