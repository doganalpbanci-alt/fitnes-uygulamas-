import { useLiveQuery } from 'dexie-react-hooks';
import { db, DAY_NAMES, todayIndex, todayStr } from '../db';
import { fmtDuration } from '../lib/format';
import { eatingHoursFor } from '../lib/fasting';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';
import { useEffect, useState } from 'react';

export default function Home() {
  const { push, setTab } = useNav();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = todayIndex();
  const schedule = useLiveQuery(() => db.schedule.get(today), [today]);
  const template = useLiveQuery(
    async () => (schedule?.templateId != null ? db.templates.get(schedule.templateId) : undefined),
    [schedule?.templateId],
  );
  const doneToday = useLiveQuery(
    async () =>
      schedule?.templateId != null
        ? (await db.sessions.where('date').equals(todayStr()).toArray()).some(
            (s) => s.finishedAt && s.templateId === schedule.templateId,
          )
        : false,
    [schedule?.templateId],
  );
  const recentFasts = useLiveQuery(() => db.fasts.orderBy('startedAt').reverse().limit(5).toArray(), []) ?? [];
  const activeFast = recentFasts.find((f) => !f.endedAt);
  const lastEndedFast = recentFasts.filter((f) => f.endedAt).sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime())[0];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const workoutHero = template && !doneToday;

  return (
    <div className="pb-4">
      <ScreenHeader title={`${greeting()} 💪`} />
      <div className="space-y-3 px-4">
        <Card
          className={
            workoutHero
              ? '!border-emerald-400/25 !bg-gradient-to-br !from-emerald-400/[0.12] !via-white/[0.03] !to-transparent'
              : ''
          }
        >
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <span>📅</span>
            <span>Bugün · {DAY_NAMES[today]}</span>
          </div>
          {template ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-bold tracking-tight">{template.name}</div>
                <div className="text-xs text-slate-400">{template.exercises.length} hareket</div>
              </div>
              {doneToday ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-400">
                  ✓ Tamamlandı
                </span>
              ) : (
                <Button onClick={() => push({ t: 'session', templateId: template.id! })}>Antrenmanı Başlat</Button>
              )}
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xl font-bold tracking-tight">Dinlenme günü 😌</div>
              <Button variant="secondary" onClick={() => setTab('workout')}>
                Programı Düzenle
              </Button>
            </div>
          )}
        </Card>

        <Card onClick={() => setTab('fasting')}>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <span>⏱️</span>
            <span>Aralıklı Oruç</span>
          </div>
          {activeFast ? (
            (() => {
              const startMs = new Date(activeFast.startedAt).getTime();
              if (startMs > now) {
                return (
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xl font-bold tracking-tight">
                      ⏳ {activeFast.protocol}{' '}
                      <span className="tabular-nums text-slate-300">{fmtDuration(startMs - now)} sonra</span>
                    </div>
                    <span className="text-slate-500">›</span>
                  </div>
                );
              }
              const elapsed = now - startMs;
              const remaining = activeFast.targetHours * 3600_000 - elapsed;
              return (
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xl font-bold tracking-tight">
                    {activeFast.protocol}{' '}
                    {remaining > 0 ? (
                      <span className="tabular-nums text-slate-300">{fmtDuration(remaining)} kaldı</span>
                    ) : (
                      <span className="text-emerald-400">Hedef tamamlandı 🎉</span>
                    )}
                  </div>
                  <span className="text-slate-500">›</span>
                </div>
              );
            })()
          ) : lastEndedFast ? (
            (() => {
              const eatingH = eatingHoursFor(lastEndedFast.targetHours);
              const windowEndMs = new Date(lastEndedFast.endedAt!).getTime() + eatingH * 3600_000;
              const inWindow = now < windowEndMs;
              return (
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xl font-bold tracking-tight">
                    {inWindow ? (
                      <>
                        🍽️ <span className="tabular-nums text-slate-300">{fmtDuration(windowEndMs - now)} yeme penceresi</span>
                      </>
                    ) : (
                      <span className="text-amber-400">Yeme penceresi doldu</span>
                    )}
                  </div>
                  <span className="text-slate-500">›</span>
                </div>
              );
            })()
          ) : (
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xl font-bold tracking-tight">Aktif oruç yok</div>
              <span className="text-sm font-semibold text-emerald-400">Başlat ›</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
