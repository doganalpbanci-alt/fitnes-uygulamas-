import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { checkOverload } from '../lib/overload';
import { summarizeSession } from '../lib/workoutStats';
import { computeOverallStats } from '../lib/progressStats';
import { getExerciseRecords } from '../lib/records';
import { fmtDate, fmtKg } from '../lib/format';
import { useNav } from '../store';
import { Card, ExerciseThumb, OverloadBadge, ScreenHeader, groupLabel } from '../components/ui';
import { BodyHeatmap } from '../components/BodyHeatmap';

export function LineChart({ points, unit }: { points: { x: string; y: number }[]; unit: string }) {
  if (points.length === 0) return null;
  const w = 320;
  const h = 120;
  const pad = 8;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const px = (i: number) => (points.length === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (points.length - 1));
  const py = (y: number) => h - pad - ((y - min) * (h - 2 * pad)) / span;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={path} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={px(i)} cy={py(p.y)} r="3.5" fill="#34d399" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{fmtDate(points[0].x)}</span>
        <span>
          {min === max ? '' : `${min}–`}
          {max} {unit}
        </span>
        <span>{fmtDate(points[points.length - 1].x)}</span>
      </div>
    </div>
  );
}

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const back = useNav((s) => s.back);
  const ex = useLiveQuery(() => db.exercises.get(exerciseId), [exerciseId]);
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), []) ?? [];

  const history = useMemo(
    () =>
      sessions
        .filter((s) => s.finishedAt)
        .map((s) => {
          const entry = s.entries.find((e) => e.exerciseId === exerciseId);
          if (!entry || entry.sets.length === 0) return null;
          const maxW = Math.max(...entry.sets.map((set) => set.weightKg ?? 0));
          const volume = entry.sets.reduce((acc, set) => acc + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
          const duration = entry.sets.reduce((acc, set) => acc + (set.durationMin ?? 0), 0);
          return { date: s.date, entry, maxW, volume, duration };
        })
        .filter((x) => x != null),
    [sessions, exerciseId],
  );

  if (!ex) return null;
  const isCardio = ex.type === 'cardio';
  const newestFirst = [...sessions].reverse();
  const overload = !isCardio ? checkOverload(newestFirst, exerciseId) : { ready: false as const };
  const records = getExerciseRecords(newestFirst, exerciseId);
  const hasRecord = isCardio ? records.maxDurationMin != null : records.maxWeightKg != null || records.maxReps != null;

  return (
    <div className="pb-4">
      <ScreenHeader title={ex.name} onBack={back} />
      <div className="space-y-3 px-4">
        <Card className="flex items-center gap-3">
          <ExerciseThumb ex={ex} size={64} />
          <div className="flex-1">
            <div className="text-sm text-slate-400">{groupLabel(ex.muscleGroup)}</div>
            {overload.ready && (
              <div className="mt-1">
                <OverloadBadge suggestedKg={overload.suggestedKg} />
              </div>
            )}
          </div>
        </Card>

        {hasRecord && (
          <div className="grid grid-cols-2 gap-2">
            {isCardio ? (
              <Card className="col-span-2 flex items-center gap-3">
                <div className="text-2xl">🥇</div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Rekor Süre</div>
                  <div className="text-lg font-bold">{records.maxDurationMin} dk</div>
                </div>
              </Card>
            ) : (
              <>
                {records.maxWeightKg != null && (
                  <Card className="flex items-center gap-3">
                    <div className="text-2xl">🥇</div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Rekor Ağırlık</div>
                      <div className="text-lg font-bold">{fmtKg(records.maxWeightKg)}</div>
                    </div>
                  </Card>
                )}
                {records.maxReps != null && (
                  <Card className="flex items-center gap-3">
                    <div className="text-2xl">🥇</div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Rekor Tekrar</div>
                      <div className="text-lg font-bold">{records.maxReps}</div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {history.length === 0 ? (
          <Card className="text-sm text-slate-400">Henüz kayıt yok.</Card>
        ) : isCardio ? (
          <Card>
            <div className="mb-2 text-sm font-semibold text-slate-300">Süre (dk)</div>
            <LineChart points={history.map((hp) => ({ x: hp.date, y: hp.duration }))} unit="dk" />
          </Card>
        ) : (
          <>
            <Card>
              <div className="mb-2 text-sm font-semibold text-slate-300">En yüksek ağırlık (kg)</div>
              <LineChart points={history.map((hp) => ({ x: hp.date, y: hp.maxW }))} unit="kg" />
            </Card>
            <Card>
              <div className="mb-2 text-sm font-semibold text-slate-300">Toplam hacim (set × tekrar × kg)</div>
              <LineChart points={history.map((hp) => ({ x: hp.date, y: hp.volume }))} unit="kg" />
            </Card>
          </>
        )}

        <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Oturum geçmişi</div>
        {[...history].reverse().map((hp, i) => (
          <Card key={i} className="py-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{fmtDate(hp.date)}</span>
              {!isCardio && <span className="text-slate-400">maks {fmtKg(hp.maxW)}</span>}
            </div>
            <div className="text-sm text-slate-300">
              {isCardio
                ? `${hp.duration} dk`
                : hp.entry.sets.map((s, j) => (
                    <span key={j} className="mr-2 inline-block rounded bg-white/[0.08] px-1.5 py-0.5 text-xs">
                      {s.weightKg ?? 0}kg×{s.reps ?? 0}
                    </span>
                  ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Progress() {
  const push = useNav((s) => s.push);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), []) ?? [];

  const tracked = useMemo(() => {
    const ids = new Set(sessions.filter((s) => s.finishedAt).flatMap((s) => s.entries.map((e) => e.exerciseId)));
    return exercises
      .filter((e) => ids.has(e.id))
      .map((e) => ({ ex: e, overload: e.type === 'resistance' ? checkOverload(sessions, e.id) : { ready: false as const, streak: 0 } }))
      .sort((a, b) => Number(b.overload.ready) - Number(a.overload.ready));
  }, [exercises, sessions]);

  const suggestions = tracked.filter((t) => t.overload.ready);

  const finishedSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.finishedAt)
        .sort((a, b) => new Date(b.finishedAt!).getTime() - new Date(a.finishedAt!).getTime()),
    [sessions],
  );

  const stats = useMemo(() => computeOverallStats(sessions, exercises), [sessions, exercises]);

  return (
    <div className="pb-4">
      <ScreenHeader title="İlerleme" />
      <div className="space-y-3 px-4">
        {stats.totalSessions > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <Card className="text-center">
              <div className="bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-2xl font-extrabold text-transparent">
                {stats.totalSessions}
              </div>
              <div className="text-xs text-slate-400">antrenman</div>
            </Card>
            <Card className="text-center">
              <div className="bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-2xl font-extrabold text-transparent">
                {Math.round(stats.totalDurationMin / 60)}
              </div>
              <div className="text-xs text-slate-400">saat</div>
            </Card>
            <Card className="text-center">
              <div className="bg-gradient-to-br from-emerald-300 to-emerald-500 bg-clip-text text-2xl font-extrabold text-transparent">
                {Math.round(stats.totalVolumeKg / 1000)}
              </div>
              <div className="text-xs text-slate-400">ton hacim</div>
            </Card>
          </div>
        )}

        {stats.favorite && (
          <Card
            className="flex items-center gap-3"
            onClick={() => push({ t: 'exerciseDetail', exerciseId: stats.favorite!.exercise.id })}
          >
            <div className="text-2xl">⭐</div>
            <ExerciseThumb ex={stats.favorite.exercise} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">Favori Hareketin</div>
              <div className="truncate font-bold">{stats.favorite.exercise.name}</div>
              <div className="text-xs text-slate-400">
                {stats.favorite.sessionCount} antrenman · {stats.favorite.setCount} set
              </div>
            </div>
            <span className="text-slate-500">›</span>
          </Card>
        )}

        <Card>
          <div className="mb-1 font-semibold">Bölge Yoğunluğu</div>
          <div className="mb-3 text-xs text-slate-400">Toplam hacme göre en çok çalıştığın bölgeler parlıyor</div>
          <BodyHeatmap groupVolume={stats.groupVolume} />
        </Card>

        {suggestions.length > 0 && (
          <Card className="border-amber-400/30 bg-amber-400/5">
            <div className="mb-1 font-semibold text-amber-300">🎯 Progressive Overload</div>
            <div className="text-sm text-slate-300">
              {suggestions.length} harekette art arda 3 antrenmandır hedef tekrar aralığındasın — ağırlığı
              artırabilirsin.
            </div>
          </Card>
        )}
        {tracked.length === 0 ? (
          <Card className="text-sm text-slate-400">
            İlk antrenmanını kaydettikten sonra hareket bazında ilerleme grafiklerin burada görünecek.
          </Card>
        ) : (
          tracked.map(({ ex, overload }) => (
            <Card key={ex.id} className="flex items-center gap-3 py-2.5" onClick={() => push({ t: 'exerciseDetail', exerciseId: ex.id })}>
              <ExerciseThumb ex={ex} size={48} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{ex.name}</div>
                {'suggestedKg' in overload && overload.ready ? (
                  <OverloadBadge suggestedKg={overload.suggestedKg} />
                ) : (
                  <div className="text-xs text-slate-400">{groupLabel(ex.muscleGroup)}</div>
                )}
              </div>
              <span className="text-slate-500">›</span>
            </Card>
          ))
        )}

        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Geçmiş Antrenmanlarım</div>
          {finishedSessions.length === 0 ? (
            <Card className="text-sm text-slate-400">Henüz tamamlanmış antrenman yok.</Card>
          ) : (
            <div className="space-y-2">
              {finishedSessions.slice(0, 30).map((s) => {
                const stats = summarizeSession(s, exercises);
                return (
                  <Card
                    key={s.id}
                    className="flex items-center justify-between py-2.5"
                    onClick={() => push({ t: 'sessionSummary', sessionId: s.id! })}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.templateName}</div>
                      <div className="text-xs text-slate-400">
                        {fmtDate(s.date)} · {stats.durationMin} dk · {stats.totalSets} set ·{' '}
                        {Math.round(stats.totalVolumeKg)} kg hacim
                      </div>
                    </div>
                    <span className="text-slate-500">›</span>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
