import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayStr, type SessionEntry, type WorkoutSession, type WorkoutTemplate } from '../db';
import { checkOverload } from '../lib/overload';
import { useNav } from '../store';
import { Button, Card, ExerciseThumb, OverloadBadge, ScreenHeader } from '../components/ui';

export default function Session({ templateId }: { templateId: number }) {
  const back = useNav((s) => s.back);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [startedAt] = useState(() => new Date().toISOString());
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const pastSessions =
    useLiveQuery(() => db.sessions.orderBy('date').reverse().limit(50).toArray(), []) ?? [];

  useEffect(() => {
    db.templates.get(templateId).then(async (t) => {
      if (!t) return back();
      setTemplate(t);
      const past = await db.sessions.orderBy('date').reverse().limit(50).toArray();
      const allEx = await db.exercises.toArray();
      setEntries(
        t.exercises.map((te) => {
          // Son oturumdaki değerleri varsayılan olarak getir
          const last = past
            .filter((s) => s.finishedAt)
            .flatMap((s) => s.entries)
            .find((e) => e.exerciseId === te.exerciseId);
          const isCardio = allEx.find((e) => e.id === te.exerciseId)?.type === 'cardio';
          const sets = Array.from({ length: te.targetSets }, (_, i) => {
            const prev = last?.sets[i];
            if (isCardio) return { durationMin: prev?.durationMin ?? te.targetDurationMin };
            return {
              reps: undefined,
              weightKg: prev?.weightKg ?? te.startWeightKg,
            };
          });
          return { exerciseId: te.exerciseId, repMin: te.repMin, repMax: te.repMax, sets };
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const setVal = (ei: number, si: number, patch: Partial<SessionEntry['sets'][number]>) =>
    setEntries((prev) =>
      prev.map((e, i) =>
        i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e,
      ),
    );

  const addSet = (ei: number) =>
    setEntries((prev) =>
      prev.map((e, i) => (i === ei ? { ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1] }] } : e)),
    );

  const finish = async () => {
    if (!template) return;
    const cleaned = entries
      .map((e) => ({
        ...e,
        sets: e.sets.filter((s) => s.reps != null || s.durationMin != null),
      }))
      .filter((e) => e.sets.length > 0);
    if (cleaned.length === 0) {
      if (!confirm('Hiç set girilmedi. Çıkmak istiyor musun?')) return;
      return back();
    }
    const session: WorkoutSession = {
      templateId,
      templateName: template.name,
      date: todayStr(),
      startedAt,
      finishedAt: new Date().toISOString(),
      entries: cleaned,
    };
    await db.sessions.add(session);
    back();
  };

  if (!template) return null;

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader
        title={template.name}
        onBack={() => {
          if (confirm('Antrenmandan çıkılsın mı? Girilenler kaydedilmez.')) back();
        }}
        right={
          <Button className="!py-2" onClick={finish}>
            Bitir ✓
          </Button>
        }
      />
      <div className="space-y-3 px-4">
        {entries.map((entry, ei) => {
          const ex = exMap.get(entry.exerciseId);
          if (!ex) return null;
          const isCardio = ex.type === 'cardio';
          const overload = !isCardio ? checkOverload(pastSessions, entry.exerciseId) : { ready: false as const };
          return (
            <Card key={entry.exerciseId + ei} className="space-y-3">
              <div className="flex items-center gap-3">
                <ExerciseThumb ex={ex} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{ex.name}</div>
                  {!isCardio && (
                    <div className="text-xs text-slate-400">
                      Hedef: {entry.sets.length} set × {entry.repMin}–{entry.repMax} tekrar
                    </div>
                  )}
                </div>
              </div>
              {overload.ready && <OverloadBadge suggestedKg={overload.suggestedKg} />}
              <div className="space-y-2">
                {entry.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <div className="w-12 text-sm text-slate-400">Set {si + 1}</div>
                    {isCardio ? (
                      <label className="flex flex-1 items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={set.durationMin ?? ''}
                          onChange={(e) =>
                            setVal(ei, si, { durationMin: e.target.value === '' ? undefined : Number(e.target.value) })
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-center"
                        />
                        <span className="text-sm text-slate-400">dk</span>
                      </label>
                    ) : (
                      <>
                        <label className="flex flex-1 items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="—"
                            value={set.weightKg ?? ''}
                            onChange={(e) =>
                              setVal(ei, si, { weightKg: e.target.value === '' ? undefined : Number(e.target.value) })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-center"
                          />
                          <span className="text-xs text-slate-400">kg</span>
                        </label>
                        <label className="flex flex-1 items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="—"
                            value={set.reps ?? ''}
                            onChange={(e) =>
                              setVal(ei, si, { reps: e.target.value === '' ? undefined : Number(e.target.value) })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-center"
                          />
                          <span className="text-xs text-slate-400">tekrar</span>
                        </label>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button className="text-sm text-emerald-400 active:opacity-70" onClick={() => addSet(ei)}>
                + Set ekle
              </button>
            </Card>
          );
        })}
        <Button className="w-full" onClick={finish}>
          Antrenmanı Bitir ✓
        </Button>
      </div>
    </div>
  );
}
