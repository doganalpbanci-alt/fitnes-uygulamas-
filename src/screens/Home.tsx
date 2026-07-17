import { useLiveQuery } from 'dexie-react-hooks';
import { db, DAY_NAMES, todayIndex, todayStr } from '../db';
import { fmtDuration } from '../lib/format';
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
  const activeFast = useLiveQuery(
    async () => (await db.fasts.orderBy('startedAt').reverse().limit(5).toArray()).find((f) => !f.endedAt),
    [],
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  return (
    <div className="pb-4">
      <ScreenHeader title={`${greeting()} 💪`} />
      <div className="space-y-3 px-4">
        <Card>
          <div className="text-sm text-slate-400">
            Bugün · {DAY_NAMES[today]}
          </div>
          {template ? (
            <div className="mt-1 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold">{template.name}</div>
                <div className="text-xs text-slate-400">{template.exercises.length} hareket</div>
              </div>
              {doneToday ? (
                <span className="font-semibold text-emerald-400">✓ Tamamlandı</span>
              ) : (
                <Button onClick={() => push({ t: 'session', templateId: template.id! })}>Antrenmanı Başlat</Button>
              )}
            </div>
          ) : (
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="text-lg font-bold">Dinlenme günü 😌</div>
              <Button variant="secondary" onClick={() => setTab('workout')}>
                Programı Düzenle
              </Button>
            </div>
          )}
        </Card>

        <Card onClick={() => setTab('fasting')}>
          <div className="text-sm text-slate-400">Aralıklı Oruç</div>
          {activeFast ? (
            (() => {
              const elapsed = now - new Date(activeFast.startedAt).getTime();
              const remaining = activeFast.targetHours * 3600_000 - elapsed;
              return (
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-lg font-bold">
                    {activeFast.protocol} ·{' '}
                    {remaining > 0 ? (
                      <span className="tabular-nums">{fmtDuration(remaining)} kaldı</span>
                    ) : (
                      <span className="text-emerald-400">Hedef tamamlandı 🎉</span>
                    )}
                  </div>
                  <span className="text-slate-500">›</span>
                </div>
              );
            })()
          ) : (
            <div className="mt-1 flex items-center justify-between">
              <div className="text-lg font-bold">Aktif oruç yok</div>
              <span className="text-sm text-emerald-400">Başlat ›</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
