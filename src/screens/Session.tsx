import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  todayStr,
  type Exercise,
  type SessionEntry,
  type TemplateExercise,
  type WorkoutSession,
  type WorkoutTemplate,
} from '../db';
import { checkOverload } from '../lib/overload';
import { getExerciseRecords, lastSetPerformance } from '../lib/records';
import { unlockAudio, playBeep } from '../lib/beep';
import { fmtDuration } from '../lib/format';
import { useNav } from '../store';
import { Button, Card, ExerciseThumb, OverloadBadge, ScreenHeader } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    // Ekran kapanıp/arka plana alınıp geri dönüldüğünde tarayıcı setInterval'ı
    // askıya alıyor; sekme tekrar görünür olduğu anda saati hemen güncel değere
    // atlat, bir sonraki 1 sn'lik tick'i beklemeden doğru süre görünsün.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
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

/** Antrenman sırasında hareket değiştirilmiş/kaldırılmışsa, bitirirken rutinin kalıcı olarak
 * güncellensin mi yoksa bu seferlik mi kullanılsın diye sorar. */
function RoutineChangeDialog({
  templateName,
  onKeepUpdated,
  onKeepOriginal,
  onCancel,
}: {
  templateName: string;
  onKeepUpdated: () => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm space-y-3 rounded-t-2xl border border-white/10 bg-[#0b0f1c] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:rounded-2xl sm:pb-5">
        <div className="text-lg font-bold">Hareketler değişti</div>
        <div className="text-sm text-slate-400">
          "{templateName}" rutininde bu antrenman sırasında değişiklik yaptın. Bu yeni hâli rutine kalıcı
          olarak kaydedeyim mi, yoksa önceki rutin aynı kalsın mı?
        </div>
        <div className="space-y-2 pt-1">
          <Button className="w-full" onClick={onKeepUpdated}>
            Rutini Bu Hâliyle Güncelle
          </Button>
          <Button variant="secondary" className="w-full" onClick={onKeepOriginal}>
            Hayır, Önceki Rutini Koru
          </Button>
          <button onClick={onCancel} className="w-full py-1.5 text-center text-sm text-slate-500">
            Vazgeç
          </button>
        </div>
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
  // Taslaktan devam ediliyorsa gerçek başlangıç zamanı yüklenene kadar null kalır — bu yüzden
  // sabit bir başlangıç değeriyle (ör. Date.now()) başlatılmıyor.
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [restSeconds, setRestSeconds] = useState(loadRestSeconds);
  const [customRestOpen, setCustomRestOpen] = useState(false);
  const [restTotal, setRestTotal] = useState(restSeconds);
  // Kalan saniyeyi azaltarak saymak yerine bitiş zaman damgasını saklıyoruz: ekran
  // kapanınca/uygulama arka plana alınınca tarayıcı setTimeout zincirini durdurabiliyor,
  // bu da sayacın donmasına yol açıyordu. Bitişi mutlak zamana sabitleyip kalan süreyi her
  // an gerçek saatten türetince (aşağıda restRemaining), arka plandan dönüldüğünde sayaç
  // gerçekte geçen süreyi anında yansıtıyor.
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  // Antrenman sırasında bir hareket değiştiriliyorsa hangi satırın (index) değiştirileceğini tutar.
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [showRoutineDialog, setShowRoutineDialog] = useState(false);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const pastSessions =
    useLiveQuery(() => db.sessions.orderBy('date').reverse().limit(50).toArray(), []) ?? [];

  useEffect(() => {
    db.templates.get(templateId).then(async (t) => {
      if (!t) return back();

      // Uygulama arka planda kapanıp yeniden açılmışsa (Android'de düşük bellekte sık
      // yaşanır) bir taslak kalmış olabilir. Aynı şablona aitse kaldığı yerden devam et;
      // başka bir antrenmana aitse kullanıcıya sorup onay almadan sessizce silmiyoruz —
      // aksi hâlde tam da önlemeye çalıştığımız veri kaybını biz yaratmış oluruz.
      const draft = await db.activeSessionDraft.get(1);
      if (draft) {
        if (draft.templateId === templateId) {
          setTemplate(t);
          setEntries(draft.entries);
          setConfirmed(draft.confirmed);
          setStartedAt(draft.startedAt);
          setRestoredFromDraft(true);
          return;
        }
        const discard = confirm(
          `Bitirilmemiş "${draft.templateName}" antrenmanı var. Bu taslak silinip yeni antrenmana başlanılsın mı?`,
        );
        if (!discard) return back();
        await db.activeSessionDraft.delete(1);
      }

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
      setStartedAt(new Date().toISOString());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Devam eden antrenmanı her değişiklikte taslak olarak kaydet — uygulama arka planda
  // kapanıp yeniden açılsa bile Workout sekmesinden kaldığı yerden devam edilebilsin.
  useEffect(() => {
    if (!template || !startedAt) return;
    const id = setTimeout(() => {
      if (entries.length === 0) {
        db.activeSessionDraft.delete(1);
        return;
      }
      db.activeSessionDraft.put({
        id: 1,
        templateId,
        templateName: template.name,
        startedAt,
        entries,
        confirmed,
        updatedAt: new Date().toISOString(),
      });
    }, 400);
    return () => clearTimeout(id);
  }, [template, templateId, startedAt, entries, confirmed]);

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

  /** Bir hareketi antrenman sırasında başka bir hareketle değiştirir. Girilmiş set değerleri
   * yeni hareket için anlamlı olmadığından temizlenir, set sayısı korunur. */
  const swapExercise = (ei: number, ex: Exercise) => {
    const isCardio = ex.type === 'cardio';
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== ei) return e;
        // Kardiyodan direnç hareketine geçildiyse (repMin/repMax 0 gelir) makul bir varsayılana dön.
        const hadRange = e.repMin > 0 || e.repMax > 0;
        return {
          exerciseId: ex.id,
          repMin: isCardio ? 0 : hadRange ? e.repMin : 8,
          repMax: isCardio ? 0 : hadRange ? e.repMax : 12,
          sets: e.sets.map(() => (isCardio ? { durationMin: undefined } : { reps: undefined, weightKg: undefined })),
        };
      }),
    );
    setConfirmed((prev) => prev.map((row, i) => (i === ei ? row.map(() => false) : row)));
    setSwappingIndex(null);
  };

  const removeExercise = (ei: number) => {
    if (!confirm('Bu hareket antrenmandan kaldırılsın mı? Girilen setler silinecek.')) return;
    setEntries((prev) => prev.filter((_, i) => i !== ei));
    setConfirmed((prev) => prev.filter((_, i) => i !== ei));
  };

  const toggleConfirm = (ei: number, si: number) => {
    const willConfirm = !(confirmed[ei]?.[si] ?? false);
    setConfirmed((prev) => prev.map((row, i) => (i === ei ? row.map((c, j) => (j === si ? !c : c)) : row)));
    if (willConfirm) {
      unlockAudio();
      setRestTotal(restSeconds);
      setRestEndAt(Date.now() + restSeconds * 1000);
    } else {
      setRestEndAt(null);
    }
  };

  const changeRestSeconds = (v: number) => {
    setRestSeconds(v);
    localStorage.setItem('restSeconds', String(v));
  };

  // Kalan süre, azaltılan bir sayaç değil, bitiş zaman damgası ile şu anki gerçek saat
  // arasındaki farktan hesaplanıyor — bu yüzden arka planda geçen süre de doğru sayılıyor.
  const restRemaining = restEndAt != null ? Math.max(0, Math.ceil((restEndAt - now) / 1000)) : null;

  useEffect(() => {
    if (restEndAt != null && restRemaining === 0) {
      playBeep();
      setRestEndAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restRemaining, restEndAt]);

  const getCleaned = () =>
    entries
      .map((e) => ({
        ...e,
        sets: e.sets.filter((s) => s.reps != null || s.durationMin != null),
      }))
      .filter((e) => e.sets.length > 0);

  /** Antrenman sırasında hareket değiştirilmiş ya da kaldırılmışsa true döner — bitirirken
   * kullanıcıya rutini güncellemek isteyip istemediği sorulur. */
  const routineChanged = () => {
    if (!template) return false;
    const origIds = template.exercises.map((te) => te.exerciseId);
    const curIds = entries.map((e) => e.exerciseId);
    if (origIds.length !== curIds.length) return true;
    return origIds.some((id, i) => id !== curIds[i]);
  };

  /** Bu antrenumdaki güncel hareket/set/ağırlık bilgilerinden yeni bir şablon listesi türetir —
   * kullanıcı "rutini güncelle" derse bu, sonraki antrenmanların varsayılanı olur. */
  const buildUpdatedTemplateExercises = (): TemplateExercise[] =>
    entries.map((e, ei) => {
      const isCardio = exMap.get(e.exerciseId)?.type === 'cardio';
      // Setler bu oturumda dokunulmamış olsa bile önceki oturumdan/varsayılandan gelen bir
      // ağırlık/süre taşıyabilir (satırlar boş görünse de önceden dolduruluyor). Bu yüzden
      // "en son" değeri, ✓ ile açıkça onaylanmış setler arasından seçiyoruz — hiç set
      // onaylanmadıysa (ör. sadece hareket değiştirilip hiç girdi yapılmadıysa) mevcut
      // değerlere düşüyoruz.
      const confirmedSets = e.sets.filter((_, si) => confirmed[ei]?.[si]);
      const source = confirmedSets.length ? confirmedSets : e.sets;
      if (isCardio) {
        const lastDuration = [...source].reverse().find((s) => s.durationMin != null)?.durationMin;
        return { exerciseId: e.exerciseId, targetSets: 1, repMin: 0, repMax: 0, targetDurationMin: lastDuration };
      }
      const lastWeight = [...source].reverse().find((s) => s.weightKg != null)?.weightKg;
      return {
        exerciseId: e.exerciseId,
        targetSets: e.sets.length || 1,
        repMin: e.repMin,
        repMax: e.repMax,
        startWeightKg: lastWeight,
      };
    });

  const saveSession = async (cleaned: SessionEntry[]) => {
    if (!template || !startedAt) return;
    const session: WorkoutSession = {
      templateId,
      templateName: template.name,
      date: todayStr(),
      startedAt,
      finishedAt: new Date().toISOString(),
      entries: cleaned,
    };
    const id = await db.sessions.add(session);
    await db.activeSessionDraft.delete(1);
    push({ t: 'sessionSummary', sessionId: id });
  };

  const finish = async () => {
    if (!template) return;
    const cleaned = getCleaned();
    if (cleaned.length === 0) {
      if (!confirm('Hiç set girilmedi. Çıkmak istiyor musun?')) return;
      return back();
    }
    if (routineChanged()) {
      setShowRoutineDialog(true);
      return;
    }
    await saveSession(cleaned);
  };

  const confirmKeepUpdatedRoutine = async () => {
    await db.templates.update(templateId, { exercises: buildUpdatedTemplateExercises() });
    setShowRoutineDialog(false);
    await saveSession(getCleaned());
  };

  const confirmKeepOriginalRoutine = async () => {
    setShowRoutineDialog(false);
    await saveSession(getCleaned());
  };

  if (!template || !startedAt) return null;
  const elapsed = now - new Date(startedAt).getTime();
  const restActive = restRemaining != null;

  return (
    <div className={restActive ? 'pb-24' : 'pb-[calc(env(safe-area-inset-bottom)+16px)]'}>
      <ScreenHeader
        title={template.name}
        onBack={() => {
          if (confirm('Antrenmandan çıkılsın mı? Girilenler kaydedilmez.')) {
            db.activeSessionDraft.delete(1);
            back();
          }
        }}
        right={
          <Button className="!py-2" onClick={finish}>
            Bitir ✓
          </Button>
        }
      />
      <div className="space-y-3 px-4">
        {restoredFromDraft && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-center text-xs text-emerald-300">
            ✓ Kaldığın yerden devam ediyorsun
          </div>
        )}
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
        <RestTimerBar remaining={restRemaining} total={restTotal} onSkip={() => setRestEndAt(null)} />
      )}

      {swappingIndex != null && (
        <ExercisePicker
          title="Hareketi Değiştir"
          onClose={() => setSwappingIndex(null)}
          onPick={(ex) => swapExercise(swappingIndex, ex)}
        />
      )}

      {showRoutineDialog && (
        <RoutineChangeDialog
          templateName={template.name}
          onKeepUpdated={confirmKeepUpdatedRoutine}
          onKeepOriginal={confirmKeepOriginalRoutine}
          onCancel={() => setShowRoutineDialog(false)}
        />
      )}
    </div>
  );
}
