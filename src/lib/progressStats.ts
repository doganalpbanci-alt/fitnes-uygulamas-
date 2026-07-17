import type { Exercise, MuscleGroup, WorkoutSession } from '../db';

export interface FavoriteExercise {
  exercise: Exercise;
  setCount: number;
  sessionCount: number;
}

export interface OverallStats {
  totalSessions: number;
  totalDurationMin: number;
  totalVolumeKg: number;
  totalCardioMin: number;
  favorite: FavoriteExercise | null;
  groupVolume: Partial<Record<MuscleGroup, number>>;
}

export function computeOverallStats(sessions: WorkoutSession[], exercises: Exercise[]): OverallStats {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const finished = sessions.filter((s) => s.finishedAt);

  let totalDurationMin = 0;
  let totalVolumeKg = 0;
  let totalCardioMin = 0;
  const groupVolume: Partial<Record<MuscleGroup, number>> = {};
  const setCounts = new Map<string, number>();
  const sessionSets = new Map<string, Set<number>>();

  finished.forEach((s, sessionIdx) => {
    if (s.finishedAt) {
      totalDurationMin += Math.max(
        0,
        Math.round((new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()) / 60000),
      );
    }
    for (const entry of s.entries) {
      const ex = exMap.get(entry.exerciseId);
      if (entry.sets.length > 0) {
        setCounts.set(entry.exerciseId, (setCounts.get(entry.exerciseId) ?? 0) + entry.sets.length);
        if (!sessionSets.has(entry.exerciseId)) sessionSets.set(entry.exerciseId, new Set());
        sessionSets.get(entry.exerciseId)!.add(sessionIdx);
      }
      for (const set of entry.sets) {
        if (set.durationMin != null) totalCardioMin += set.durationMin;
        if (set.weightKg != null && set.reps != null) {
          const vol = set.weightKg * set.reps;
          totalVolumeKg += vol;
          if (ex) groupVolume[ex.muscleGroup] = (groupVolume[ex.muscleGroup] ?? 0) + vol;
        }
      }
    }
  });

  let favorite: FavoriteExercise | null = null;
  for (const [exerciseId, setCount] of setCounts) {
    const ex = exMap.get(exerciseId);
    if (!ex) continue;
    if (!favorite || setCount > favorite.setCount) {
      favorite = { exercise: ex, setCount, sessionCount: sessionSets.get(exerciseId)?.size ?? 0 };
    }
  }

  return {
    totalSessions: finished.length,
    totalDurationMin,
    totalVolumeKg,
    totalCardioMin,
    favorite,
    groupVolume,
  };
}
