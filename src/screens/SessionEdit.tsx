import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise, type SessionEntry, type WorkoutSession } from '../db';
import { useNav } from '../store';
import { Button, Card, ExerciseThumb, ScreenHeader } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';

/** Tamamlanmış bir antrenmanı sonradan düzeltmeyi sağlar — uygulama arka planda kapanıp
 * antrenman verisi eksik/hatalı kaydolduğunda (ya da basitçe yanlış girildiğinde) elle
 * onarılabilsin diye. Set/hareket düzenleme, Session ekranındaki mantıkla aynı. */
export default function SessionEdit({ sessionId }: { sessionId: number }) {
  const back = useNav((s) => s.back);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [date, setDate] = useState('');
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  useEffect(() => {
    db.sessions.get(sessionId).then((s) => {
      if (!s) return back();
      setSession(s);
      setDate(s.date);
      setEntries(s.entries);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const setVal = (ei: number, si: number, patch: Partial<SessionEntry['sets'][number]>) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e,
      ),
    );

  const addSet = (ei: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === ei ? { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1] }] } : e)),
    );
  };

  const removeSet = (ei: number, si: number) => {
    setEntries((prev) => prev.map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)));
  };

  const removeExercise = (ei: number) => {
    if (!confirm('Bu hareket kayıttan kaldırılsın mı?')) return;
    setEntries((prev) => prev.filter((_, i) => i !== ei));
  };

  const swapExercise = (ei: number, ex: Exercise) => {
    const isCardio = ex.type === 'cardio';
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== ei) return e;
        const hadRange = e.repMin > 0 || e.repMax > 0;
        return {
          exerciseId: ex.id,
          repMin: isCardio ? 0 : hadRange ? e.repMin : 8,
          repMax: isCardio ? 0 : hadRange ? e.repMax : 12,
          sets: e.sets.map(() => (isCardio ? { durationMin: undefined } : { reps: undefined, weightKg: undefined })),
        };
      }),
    );
    setSwappingIndex(null);
  };

  const save = async () => {
    const cleaned = entries
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.reps != null || s.durationMin != null) }))
      .filter((e) => e.sets.length > 0);
    if (cleaned.length === 0) {
      if (!confirm('Hiç set kalmadı — bu antrenman kaydı tamamen silinsin mi?')) return;
      await db.sessions.delete(sessionId);
      return back();
    }
    await db.sessions.update(sessionId, { date, entries: cleaned });
    back();
  };

  const deleteSession = async () => {
    if (!confirm('Bu antrenman kaydı tamamen silinsin mi? Geri alınamaz.')) return;
    await db.sessions.delete(sessionId);
    back();
  };

  if (!session) return null;

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader
        title="Antrenmanı Düzenle"
        onBack={back}
        right={
          <Button className="!py-2" onClick={save}>
            Kaydet
          </Button>
        }
      />
      <div className="space-y-3 px-4">
        <Card className="space-y-2">
          <label className="block text-sm">
            <span className="text-slate-400">Tarih</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            />
          </label>
        </Card>

        {entries.map((entry, ei) => {
          const ex = exMap.get(entry.exerciseId);
          if (!ex) return null;
          const isCardio = ex.type === 'cardio';
          return (
            <Card key={entry.exerciseId + ei} className="space-y-3">
              <div className="flex items-center gap-3">
                <ExerciseThumb ex={ex} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{ex.name}</div>
                </div>
                <div className="flex shrink-0 gap-1 text-slate-400">
                  <button
                    onClick={() => setSwappingIndex(ei)}
                    aria-label="Hareketi değiştir"
                    className="rounded p-1.5 active:bg-white/10"
                  >
                    🔁
                  </button>
                  <button
                    onClick={() => removeExercise(ei)}
                    aria-label="Hareketi kaldır"
                    className="rounded p-1.5 text-rose-400 active:bg-white/10"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {entry.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <div className="w-11 shrink-0 text-sm text-slate-400">Set {si + 1}</div>
                    {isCardio ? (
                      <label className="flex flex-1 items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={set.durationMin ?? ''}
                          onChange={(e) =>
                            setVal(ei, si, {
                              durationMin: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center"
                        />
                        <span className="text-sm text-slate-400">dk</span>
                      </label>
                    ) : (
                      <>
                        <label className="flex flex-1 items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="—"
                            value={set.reps ?? ''}
                            onChange={(e) =>
                              setVal(ei, si, {
                                reps: e.target.value === '' ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center"
                          />
                          <span className="text-xs text-slate-400">tekrar</span>
                        </label>
                        <label className="flex flex-1 items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            placeholder="—"
                            value={set.weightKg ?? ''}
                            onChange={(e) =>
                              setVal(ei, si, {
                                weightKg: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center"
                          />
                          <span className="text-xs text-slate-400">kg</span>
                        </label>
                      </>
                    )}
                    {entry.sets.length > 1 && (
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="shrink-0 rounded p-1.5 text-slate-500 active:bg-white/10"
                        aria-label="Seti kaldır"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => addSet(ei)} className="text-sm font-semibold text-emerald-400">
                + Set Ekle
              </button>
            </Card>
          );
        })}

        <Button variant="danger" className="w-full" onClick={deleteSession}>
          Antrenman Kaydını Sil
        </Button>
      </div>

      {swappingIndex != null && (
        <ExercisePicker
          title="Hareketi Değiştir"
          onClose={() => setSwappingIndex(null)}
          onPick={(ex) => swapExercise(swappingIndex, ex)}
        />
      )}
    </div>
  );
}
