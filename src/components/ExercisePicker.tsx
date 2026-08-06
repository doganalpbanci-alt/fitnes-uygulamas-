import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../db';
import { Button, Card, ExerciseThumb, ScreenHeader, groupLabel } from './ui';

/** Hareket kütüphanesinden arayarak/kas grubuna göre süzerek seçim yapılan, gerekirse özel
 * hareket eklenebilen paylaşılan ekran — hem antrenman şablonu düzenlerken hem de antrenman
 * sırasında bir hareketi değiştirirken kullanılır. */
export default function ExercisePicker({
  title = 'Hareket Seç',
  onPick,
  onClose,
}: {
  title?: string;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [q, setQ] = useState('');
  const [customName, setCustomName] = useState('');
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];

  const filtered = useMemo(() => {
    let list = exercises;
    if (group !== 'all') list = list.filter((e) => e.muscleGroup === group);
    if (q.trim()) list = list.filter((e) => e.name.toLowerCase().includes(q.trim().toLowerCase()));
    return list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [exercises, group, q]);

  const addCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    const ex: Exercise = {
      id: 'custom_' + Date.now(),
      name,
      muscleGroup: group === 'all' ? 'gogus' : group,
      type: group === 'kardiyo' ? 'cardio' : 'resistance',
      isCustom: true,
    };
    await db.exercises.add(ex);
    onPick(ex);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#070a14]">
      <ScreenHeader title={title} onBack={onClose} />
      <div className="px-4 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara…"
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
        />
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {[{ key: 'all' as const, label: 'Tümü' }, ...MUSCLE_GROUPS].map((g) => (
            <button
              key={g.key}
              onClick={() => setGroup(g.key as MuscleGroup | 'all')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                group === g.key ? 'bg-emerald-500 text-slate-950' : 'bg-white/[0.06] text-slate-300'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {filtered.map((ex) => (
          <Card key={ex.id} className="flex items-center gap-3 py-2.5" onClick={() => onPick(ex)}>
            <ExerciseThumb ex={ex} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{ex.name}</div>
              <div className="text-xs text-slate-400">
                {groupLabel(ex.muscleGroup)}
                {ex.type === 'cardio' ? ' · süre bazlı' : ''}
              </div>
            </div>
            <span className="text-emerald-400">+</span>
          </Card>
        ))}
        <Card className="space-y-2">
          <div className="text-sm font-semibold text-slate-300">Listede yok mu? Özel hareket ekle</div>
          <div className="flex gap-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Hareket adı"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
            />
            <Button variant="secondary" disabled={!customName.trim()} onClick={addCustom}>
              Ekle
            </Button>
          </div>
          {group === 'all' && <div className="text-xs text-slate-500">İpucu: önce üstten kas grubu seç, özel hareket o gruba eklenir.</div>}
        </Card>
      </div>
    </div>
  );
}
