import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayStr } from '../db';
import { addManualWeight } from '../lib/bodyWeight';
import { fmtDate } from '../lib/format';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';
import { LineChart } from './Progress';
import EufyImport from './EufyImport';

export default function WeightHistory() {
  const back = useNav((s) => s.back);
  const entries = useLiveQuery(() => db.bodyWeights.toArray(), []) ?? [];
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(() => todayStr());

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        const byDate = `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`);
        if (byDate !== 0) return byDate;
        return (b.id ?? 0) - (a.id ?? 0); // aynı gün/saatte eklenenlerde en son girileni üste al
      }),
    [entries],
  );
  const chartPoints = useMemo(
    () =>
      [...entries]
        .sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`))
        .slice(-60)
        .map((e) => ({ x: e.date, y: e.weightKg })),
    [entries],
  );
  const latest = sorted[0];

  const removeEntry = async (id?: number) => {
    if (id == null) return;
    await db.bodyWeights.delete(id);
  };

  const save = async () => {
    const w = Number(weight);
    if (!(w > 0) || !date) return;
    await addManualWeight(date, w);
    setWeight('');
    setAdding(false);
  };

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader title="Kilo Takibi" onBack={back} />
      <div className="space-y-3 px-4">
        {latest && (
          <Card className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs text-slate-400">Güncel Kilo</div>
                <div className="text-3xl font-extrabold">{latest.weightKg} kg</div>
                <div className="text-xs text-slate-500">{fmtDate(latest.date)}</div>
              </div>
              {(latest.bodyFatPct != null || latest.muscleMassPct != null || latest.bmi != null) && (
                <div className="text-right text-xs text-slate-400">
                  {latest.bmi != null && <div>BMI {latest.bmi}</div>}
                  {latest.bodyFatPct != null && <div>Yağ %{latest.bodyFatPct}</div>}
                  {latest.muscleMassPct != null && <div>Kas %{latest.muscleMassPct}</div>}
                </div>
              )}
            </div>
            {chartPoints.length > 1 && <LineChart points={chartPoints} unit="kg" />}
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setAdding((v) => !v)}>
            + Manuel Ekle
          </Button>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            ⚖️ Eufy'den Aktar
          </Button>
        </div>

        {adding && (
          <Card className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-slate-400">Tarih</span>
                <input
                  type="date"
                  value={date}
                  max={todayStr()}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Kilo (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={20}
                  autoFocus
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
                />
              </label>
            </div>
            <Button className="w-full" disabled={!(Number(weight) > 0)} onClick={save}>
              Kaydet
            </Button>
          </Card>
        )}

        {sorted.length === 0 ? (
          <Card className="text-sm text-slate-400">
            Henüz kilo kaydın yok. Elle ekleyebilir ya da akıllı tartından CSV içe aktarabilirsin.
          </Card>
        ) : (
          <div className="space-y-2">
            {sorted.slice(0, 40).map((e) => (
              <Card key={e.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold">{e.weightKg} kg</div>
                  <div className="text-xs text-slate-400">
                    {fmtDate(e.date)}
                    {e.bodyFatPct != null ? ` · Yağ %${e.bodyFatPct}` : ''}
                    {e.source === 'eufy' ? ' · Eufy' : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="rounded-lg p-2 text-slate-500 active:bg-white/10"
                  aria-label="Kaydı sil"
                >
                  🗑️
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
      {importing && <EufyImport onClose={() => setImporting(false)} />}
    </div>
  );
}
