import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayStr, type SessionEntry, type WorkoutSession, type WorkoutTemplate } from '../db';
import { checkOverload } from '../lib/overload';
import { getExerciseRecords, lastSetPerformance } from '../lib/records';
import { unlockAudio, playBeep } from '../lib/beep';
import { fmtDuration } from '../lib/format';
import { useNav } from '../store';
import { Button, Card, ExerciseThumb, OverloadBadge, ScreenHeader } from '../components/ui';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const REST_OPTIONS = [30, 45, 60, 90];
const DEFAULT_REST_SECONDS = 60;

function loadRestSeconds(): number {
  const v = Number(localStorage.getItem('restSeconds'));
  return v > 0 ? v : DEFAULT_REST_SECONDS;
}

function RestTimerBar({ remaining, total, onSkip }: { remaining: number; total: number; onSkip: () => void }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? remaining / total : 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 animate-pop border-t border-white/10 bg-[#070a14]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
            <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="22"
              cy="22"
              r={r}
              fill="none"
              stroke="#34d399"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
            {remaining}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">😮‍💨 Dinleniyor…</div>
          <div className="text-xs text-slate-400">Sonraki sete {remaining} saniye kaldı</div>
        </div>
        <button
          onClick={onSkip}
          className="btn-tap shrink-0 rounded-lg bg-white/[0.07] px-3 py-2 text-sm font-semibold text-slate-200"
        >
          Atla
        </button>
      </div>
    </div>
  );
}

