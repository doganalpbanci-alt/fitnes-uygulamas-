import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { summarizeSession } from '../lib/workoutStats';
import { fmtDate, fmtKg } from '../lib/format';
import { useNav } from '../store';
import { Card, ExerciseThumb, ScreenHeader, groupLabel } from '../components/ui';

export default function WorkoutSummary({ sessionId }: { sessionId: number }) {
  const back = useNav((s) => s.back);
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = new Map(exercises.map((e) => [e.id, e]));

  if (!session) return null;
  const stats = summarizeSession(session, exercises);
  const maxGroupVol = Math.max(1, ...stats.byMuscleGroup.map((g) => g.volumeKg));

  return (
    <div className="pb-4">
      <ScreenHeader title="Antrenman Özeti" onBack={back} />
      <div className="space-y-3 px-4">
        <Card>
          <div className="text-lg font-bold">{session.templateName}</div>
          <div className="text-sm text-slate-400">{fmtDate(session.date)}</div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.durationMin}</div>
            <div className="text-xs text-slate-400">dakika</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats.totalSets}</div>
            <div className="text-xs text-slate-400">set</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{Math.round(stats.totalVolumeKg)}</div>
            <div className="text-xs text-slate-400">kg hacim</div>
          </Card>
        </div>

        {stats.totalCardioMin > 0 && (
          <Card className="text-sm text-slate-300">
            🏃 Kardiyo: <b>{stats.totalCardioMin} dk</b>
          </Card>
        )}

        {stats.byMuscleGroup.length > 0 && (
          <Card className="space-y-2">
            <div className="font-semibold">Bölge bazında hacim</div>
            {stats.byMuscleGroup.map((g) => (
              <div key={g.group}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{groupLabel(g.group)}</span>
                  <span className="text-slate-400">{fmtKg(Math.round(g.volumeKg))}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(g.volumeKg / maxGroupVol) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </Card>
        )}

        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Hareketler</div>
          <div className="space-y-2">
            {session.entries.map((entry, i) => {
              const ex = exMap.get(entry.exerciseId);
              if (!ex) return null;
              return (
                <Card key={i} className="flex items-center gap-3 py-2.5">
                  <ExerciseThumb ex={ex} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{ex.name}</div>
                    <div className="text-xs text-slate-300">
                      {ex.type === 'cardio'
                        ? entry.sets.map((s) => `${s.durationMin ?? 0} dk`).join(' · ')
                        : entry.sets.map((s) => `${s.weightKg ?? 0}kg×${s.reps ?? 0}`).join(' · ')}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
