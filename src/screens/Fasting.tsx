import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, todayStr, type Fast } from '../db';
import { fmtClock, fmtDuration } from '../lib/format';
import { eatingHoursFor } from '../lib/fasting';
import { Button, Card, ScreenHeader } from '../components/ui';

const PLANS = [
  { name: '16:8', hours: 16, desc: '16 saat oruç · 8 saat yeme' },
  { name: '18:6', hours: 18, desc: '18 saat oruç · 6 saat yeme' },
  { name: '20:4', hours: 20, desc: '20 saat oruç · 4 saat yeme' },
  { name: 'OMAD', hours: 23, desc: '23 saat oruç · tek öğün' },
];

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Date → datetime-local input değeri (yerel saatle YYYY-MM-DDTHH:mm) */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Bir zamanı göster: bugünse sadece saat, değilse gün adıyla */
function fmtEnd(end: Date): string {
  const time = end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (todayStr(end) === todayStr()) return time;
  return `${end.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}

function CircularTimer({
  fraction,
  tone = 'fast',
  children,
}: {
  fraction: number;
  tone?: 'fast' | 'eat';
  children: React.ReactNode;
}) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  const stops: [string, string] = tone === 'eat' ? ['#fbbf24', '#f97316'] : f >= 1 ? ['#6ee7b7', '#10b981'] : ['#38bdf8', '#818cf8'];
  return (
    <div className="relative mx-auto h-56 w-56">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="fastProgress" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="100%" stopColor={stops[1]} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="url(#fastProgress)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
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

function PendingFast({ fast, now }: { fast: Fast; now: number }) {
  const startMs = new Date(fast.startedAt).getTime();
  const untilStart = startMs - now;

  const cancel = async () => {
    if (!confirm('Planlanan oruç iptal edilsin mi?')) return;
    await db.fasts.delete(fast.id!);
  };

  const startNow = async () => {
    await db.fasts.update(fast.id!, { startedAt: new Date().toISOString() });
  };

  return (
    <Card className="space-y-4 text-center">
      <div className="text-4xl">⏳</div>
      <div>
        <div className="text-sm text-slate-400">{fast.protocol} orucu planlandı</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">{fmtDuration(untilStart)}</div>
        <div className="text-xs text-slate-400">sonra başlayacak · {fmtEnd(new Date(startMs))}</div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={cancel}>
          Vazgeç
        </Button>
        <Button className="flex-1" onClick={startNow}>
          Şimdi Başlat
        </Button>
      </div>
    </Card>
  );
}

function ActiveFast({ fast, now }: { fast: Fast; now: number }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const start = new Date(fast.startedAt);
  const elapsed = now - start.getTime();
  const target = fast.targetHours * 3600_000;
  const end = new Date(start.getTime() + target);
  const remaining = target - elapsed;
  const done = remaining <= 0;

  const endFast = async () => {
    if (!done && !confirm('Hedef süreye ulaşmadın. Orucu yarıda kesmek istiyor musun?')) return;
    await db.fasts.update(fast.id!, { endedAt: new Date().toISOString(), completed: done });
  };

  const saveStart = async () => {
    const d = new Date(editValue);
    if (isNaN(d.getTime())) return;
    if (d.getTime() > Date.now()) {
      alert('Başlangıç zamanı gelecekte olamaz.');
      return;
    }
    await db.fasts.update(fast.id!, { startedAt: d.toISOString() });
    setEditing(false);
  };

  return (
    <Card className="space-y-4">
      <CircularTimer fraction={elapsed / target}>
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {fast.protocol} · {done ? 'Hedef tamamlandı 🎉' : 'kalan süre'}
        </div>
        <div className="text-4xl font-bold tabular-nums">
          {done ? '+' + fmtDuration(-remaining) : fmtDuration(remaining)}
        </div>
        <div className="mt-1 text-xs text-slate-400">geçen {fmtDuration(elapsed)}</div>
      </CircularTimer>

      <div className="flex items-center justify-around text-center">
        <div>
          <div className="text-xs text-slate-400">Başlangıç</div>
          <div className="font-semibold">{fmtClock(fast.startedAt)}</div>
        </div>
        <div className="text-slate-600">→</div>
        <div>
          <div className="text-xs text-slate-400">Bitiş</div>
          <div className={`font-semibold ${done ? 'text-emerald-400' : ''}`}>{fmtEnd(end)}</div>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.05] p-3">
          <div className="text-sm font-semibold text-slate-300">Başlangıç zamanını düzelt</div>
          <input
            type="datetime-local"
            value={editValue}
            max={toLocalInput(new Date())}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
            <Button className="flex-1" onClick={saveStart}>
              Kaydet
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="w-full !py-2 text-sm"
          onClick={() => {
            setEditValue(toLocalInput(start));
            setEditing(true);
          }}
        >
          ✏️ Başlangıç zamanını düzenle
        </Button>
      )}

      <Button onClick={endFast} variant={done ? 'primary' : 'danger'} className="w-full">
        {done ? 'Orucu Tamamla' : 'Orucu Bitir'}
      </Button>
    </Card>
  );
}

function EatingWindowCountdown({ lastEnded, now }: { lastEnded: Fast; now: number }) {
  const eatingH = eatingHoursFor(lastEnded.targetHours);
  const endMs = new Date(lastEnded.endedAt!).getTime();
  const total = eatingH * 3600_000;
  const windowEndMs = endMs + total;
  const elapsed = now - endMs;
  const remaining = windowEndMs - now;

  if (total <= 0) return null;

  return (
    <Card className="space-y-3">
      <CircularTimer fraction={elapsed / total} tone="eat">
        <div className="text-xs uppercase tracking-wide text-slate-400">🍽️ Yeme Penceresi</div>
        <div className="text-3xl font-bold tabular-nums">{fmtDuration(remaining)}</div>
        <div className="mt-1 text-xs text-slate-400">kaldı</div>
      </CircularTimer>
      <div className="text-center text-sm text-slate-400">
        Sıradaki oruç önerisi: <b className="text-slate-200">{fmtEnd(new Date(windowEndMs))}</b>
      </div>
    </Card>
  );
}

function EatingWindowElapsed({ lastEnded, now }: { lastEnded: Fast; now: number }) {
  const eatingH = eatingHoursFor(lastEnded.targetHours);
  const windowEndMs = new Date(lastEnded.endedAt!).getTime() + eatingH * 3600_000;
  const since = now - windowEndMs;

  const continueCycle = async () => {
    await db.fasts.add({
      protocol: lastEnded.protocol,
      targetHours: lastEnded.targetHours,
      startedAt: new Date(windowEndMs).toISOString(),
    });
  };

  return (
    <Card className="space-y-3 border-amber-400/25 bg-gradient-to-br from-amber-400/[0.10] via-white/[0.03] to-transparent text-center">
      <div className="text-3xl">🍽️</div>
      <div>
        <div className="text-lg font-bold">Yeme pencereniz doldu</div>
        <div className="text-sm text-slate-400">{fmtDuration(since)} önce bitti</div>
      </div>
      <Button className="w-full" onClick={continueCycle}>
        ✓ {lastEnded.protocol} Orucuna Başla
      </Button>
    </Card>
  );
}

function StartFast({ initialProtocol, initialHours }: { initialProtocol?: string; initialHours?: number }) {
  const matchingPlan = initialProtocol ? PLANS.find((p) => p.name === initialProtocol) : undefined;
  const [selected, setSelected] = useState<string>(() => matchingPlan?.name ?? (initialProtocol ? 'custom' : '16:8'));
  const [customHours, setCustomHours] = useState(() => (!matchingPlan && initialHours ? String(initialHours) : ''));
  const [customStart, setCustomStart] = useState(false);
  const [startValue, setStartValue] = useState('');

  const plan =
    selected === 'custom'
      ? { name: `${customHours} saat`, hours: Number(customHours) }
      : PLANS.find((p) => p.name === selected)!;
  const planValid = plan.hours > 0;

  const chosenStart = customStart && startValue ? new Date(startValue) : new Date();
  const isFuture = chosenStart.getTime() > Date.now();
  const previewEnd = new Date(chosenStart.getTime() + plan.hours * 3600_000);

  const start = async () => {
    if (!planValid) return;
    let startedAt = new Date();
    if (customStart) {
      const d = new Date(startValue);
      if (isNaN(d.getTime())) return;
      startedAt = d;
    }
    await db.fasts.add({
      protocol: plan.name,
      targetHours: plan.hours,
      startedAt: startedAt.toISOString(),
    });
  };

  return (
    <Card className="space-y-3">
      <div className="font-semibold">Plan seç</div>
      <div className="grid grid-cols-2 gap-2">
        {PLANS.map((p) => (
          <button
            key={p.name}
            onClick={() => setSelected(p.name)}
            className={`btn-tap rounded-xl border px-3 py-2.5 text-left ${
              selected === p.name
                ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5 shadow-[0_0_0_1px_rgba(52,211,153,0.15)]'
                : 'border-white/[0.06] bg-white/[0.02]'
            }`}
          >
            <div className="font-bold">{p.name}</div>
            <div className="text-xs text-slate-400">{p.desc}</div>
          </button>
        ))}
        <button
          onClick={() => setSelected('custom')}
          className={`btn-tap col-span-2 flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
            selected === 'custom'
              ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5 shadow-[0_0_0_1px_rgba(52,211,153,0.15)]'
              : 'border-white/[0.06] bg-white/[0.02]'
          }`}
        >
          <div className="font-bold">Özel</div>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="kaç saat?"
            value={customHours}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setCustomHours(e.target.value);
              setSelected('custom');
            }}
            className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-400">saat oruç</span>
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={customStart}
          onChange={(e) => {
            setCustomStart(e.target.checked);
            if (e.target.checked && !startValue) setStartValue(toLocalInput(new Date()));
          }}
          className="h-4 w-4 accent-emerald-500"
        />
        Farklı bir saatte başlat (geçmiş ya da ileri bir zaman)
      </label>
      {customStart && (
        <input
          type="datetime-local"
          value={startValue}
          onChange={(e) => setStartValue(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
        />
      )}

      {planValid && (
        <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
          {isFuture ? (
            <>
              <span className="text-slate-400">Bu oruç </span>
              <b>{fmtEnd(chosenStart)}</b>
              <span className="text-slate-400">'de planlanacak, </span>
              <b>{fmtEnd(previewEnd)}</b>
              <span className="text-slate-400">'de bitecek.</span>
            </>
          ) : (
            <>
              <span className="text-slate-400">Bitiş: </span>
              <b>{fmtEnd(previewEnd)}</b>
              <span className="text-slate-500"> ({plan.hours} saat sonra)</span>
            </>
          )}
        </div>
      )}

      <Button className="w-full" disabled={!planValid} onClick={start}>
        {isFuture ? 'Oruç Planla' : 'Orucu Başlat'}
      </Button>
    </Card>
  );
}

export default function Fasting() {
  const now = useNow();
  const fasts = useLiveQuery(() => db.fasts.orderBy('startedAt').reverse().toArray(), []) ?? [];
  const active = fasts.find((f) => !f.endedAt);
  const past = fasts
    .filter((f) => f.endedAt)
    .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime());
  const lastEnded = past[0];

  const removeFast = async (f: Fast) => {
    if (!confirm('Bu oruç kaydı silinsin mi?')) return;
    await db.fasts.delete(f.id!);
  };

  const streak = calcStreak(fasts);

  let mainCard = null;
  if (active) {
    const isPending = new Date(active.startedAt).getTime() > now;
    mainCard = isPending ? <PendingFast fast={active} now={now} /> : <ActiveFast fast={active} now={now} />;
  } else if (lastEnded) {
    const eatingH = eatingHoursFor(lastEnded.targetHours);
    const windowEndMs = new Date(lastEnded.endedAt!).getTime() + eatingH * 3600_000;
    mainCard =
      now < windowEndMs ? (
        <EatingWindowCountdown lastEnded={lastEnded} now={now} />
      ) : (
        <EatingWindowElapsed lastEnded={lastEnded} now={now} />
      );
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Aralıklı Oruç" />
      <div className="space-y-4 px-4">
        {mainCard}
        {!active && <StartFast key={lastEnded?.id ?? 'fresh'} initialProtocol={lastEnded?.protocol} initialHours={lastEnded?.targetHours} />}

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

        {past.length > 0 && (
          <div>
            <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Geçmiş</div>
            <div className="space-y-2">
              {past.slice(0, 30).map((f) => {
                const dur = new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime();
                return (
                  <Card key={f.id} className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{f.protocol}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(f.startedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ·{' '}
                        {fmtClock(f.startedAt)}–{fmtClock(f.endedAt!)} · {fmtDuration(dur)} / hedef {f.targetHours}s
                      </div>
                    </div>
                    <div className={`text-sm ${f.completed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {f.completed ? '✓' : '✗'}
                    </div>
                    <button
                      onClick={() => removeFast(f)}
                      className="rounded-lg p-2 text-slate-500 active:bg-white/10"
                      aria-label="Kaydı sil"
                    >
                      🗑️
                    </button>
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