export default function Session({ templateId }: { templateId: number }) {
  const back = useNav((s) => s.back);
  const push = useNav((s) => s.push);
  const now = useNow();
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [confirmed, setConfirmed] = useState<boolean[][]>([]);
  const [startedAt] = useState(() => new Date().toISOString());
  const [restSeconds, setRestSeconds] = useState(loadRestSeconds);
  const [customRestOpen, setCustomRestOpen] = useState(false);
  const [restTotal, setRestTotal] = useState(restSeconds);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
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
      const nextEntries = t.exercises.map((te) => {
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
      });
      setEntries(nextEntries);
      setConfirmed(nextEntries.map((e) => e.sets.map(() => false)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

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
    setConfirmed((prev) => prev.map((row, i) => (i === ei ? [...row, false] : row)));
  };

  const removeSet = (ei: number, si: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)),
    );
    setConfirmed((prev) => prev.map((row, i) => (i === ei ? row.filter((_, j) => j !== si) : row)));
  };

  const toggleConfirm = (ei: number, si: number) => {
    const willConfirm = !(confirmed[ei]?.[si] ?? false);
    setConfirmed((prev) => prev.map((row, i) => (i === ei ? row.map((c, j) => (j === si ? !c : c)) : row)));
    if (willConfirm) {
      unlockAudio();
      setRestTotal(restSeconds);
      setRestRemaining(restSeconds);
    } else {
      setRestRemaining(null);
    }
  };

  const changeRestSeconds = (v: number) => {
    setRestSeconds(v);
    localStorage.setItem('restSeconds', String(v));
  };

  useEffect(() => {
    if (restRemaining == null) return;
    if (restRemaining <= 0) {
      playBeep();
      setRestRemaining(null);
      return;
    }
    const id = setTimeout(() => setRestRemaining((r) => (r == null ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [restRemaining]);

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
    const id = await db.sessions.add(session);
    push({ t: 'sessionSummary', sessionId: id });
  };

  if (!template) return null;
  const elapsed = now - new Date(startedAt).getTime();
  const restActive = restRemaining != null;

  return (
    <div className={restActive ? 'pb-24' : 'pb-[calc(env(safe-area-inset-bottom)+16px)]'}>
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
        <Card className="flex items-center justify-center gap-2 !py-2.5">
          <span className="text-slate-400">⏱️</span>
          <span className="text-lg font-bold tabular-nums">{fmtDuration(elapsed)}</span>
          <span className="text-xs text-slate-400">idman süresi</span>
        </Card>

        <Card className="space-y-2 !py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">😮‍💨 Setler arası dinlenme</span>
            <span className="text-sm font-bold">{restSeconds} sn</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REST_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  changeRestSeconds(s);
                  setCustomRestOpen(false);
                }}
                className={`btn-tap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  !customRestOpen && restSeconds === s
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-white/[0.06] text-slate-300'
                }`}
              >
                {s} sn
              </button>
            ))}
            <button
              onClick={() => setCustomRestOpen(true)}
              className={`btn-tap rounded-full px-3 py-1.5 text-xs font-semibold ${
                customRestOpen ? 'bg-emerald-500 text-slate-950' : 'bg-white/[0.06] text-slate-300'
              }`}
            >
              Özel
            </button>
            {customRestOpen && (
              <input
                type="number"
                inputMode="numeric"
                min={5}
                autoFocus
                placeholder="saniye"
                defaultValue={REST_OPTIONS.includes(restSeconds) ? '' : restSeconds}
                onChange={(e) => {
                  const v = Math.max(5, Number(e.target.value) || 5);
                  changeRestSeconds(v);
                }}
                className="w-24 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs"
              />
            )}
          </div>
        </Card>

        {entries.map((entry, ei) => {
          const ex = exMap.get(entry.exerciseId);
          if (!ex) return null;
          const isCardio = ex.type === 'cardio';
          const overload = !isCardio ? checkOverload(pastSessions, entry.exerciseId) : { ready: false as const };
          const records = getExerciseRecords(pastSessions, entry.exerciseId);
          const hasRecord = isCardio ? records.maxDurationMin != null : records.maxWeightKg != null || records.maxReps != null;
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
              <div className="flex flex-wrap gap-1.5">
                {overload.ready && <OverloadBadge suggestedKg={overload.suggestedKg} />}
                {hasRecord && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-gradient-to-r from-yellow-400/15 to-amber-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                    🥇{' '}
                    {isCardio
                      ? `Rekor: ${records.maxDurationMin} dk`
                      : [
                          records.maxWeightKg != null ? `${records.maxWeightKg} kg` : null,
                          records.maxReps != null ? `${records.maxReps} tekrar` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {entry.sets.map((set, si) => {
                  const isConfirmed = confirmed[ei]?.[si] ?? false;
                  const lastPerf = lastSetPerformance(pastSessions, entry.exerciseId, si);
                  const isWeightPR =
                    !isCardio && set.weightKg != null && records.maxWeightKg != null && set.weightKg > records.maxWeightKg;
                  const isRepsPR =
                    !isCardio && set.reps != null && records.maxReps != null && set.reps > records.maxReps;
                  const isNewRecord = isConfirmed && (isWeightPR || isRepsPR);
                  return (
                    <div key={si}>
                      <div
                        className={`flex items-center gap-2 rounded-xl p-1.5 ${
                          isNewRecord
                            ? 'bg-yellow-400/10 ring-1 ring-yellow-400/50'
                            : isConfirmed
                              ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40'
                              : ''
                        }`}
                      >
                        <div className="w-11 text-sm text-slate-400">Set {si + 1}</div>
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
                        <button
                          onClick={() => toggleConfirm(ei, si)}
                          aria-label={isConfirmed ? 'Onayı kaldır' : 'Seti onayla'}
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${
                            isNewRecord
                              ? 'bg-yellow-400 text-slate-950'
                              : isConfirmed
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-white/[0.07] text-slate-300'
                          }`}
                        >
                          {isNewRecord ? '🥇' : '✓'}
                        </button>
                        {entry.sets.length > 1 && (
                          <button
                            onClick={() => removeSet(ei, si)}
                            aria-label="Seti sil"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 active:bg-white/10"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="px-1.5 pt-0.5 text-xs text-slate-500">
                        {isNewRecord
                          ? '🎉 Yeni rekor!'
                          : lastPerf &&
                            (isCardio
                              ? lastPerf.durationMin != null && `Geçen sefer: ${lastPerf.durationMin} dk`
                              : (lastPerf.reps != null || lastPerf.weightKg != null) &&
                                `Geçen sefer: ${lastPerf.weightKg ?? '—'} kg × ${lastPerf.reps ?? '—'} tekrar`)}
                      </div>
                    </div>
                  );
                })}
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
      {restActive && (
        <RestTimerBar remaining={restRemaining} total={restTotal} onSkip={() => setRestRemaining(null)} />
      )}
    </div>
  );
}
