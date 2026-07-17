import { useRef, useState } from 'react';
import { db } from '../db';
import { weightIncrement } from '../lib/overload';
import { Button, Card, ScreenHeader } from '../components/ui';

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [inc, setInc] = useState(() => String(weightIncrement()));
  const [msg, setMsg] = useState('');

  const exportData = async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: await db.exercises.toArray(),
      templates: await db.templates.toArray(),
      schedule: await db.schedule.toArray(),
      sessions: await db.sessions.toArray(),
      fasts: await db.fasts.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fittakip-yedek-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data.sessions || !data.exercises) throw new Error('geçersiz dosya');
      await db.transaction('rw', [db.exercises, db.templates, db.schedule, db.sessions, db.fasts], async () => {
        await Promise.all([db.exercises.clear(), db.templates.clear(), db.schedule.clear(), db.sessions.clear(), db.fasts.clear()]);
        await db.exercises.bulkAdd(data.exercises);
        await db.templates.bulkAdd(data.templates ?? []);
        await db.schedule.bulkAdd(data.schedule ?? []);
        await db.sessions.bulkAdd(data.sessions ?? []);
        await db.fasts.bulkAdd(data.fasts ?? []);
      });
      setMsg('✓ Yedek geri yüklendi.');
    } catch {
      setMsg('✗ Dosya okunamadı — geçerli bir FitTakip yedeği değil.');
    }
  };

  const saveInc = () => {
    const v = Number(inc);
    if (v > 0) {
      localStorage.setItem('weightIncrementKg', String(v));
      setMsg(`✓ Artış önerisi ${v} kg olarak kaydedildi.`);
    }
  };

  const wipe = async () => {
    if (!confirm('TÜM veriler silinecek (antrenmanlar, geçmiş, oruçlar). Emin misin?')) return;
    if (!confirm('Son kez soruyorum: gerçekten hepsi silinsin mi?')) return;
    await db.delete();
    location.reload();
  };

  return (
    <div className="pb-4">
      <ScreenHeader title="Ayarlar" />
      <div className="space-y-3 px-4">
        <Card className="space-y-2">
          <div className="font-semibold">Progressive overload artışı</div>
          <div className="text-sm text-slate-400">
            Öneri verilirken ağırlığa eklenecek miktar (kg).
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={inc}
              onChange={(e) => setInc(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
            />
            <Button variant="secondary" onClick={saveInc}>
              Kaydet
            </Button>
          </div>
        </Card>

        <Card className="space-y-2">
          <div className="font-semibold">Yedekleme</div>
          <div className="text-sm text-slate-400">
            Veriler yalnızca bu cihazda tutulur. Arada bir yedek almanı öneririm.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={exportData}>
              Dışa Aktar (JSON)
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
              İçe Aktar
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
            />
          </div>
        </Card>

        <Card className="space-y-2">
          <div className="font-semibold text-rose-400">Tehlikeli bölge</div>
          <Button variant="danger" className="w-full" onClick={wipe}>
            Tüm Verileri Sil
          </Button>
        </Card>

        {msg && <div className="px-1 text-sm text-slate-300">{msg}</div>}

        <div className="px-1 pt-2 text-xs text-slate-500">
          FitTakip v0.1 · Egzersiz görselleri:{' '}
          <a className="underline" href="https://github.com/yuhonas/free-exercise-db">
            free-exercise-db
          </a>{' '}
          (MIT)
        </div>
      </div>
    </div>
  );
}
