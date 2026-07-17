import { useLiveQuery } from 'dexie-react-hooks';
import { DAY_NAMES, db, todayIndex, todayStr } from '../db';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

export default function Workout() {
  const push = useNav((s) => s.push);
  const templates = useLiveQuery(() => db.templates.toArray(), []) ?? [];
  const schedule = useLiveQuery(() => db.schedule.orderBy('dayOfWeek').toArray(), []) ?? [];
  const weekSessions = useLiveQuery(async () => {
    const start = new Date();
    start.setDate(start.getDate() - todayIndex());
    return db.sessions.where('date').aboveOrEqual(todayStr(start)).toArray();
  }, []) ?? [];

  const tmplName = (id: number | null) => templates.find((t) => t.id === id)?.name;
  const today = todayIndex();

  const setDay = async (day: number, templateId: number | null) => {
    await db.schedule.put({ dayOfWeek: day, templateId });
  };

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Antrenman"
        right={
          <Button variant="secondary" className="!py-2" onClick={() => push({ t: 'editTemplate' })}>
            + Yeni Antrenman
          </Button>
        }
      />
      <div className="space-y-4 px-4">
        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Haftalık Program</div>
          <div className="space-y-2">
            {schedule.map((day) => {
              const doneToday = weekSessions.some(
                (s) =>
                  s.finishedAt &&
                  todayIndex(new Date(s.date + 'T12:00:00')) === day.dayOfWeek &&
                  s.templateId === day.templateId,
              );
              const isToday = day.dayOfWeek === today;
              return (
                <Card
                  key={day.dayOfWeek}
                  className={`flex items-center gap-3 py-3 ${isToday ? 'border-emerald-500/50' : ''}`}
                >
                  <div className="w-24">
                    <div className={`font-semibold ${isToday ? 'text-emerald-400' : ''}`}>
                      {DAY_NAMES[day.dayOfWeek]}
                    </div>
                    {isToday && <div className="text-xs text-emerald-500">Bugün</div>}
                  </div>
                  <select
                    value={day.templateId ?? ''}
                    onChange={(e) => setDay(day.dayOfWeek, e.target.value ? Number(e.target.value) : null)}
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
                  >
                    <option value="">— Dinlenme —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {doneToday && <span className="text-emerald-400">✓</span>}
                  {isToday && day.templateId != null && !doneToday && (
                    <Button className="!px-3 !py-2" onClick={() => push({ t: 'session', templateId: day.templateId! })}>
                      Başlat
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 px-1 text-sm font-semibold text-slate-400">Antrenmanlarım</div>
          {templates.length === 0 ? (
            <Card className="text-sm text-slate-400">
              Henüz antrenman yok. Sağ üstten <b>+ Yeni Antrenman</b> ile ilkini oluştur, sonra günlere ata.
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <Card key={t.id} className="flex items-center justify-between py-3" onClick={() => push({ t: 'editTemplate', id: t.id })}>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.exercises.length} hareket</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="!px-3 !py-2"
                      onClick={() => push({ t: 'session', templateId: t.id! })}
                    >
                      Başlat
                    </Button>
                    <span className="text-slate-500">›</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">
            {tmplName(schedule[today]?.templateId ?? null)
              ? `Bugünün programı: ${tmplName(schedule[today].templateId)}`
              : 'Bugün için atanmış antrenman yok.'}
          </div>
        </div>
      </div>
    </div>
  );
}
