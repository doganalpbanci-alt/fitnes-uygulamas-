import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TemplateExercise } from '../db';
import { useNav } from '../store';
import { Button, Card, ExerciseThumb, groupLabel, ScreenHeader } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';

export default function TemplateEditor({ id }: { id?: number }) {
  const back = useNav((s) => s.back);
  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [loaded, setLoaded] = useState(id == null);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  useEffect(() => {
    if (id == null) return;
    db.templates.get(id).then((t) => {
      if (t) {
        setName(t.name);
        setItems(t.exercises);
      }
      setLoaded(true);
    });
  }, [id]);

  const update = (i: number, patch: Partial<TemplateExercise>) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const move = (i: number, dir: -1 | 1) =>
    setItems((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    const tmpl = { name: name.trim() || 'Antrenman', exercises: items };
    if (id != null) await db.templates.update(id, tmpl);
    else await db.templates.add(tmpl);
    back();
  };

  const remove = async () => {
    if (id == null) return;
    if (!confirm('Bu antrenman silinsin mi? (Geçmiş kayıtlar silinmez)')) return;
    await db.templates.delete(id);
    const days = (await db.schedule.toArray()).filter((d) => d.templateId === id);
    for (const d of days) await db.schedule.put({ ...d, templateId: null });
    back();
  };

  if (!loaded) return null;

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader
        title={id != null ? 'Antrenmanı Düzenle' : 'Yeni Antrenman'}
        onBack={back}
        right={
          <Button className="!py-2" disabled={items.length === 0} onClick={save}>
            Kaydet
          </Button>
        }
      />
      <div className="space-y-3 px-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Antrenman adı (örn. İtiş Günü)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 font-semibold"
        />

        {items.map((it, i) => {
          const ex = exMap.get(it.exerciseId);
          if (!ex) return null;
          const isCardio = ex.type === 'cardio';
          return (
            <Card key={i} className="space-y-3">
              <div className="flex items-center gap-3">
                <ExerciseThumb ex={ex} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{ex.name}</div>
                  <div className="text-xs text-slate-400">{groupLabel(ex.muscleGroup)}</div>
                </div>
                <div className="flex gap-1 text-slate-400">
                  <button className="rounded p-1.5 active:bg-white/10" onClick={() => move(i, -1)}>↑</button>
                  <button className="rounded p-1.5 active:bg-white/10" onClick={() => move(i, 1)}>↓</button>
                  <button
                    className="rounded p-1.5 text-rose-400 active:bg-white/10"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {isCardio ? (
                <label className="block text-sm">
                  <span className="text-slate-400">Süre (dk)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={it.targetDurationMin ?? ''}
                    onChange={(e) =>
                      update(i, {
                        targetDurationMin: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                  />
                </label>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <label className="block">
                    <span className="text-xs text-slate-400">Set</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={it.targetSets}
                      onChange={(e) => update(i, { targetSets: Math.max(1, Number(e.target.value) || 1) })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Tekrar min</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={it.repMin}
                      onChange={(e) => update(i, { repMin: Math.max(1, Number(e.target.value) || 1) })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Tekrar max</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={it.repMax}
                      onChange={(e) => update(i, { repMax: Math.max(1, Number(e.target.value) || 1) })}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-400">Ağırlık kg</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={it.startWeightKg ?? ''}
                      onChange={(e) =>
                        update(i, {
                          startWeightKg: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2"
                    />
                  </label>
                </div>
              )}
            </Card>
          );
        })}

        <Button variant="secondary" className="w-full" onClick={() => setPicking(true)}>
          + Hareket Ekle
        </Button>

        {id != null && (
          <Button variant="danger" className="w-full" onClick={remove}>
            Antrenmanı Sil
          </Button>
        )}
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setItems((prev) => [
              ...prev,
              ex.type === 'cardio'
                ? { exerciseId: ex.id, targetSets: 1, repMin: 0, repMax: 0, targetDurationMin: 20 }
                : { exerciseId: ex.id, targetSets: 3, repMin: 8, repMax: 10 },
            ]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
