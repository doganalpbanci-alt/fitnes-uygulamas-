import { useRef, useState } from 'react';
import { db } from '../db';
import { weightIncrement } from '../lib/overload';
import { AI_MODELS, clearOpenAiKey, getAiModel, getOpenAiKey, setAiModel, setOpenAiKey } from '../lib/openaiVision';
import { Button, Card, ScreenHeader } from '../components/ui';

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [inc, setInc] = useState(() => String(weightIncrement()));
  const [msg, setMsg] = useState('');
  const [hasAiKey, setHasAiKey] = useState(() => !!getOpenAiKey());
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [howToOpen, setHowToOpen] = useState(false);
  const [aiModel, setAiModelState] = useState(() => getAiModel());

  const chooseModel = (id: string) => {
    setAiModel(id);
    setAiModelState(id);
  };

  const exportData = async () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      exercises: await db.exercises.toArray(),
      templates: await db.templates.toArray(),
      schedule: await db.schedule.toArray(),
      sessions: await db.sessions.toArray(),
      fasts: await db.fasts.toArray(),
      profile: await db.profile.toArray(),
      foods: await db.foods.toArray(),
      diaryEntries: await db.diaryEntries.toArray(),
      bodyWeights: await db.bodyWeights.toArray(),
    };
    const filename = `fittakip-yedek-${data.exportedAt.slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    // Desteklenen tarayıcılarda (ör. Mac Safari) doğrudan AirDrop/e-posta/mesaj ile
    // paylaşım menüsünü aç — dosyayı indirip elle taşımaya gerek kalmaz.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'FitTakip Yedeği',
          text: 'FitTakip verilerini başka bir cihaza aktarmak için bu dosyayı Ayarlar > İçe Aktar ile aç.',
        });
        return;
      } catch (err) {
        // Kullanıcı paylaşım menüsünü iptal etti — sessizce dosya indirmeye düş.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const isValid =
        data &&
        typeof data === 'object' &&
        Array.isArray(data.exercises) &&
        Array.isArray(data.sessions) &&
        (data.templates == null || Array.isArray(data.templates)) &&
        (data.schedule == null || Array.isArray(data.schedule)) &&
        (data.fasts == null || Array.isArray(data.fasts)) &&
        (data.profile == null || Array.isArray(data.profile)) &&
        (data.foods == null || Array.isArray(data.foods)) &&
        (data.diaryEntries == null || Array.isArray(data.diaryEntries)) &&
        (data.bodyWeights == null || Array.isArray(data.bodyWeights));
      if (!isValid) throw new Error('geçersiz dosya');
      const tables = [db.exercises, db.templates, db.schedule, db.sessions, db.fasts, db.profile, db.foods, db.diaryEntries, db.bodyWeights];
      await db.transaction('rw', tables, async () => {
        await Promise.all(tables.map((t) => t.clear()));
        await db.exercises.bulkAdd(data.exercises);
        await db.templates.bulkAdd(data.templates ?? []);
        await db.schedule.bulkAdd(data.schedule ?? []);
        await db.sessions.bulkAdd(data.sessions ?? []);
        await db.fasts.bulkAdd(data.fasts ?? []);
        await db.profile.bulkAdd(data.profile ?? []);
        await db.foods.bulkAdd(data.foods ?? []);
        await db.diaryEntries.bulkAdd(data.diaryEntries ?? []);
        await db.bodyWeights.bulkAdd(data.bodyWeights ?? []);
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
    } else {
      setMsg('✗ Artış miktarı 0’dan büyük bir sayı olmalı.');
    }
  };

  const saveAiKey = () => {
    const k = aiKeyInput.trim();
    if (!k) return;
    setOpenAiKey(k);
    setAiKeyInput('');
    setHasAiKey(true);
    setMsg('✓ OpenAI API anahtarı kaydedildi.');
  };

  const removeAiKey = () => {
    clearOpenAiKey();
    setHasAiKey(false);
    setMsg('✓ API anahtarı kaldırıldı.');
  };

  const wipe = async () => {
    if (!confirm('TÜM veriler silinecek (antrenmanlar, geçmiş, oruçlar). Emin misin?')) return;
    if (!confirm('Son kez soruyorum: gerçekten hepsi silinsin mi?')) return;
    await db.delete();
    location.reload();
  };

  const resetProgress = async () => {
    if (
      !confirm(
        'Tüm antrenman geçmişi silinecek: istatistikler, favori hareket, bölge yoğunluk haritası ve rekorlar sıfırlanır. Antrenman şablonların ve haftalık programın kalır. Emin misin?',
      )
    )
      return;
    await db.sessions.clear();
    setMsg('✓ İlerleme verileri sıfırlandı.');
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
              min={0.5}
              step={0.5}
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
          <div className="font-semibold">Yedekleme ve Cihazlar Arası Taşıma</div>
          <div className="text-sm text-slate-400">
            Veriler yalnızca bu cihazda tutulur, sunucuya gitmez. Düzenli olarak yedek almanı öneririz.
          </div>
          <button
            onClick={() => setHowToOpen((v) => !v)}
            className="btn-tap -mx-1 flex w-full items-center justify-between px-1 py-1 text-left text-sm font-semibold text-emerald-400"
          >
            <span>Başka cihaza nasıl taşırım?</span>
            <span className="text-slate-500">{howToOpen ? '▾' : '▸'}</span>
          </button>
          {howToOpen && (
            <ol className="list-inside list-decimal space-y-1 text-sm text-slate-400">
              <li>
                Bu cihazda <b>Dışa Aktar</b>'a bas.
              </li>
              <li>Açılan paylaşım menüsünden AirDrop / e-posta / mesaj ile diğer cihaza gönder.</li>
              <li>
                Diğer cihazda dosyayı açıp <b>İçe Aktar</b>'a bas.
              </li>
              <li className="text-slate-500">
                Paylaşım menüsü açılmazsa dosya iner — onu istediğin yolla (bulut, e-posta) ulaştırman yeterli.
              </li>
            </ol>
          )}
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
          <div className="font-semibold">📷 Fotoğraftan Besin Tanıma (AI)</div>
          <div className="text-sm text-slate-400">
            Kendi OpenAI API anahtarınla çalışır. Anahtar yalnızca bu cihazda saklanır, yedeklere dahil
            edilmez. Analizler kendi OpenAI hesabından ücretlendirilir.{' '}
            <a
              className="text-emerald-400 underline"
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anahtar al
            </a>
          </div>
          {hasAiKey ? (
            <>
              <div className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5">
                <span className="text-sm text-emerald-300">✓ Anahtar kayıtlı</span>
                <Button variant="ghost" className="!py-1.5 text-sm text-rose-400" onClick={removeAiKey}>
                  Kaldır
                </Button>
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="text-xs text-slate-400">Analiz modeli</div>
                {AI_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => chooseModel(m.id)}
                    className={`btn-tap flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                      aiModel === m.id
                        ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{m.label}</div>
                      <div className="text-xs text-slate-400">{m.desc}</div>
                    </div>
                    {aiModel === m.id && <span className="shrink-0 text-emerald-400">✓</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                value={aiKeyInput}
                onChange={(e) => setAiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
              />
              <Button variant="secondary" onClick={saveAiKey}>
                Kaydet
              </Button>
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="font-semibold text-rose-400">Tehlikeli bölge</div>
          <div className="space-y-1.5">
            <Button
              variant="secondary"
              className="w-full !border-rose-400/25 !text-rose-300"
              onClick={resetProgress}
            >
              İlerleme Verilerini Sıfırla
            </Button>
            <div className="px-1 text-xs text-slate-500">
              Yalnızca antrenman geçmişini siler (istatistik, rekor, ısı haritası). Şablonların ve haftalık
              programın kalır.
            </div>
          </div>
          <div className="space-y-1.5">
            <Button variant="danger" className="w-full" onClick={wipe}>
              Tüm Verileri Sil
            </Button>
            <div className="px-1 text-xs text-slate-500">
              Her şeyi siler: öğün kayıtları, kilo geçmişi, antrenmanlar ve oruçlar. Geri alınamaz — önce yedek
              al.
            </div>
          </div>
        </Card>

        {msg && <div className="px-1 text-sm text-slate-300">{msg}</div>}

        <div className="px-1 pt-2 text-xs text-slate-500">
          FitTakip v0.1 · Egzersiz görselleri:{' '}
          <a
            className="underline"
            href="https://github.com/yuhonas/free-exercise-db"
            target="_blank"
            rel="noopener noreferrer"
          >
            free-exercise-db
          </a>{' '}
          (MIT)
        </div>
      </div>
    </div>
  );
}
