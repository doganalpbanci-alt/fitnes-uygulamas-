import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayStr, type Fast } from '../db';
import { fmtClock, fmtDuration } from '../lib/format';
import { Button, Card, ScreenHeader } from '../components/ui';

const PROTOCOLS = [
  { name: '16:8', hours: 16 },
  { name: '18:6', hours: 18 },
  { name: '20:4', hours: 20 },
  { name: 'OMAD', hours: 23 },
];

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function CircularTimer({ fraction, children }: { fraction: number; children: React.ReactNode }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative mx-auto h-56 w-56">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={f >= 1 ? '#34d399' : '#38bdf8'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function calcStreak(fasts: Fast[]): number {
  const days = new Set(
    fasts.filter((f) => f.completed).map((f) => (f.endedAt ?? f.startedAt).slice(0, 10)),
  );
  let streak = 0;
  const d = new Date();
  // Bugün henüz tamamlanmadıysa seriyi bozma, dünden saymaya başla
  if (!days.has(todayStr(d))) d.setDate(d.getDate() - 1);
  while (days.has(todayStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function Fasting() {
  const now = useNow();
  const fasts = useLiveQuery(() => db.fasts.orderBy('startedAt').reverse().toArray(), []) ?? [];
  const active = fasts.find((f) => !f.endedAt);
  const [customHours, setCustomHours] = useState('');

  const start = async (protocol: string, hours: number) => {
    if (active) return;
    await db.fasts.add({ protocol, targetHours: hours, startedAt: new Date().toISOString() });
  };

  const end = async () => {
    if (!active) return;
    const elapsed = now - new Date(active.startedAt).getTime();
    const done = elapsed >= active.targetHours * 3600_000;
    if (!done && !confirm('Hedef süreye ulaşmadın. Orucu yarıda kesmek istiyor musun?')) return;
    await db.fasts.update(active.id!, { endedAt: new Date().toISOString(), completed: done });
  };

  const streak = calcStreak(fasts);

  return (
    <div className="pb-4">
      <ScreenHeader title="Aralıklı Oruç" />
      <div className="space-y-4 px-4">
        {active ? (
          (() => {
            const elapsed = now - new Date(active.startedAt).getTime();
            const target = active.targetHours * 3600_000;
            const remaining = target - elapsed;
            const done = remaining <= 0;
            return (
              <Card className="space-y-4">
                <CircularTimer fraction={elapsed / target}>
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    {active.protocol} · {done ? 'Hedef tamamlandı 🎉' : 'kalan süre'}
                  </div>
                  <div className="text-4xl font-bold tabular-nums">
                    {done ? '+' + fmtDuration(-remaining) : fmtDuration(remaining)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Başlangıç {fmtClock(active.startedAt)} · geçen {fmtDuration(elapsed)}
                  </div>
                </CircularTimer>
                <Button onClick={end} variant={done ? 'primary' : 'danger'} className="w-full">
                  {done ? 'Orucu Tamamla' : 'Orucu Bitir'}
                </Button>
              </Card>
            );
          })()
        ) : (
          <Card className="space-y-3">
            <div className="font-semibold">Oruç başlat</div>
            <div className="grid grid-cols-2 gap-2">
              {PROTOCOLS.map((p) => (
                <Button key={p.name} variant="secondary" onClick={() => start(p.name, p.hours)}>
                  <span className="font-bold">{p.name}</span>
                  <span className="ml-1 text-slate-400">{p.hours} saat</span>
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Özel (saat)"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              />
              <Button
                variant="secondary"
                disabled={!(Number(customHours) > 0)}
                onClick={() => start(`${customHours}s`, Number(customHours))}
              >
                Başlat
              </Button>
            </div>
          </Card>
        )}

        <Card className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Seri</div>
            <div className="text-2xl font-bold">{streak} gün 🔥</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">Toplam tamamlanan</div>
            <div className="text-2xl font-bold">{fasts.filter((f) => f.completed).length}</div>
          </div>
        </Card>

        {fasts.filter((f) => f.endedAt).length > 0 && (
          <div>
            <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Geçmiş</div>
            <div className="space-y-2">
              {fasts
                .filter((f) => f.endedAt)
                .slice(0, 20)
                .map((f) => {
                  const dur = new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime();
                  return (
                    <Card key={f.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="font-semibold">{f.protocol}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(f.startedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ·{' '}
                          {fmtDuration(dur)} / hedef {f.targetHours}s
                        </div>
                      </div>
                      <div className={f.completed ? 'text-emerald-400' : 'text-rose-400'}>
                        {f.completed ? '✓ Tamamlandı' : '✗ Yarıda'}
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
