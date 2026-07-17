import type { Exercise, WorkoutSession } from '../db';

export interface MuscleGroupVolume {
  group: string;
  volumeKg: number;
}

export interface SessionSummary {
  durationMin: number;
  totalSets: number;
  totalVolumeKg: number;
  totalCardioMin: number;
  byMuscleGroup: MuscleGroupVolume[];
}

export function summarizeSession(session: WorkoutSession, exercises: Exercise[]): SessionSummary {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  let totalSets = 0;
  let totalVolumeKg = 0;
  let totalCardioMin = 0;
  const groupVolume = new Map<string, number>();

  for (const entry of session.entries) {
    const ex = exMap.get(entry.exerciseId);
    for (const set of entry.sets) {
      totalSets++;
      if (set.durationMin != null) totalCardioMin += set.durationMin;
      if (set.weightKg != null && set.reps != null) {
        const vol = set.weightKg * set.reps;
        totalVolumeKg += vol;
        if (ex) groupVolume.set(ex.muscleGroup, (groupVolume.get(ex.muscleGroup) ?? 0) + vol);
      }
    }
  }

  const durationMin = session.finishedAt
    ? Math.max(1, Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000))
    : 0;

  const byMuscleGroup = [...groupVolume.entries()]
    .map(([group, volumeKg]) => ({ group, volumeKg }))
    .sort((a, b) => b.volumeKg - a.volumeKg);

  return { durationMin, totalSets, totalVolumeKg, totalCardioMin, byMuscleGroup };
}
