import { useRef, useState } from 'react';
import { db, MEAL_LABELS, type FoodItem, type MealType } from '../db';
import { analyzeFoodPhoto, getOpenAiKey, type AiFoodResult } from '../lib/openaiVision';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

export default function PhotoFoodScan({
  mealType,
  onClose,
  onDone,
}: {
  mealType: MealType;
  onClose: () => void;
  onDone: () => void;
}) {
  const setTab = useNav((s) => s.setTab);
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasKey] = useState(() => !!getOpenAiKey());
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiFoodResult | null>(null);

  const onFile = (file: File) => {
    setError('');
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!photo) return;
    setLoading(true);
    setError('');
    try {
      setResult(await analyzeFoodPhoto(photo));
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'unauthorized'
          ? "API anahtarı geçersiz görünüyor — Ayarlar'dan kontrol et."
          : 'Analiz başarısız oldu. İnternet bağlantını ve API anahtarını kontrol edip tekrar dene.',
      );
    } finally {
      setLoading(false);
    }
  };

  const goToSettings = () => {
    setTab('settings');
    onClose();
  };

  const confirm = async () => {
    if (!result) return;
    const factor = result.grams > 0 ? 100 / result.grams : 1;
    const food: FoodItem = {
      id: 'ai_' + Date.now(),
      name: result.name,
      caloriesPer100g: Math.round(result.calories * factor),
      proteinPer100g: Math.round(result.proteinG * factor * 10) / 10,
      carbsPer100g: Math.round(result.carbsG * factor * 10) / 10,
      fatPer100g: Math.round(result.fatG * factor * 10) / 10,
      source: 'ai',
    };
    await db.foods.put(food);
    await db.diaryEntries.add({
      date: new Date().toISOString().slice(0, 10),
      mealType,
      foodId: food.id,
      foodName: food.name,
      grams: result.grams,
      calories: result.calories,
      proteinG: result.proteinG,
      carbsG: result.carbsG,
      fatG: result.fatG,
      loggedAt: new Date().toISOString(),
    });
    onDone();
  };

  if (!hasKey) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[#070a14]">
        <ScreenHeader title="Fotoğraftan Besin Tanıma" onBack={onClose} />
        <div className="space-y-3 px-4">
          <Card className="space-y-3 text-center">
            <div className="text-3xl">🔑</div>
            <div className="font-bold">Önce OpenAI API anahtarını ekle</div>
            <div className="text-sm text-slate-400">
              Bu özellik kendi OpenAI hesabınla çalışır — anahtar yalnızca bu cihazda saklanır. Ayarlar'dan
              ekleyebilirsin.
            </div>
            <Button className="w-full" onClick={goToSettings}>
              Ayarlar'a Git
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[#070a14] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader title="Fotoğraftan Besin Tanıma" onBack={onClose} />
      <div className="space-y-3 px-4">
        {!photo && (
          <Card className="space-y-3 text-center">
            <div className="text-3xl">📷</div>
            <div className="text-sm text-slate-400">Yemeğinin fotoğrafını çek ya da galeriden seç.</div>
            <Button className="w-full" onClick={() => fileRef.current?.click()}>
              Fotoğraf Seç
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </Card>
        )}

        {photo && !result && (
          <>
            <Card className="space-y-3">
              <img src={photo} alt="Seçilen fotoğraf" className="w-full rounded-xl object-cover" style={{ maxHeight: 280 }} />
              {!loading && (
                <Button className="w-full" onClick={analyze}>
                  Analiz Et
                </Button>
              )}
              {loading && <div className="text-center text-sm text-slate-400">Analiz ediliyor…</div>}
              {error && <div className="text-center text-sm text-rose-400">{error}</div>}
            </Card>
            <Button
              variant="ghost"
              className="w-full !py-2 text-sm"
              onClick={() => {
                setPhoto(null);
                setError('');
              }}
            >
              Farklı fotoğraf seç
            </Button>
          </>
        )}

        {result && (
          <>
            <Card className="space-y-1 text-center">
              <div className="text-xs text-slate-400">AI tahmini — gerekirse düzelt</div>
              <input
                value={result.name}
                onChange={(e) => setResult({ ...result, name: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-bold"
              />
            </Card>
            <Card>
              <label className="block">
                <span className="text-sm text-slate-400">Porsiyon (gram)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={result.grams}
                  onChange={(e) => setResult({ ...result, grams: Math.max(0, Number(e.target.value) || 0) })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-2xl font-bold"
                />
              </label>
            </Card>
            <Card className="grid grid-cols-4 gap-2 text-center">
              <label className="block">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={result.calories}
                  onChange={(e) => setResult({ ...result, calories: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-lg font-bold text-emerald-400"
                />
                <div className="text-[10px] text-slate-400">kcal</div>
              </label>
              <label className="block">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={result.proteinG}
                  onChange={(e) => setResult({ ...result, proteinG: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-lg font-bold"
                />
                <div className="text-[10px] text-slate-400">Protein</div>
              </label>
              <label className="block">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={result.carbsG}
                  onChange={(e) => setResult({ ...result, carbsG: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-lg font-bold"
                />
                <div className="text-[10px] text-slate-400">Karb.</div>
              </label>
              <label className="block">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={result.fatG}
                  onChange={(e) => setResult({ ...result, fatG: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-lg font-bold"
                />
                <div className="text-[10px] text-slate-400">Yağ</div>
              </label>
            </Card>
            <Button className="w-full" onClick={confirm}>
              {MEAL_LABELS[mealType]} Öğününe Ekle
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
