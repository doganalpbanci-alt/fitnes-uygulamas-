import { useRef, useState } from 'react';
import { db, MEAL_LABELS, type FoodItem, type MealType } from '../db';
import {
  analyzeFoodPhoto,
  getOpenAiKey,
  sendCorrection,
  type AiFoodItem,
  type ChatMessage,
} from '../lib/openaiVision';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

interface ChatLogEntry {
  role: 'user' | 'assistant';
  text: string;
}

function blankItem(): AiFoodItem {
  return { name: '', grams: 100, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [hasKey] = useState(() => !!getOpenAiKey());
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AiFoodItem[] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [chatLog, setChatLog] = useState<ChatLogEntry[]>([]);
  const [correction, setCorrection] = useState('');
  const [correcting, setCorrecting] = useState(false);

  const onFile = (file: File) => {
    setError('');
    setItems(null);
    setMessages(null);
    setChatLog([]);
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (!photo) return;
    setLoading(true);
    setError('');
    try {
      const { turn, messages: msgs } = await analyzeFoodPhoto(photo);
      setItems(turn.items);
      setMessages(msgs);
      setChatLog([{ role: 'assistant', text: turn.reply }]);
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

  const sendCorrectionMsg = async () => {
    const text = correction.trim();
    if (!text || !messages || !items) return;
    setCorrecting(true);
    setError('');
    setChatLog((log) => [...log, { role: 'user', text }]);
    setCorrection('');
    try {
      const { turn, messages: msgs } = await sendCorrection(messages, items, text);
      setItems(turn.items);
      setMessages(msgs);
      setChatLog((log) => [...log, { role: 'assistant', text: turn.reply }]);
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'unauthorized'
          ? "API anahtarı geçersiz görünüyor — Ayarlar'dan kontrol et."
          : 'Düzeltme gönderilemedi. İnternet bağlantını kontrol edip tekrar dene.',
      );
    } finally {
      setCorrecting(false);
    }
  };

  const updateItem = (i: number, patch: Partial<AiFoodItem>) => {
    setItems((prev) => (prev ? prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) : prev));
  };

  const removeItem = (i: number) => {
    setItems((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const addItem = () => {
    setItems((prev) => [...(prev ?? []), blankItem()]);
  };

  const goToSettings = () => {
    setTab('settings');
    onClose();
  };

  const total = (items ?? []).reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      proteinG: acc.proteinG + it.proteinG,
      carbsG: acc.carbsG + it.carbsG,
      fatG: acc.fatG + it.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const validItems = (items ?? []).filter((it) => it.name.trim().length > 0);

  const confirm = async () => {
    if (validItems.length === 0) return;
    const now = Date.now();
    const date = new Date().toISOString().slice(0, 10);
    const loggedAt = new Date().toISOString();
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const factor = it.grams > 0 ? 100 / it.grams : 1;
      const food: FoodItem = {
        id: `ai_${now}_${i}`,
        name: it.name,
        caloriesPer100g: Math.round(it.calories * factor),
        proteinPer100g: Math.round(it.proteinG * factor * 10) / 10,
        carbsPer100g: Math.round(it.carbsG * factor * 10) / 10,
        fatPer100g: Math.round(it.fatG * factor * 10) / 10,
        source: 'ai',
      };
      await db.foods.put(food);
      await db.diaryEntries.add({
        date,
        mealType,
        foodId: food.id,
        foodName: it.name,
        grams: it.grams,
        calories: it.calories,
        proteinG: it.proteinG,
        carbsG: it.carbsG,
        fatG: it.fatG,
        loggedAt,
      });
    }
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
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => cameraRef.current?.click()}>Fotoğraf Çek</Button>
              <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
                Galeriden Seç
              </Button>
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </Card>
        )}

        {photo && !items && (
          <>
            <Card className="space-y-3">
              <img src={photo} alt="Seçilen fotoğraf" className="w-full rounded-xl object-cover" style={{ maxHeight: 280 }} />
              {!loading && (
                <Button className="w-full" onClick={analyze}>
                  Analiz Et
                </Button>
              )}
              {loading && (
                <div className="text-center text-sm text-slate-400">Tabaktaki besinler tek tek analiz ediliyor…</div>
              )}
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

        {items && (
          <>
            <div className="px-1 text-xs text-slate-400">
              AI tabakta {items.length} öğe tespit etti — her birini kontrol et, gerekirse düzelt ya da kaldır.
            </div>
            {items.map((it, i) => (
              <Card key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                    placeholder="Besin adı"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    className="shrink-0 rounded-lg p-2 text-slate-500 active:bg-white/10"
                    aria-label="Öğeyi kaldır"
                  >
                    🗑️
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <label className="block">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={it.grams}
                      onChange={(e) => updateItem(i, { grams: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-sm font-bold"
                    />
                    <div className="text-center text-[9px] text-slate-400">gram</div>
                  </label>
                  <label className="block">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={it.calories}
                      onChange={(e) => updateItem(i, { calories: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-sm font-bold text-emerald-400"
                    />
                    <div className="text-center text-[9px] text-slate-400">kcal</div>
                  </label>
                  <label className="block">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={it.proteinG}
                      onChange={(e) => updateItem(i, { proteinG: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-sm font-bold"
                    />
                    <div className="text-center text-[9px] text-slate-400">P g</div>
                  </label>
                  <label className="block">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={it.carbsG}
                      onChange={(e) => updateItem(i, { carbsG: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-sm font-bold"
                    />
                    <div className="text-center text-[9px] text-slate-400">K g</div>
                  </label>
                  <label className="block">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={it.fatG}
                      onChange={(e) => updateItem(i, { fatG: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-sm font-bold"
                    />
                    <div className="text-center text-[9px] text-slate-400">Y g</div>
                  </label>
                </div>
              </Card>
            ))}

            <Button variant="ghost" className="w-full !py-2 text-sm" onClick={addItem}>
              + Öğe Ekle
            </Button>

            {items.length > 0 && (
              <Card className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold text-emerald-400">{Math.round(total.calories)}</div>
                  <div className="text-[10px] text-slate-400">toplam kcal</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{Math.round(total.proteinG * 10) / 10}g</div>
                  <div className="text-[10px] text-slate-400">Protein</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{Math.round(total.carbsG * 10) / 10}g</div>
                  <div className="text-[10px] text-slate-400">Karb.</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{Math.round(total.fatG * 10) / 10}g</div>
                  <div className="text-[10px] text-slate-400">Yağ</div>
                </div>
              </Card>
            )}

            <Card className="space-y-2">
              <div className="text-sm font-semibold text-slate-300">🤖 AI ile Doğrula / Düzelt</div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {chatLog.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                        m.role === 'user' ? 'bg-emerald-400/15 text-emerald-100' : 'bg-white/[0.05] text-slate-300'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {correcting && <div className="text-center text-xs text-slate-500">Yanıtlıyor…</div>}
              </div>
              {error && chatLog.length > 0 && <div className="text-center text-sm text-rose-400">{error}</div>}
              <div className="flex gap-2">
                <input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !correcting && sendCorrectionMsg()}
                  placeholder="örn. 'bu peynir değil beyaz peynir' ya da 'yumurta yok say'"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
                />
                <Button variant="secondary" disabled={correcting || !correction.trim()} onClick={sendCorrectionMsg}>
                  Gönder
                </Button>
              </div>
            </Card>

            <Button className="w-full" disabled={validItems.length === 0} onClick={confirm}>
              {MEAL_LABELS[mealType]} Öğününe Ekle ({validItems.length} öğe)
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
