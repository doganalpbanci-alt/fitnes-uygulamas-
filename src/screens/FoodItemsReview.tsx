import { useRef, useState } from 'react';
import { db, MEAL_LABELS, todayStr, type FoodItem, type MealType } from '../db';
import { LOW_CONFIDENCE, itemPer100, sendCorrection, type AiFoodItem, type ChatMessage } from '../lib/openaiVision';
import { Button, Card } from '../components/ui';

interface ChatLogEntry {
  role: 'user' | 'assistant';
  text: string;
}

function blankItem(): AiFoodItem {
  return { name: '', grams: 100, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

/** AI'ın (fotoğraf ya da yazılı tarif üzerinden) tespit ettiği besin öğelerini gösterip
 * düzenlemeyi, sohbetle düzeltmeyi ve günlüğe eklemeyi sağlayan paylaşılan ekran — hem
 * PhotoFoodScan hem TextFoodScan tarafından kullanılır. */
export default function FoodItemsReview({
  items,
  onItemsChange,
  messages,
  onMessagesChange,
  initialReply,
  mealType,
  date = todayStr(),
  onDone,
}: {
  items: AiFoodItem[];
  onItemsChange: (items: AiFoodItem[]) => void;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  initialReply: string;
  mealType: MealType;
  date?: string;
  onDone: () => void;
}) {
  const [chatLog, setChatLog] = useState<ChatLogEntry[]>(() => [{ role: 'assistant', text: initialReply }]);
  const [correction, setCorrection] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // useState'in güncellemesi bir sonraki render'a kadar yansımadığı için hızlı art arda
  // dokunmalarda (aynı senkron olay döngüsünde) "submitting" state'i hâlâ eski değeriyle
  // okunabiliyordu — bu yüzden gerçek koruma senkron güncellenen bir ref üzerinden yapılıyor.
  const submittingRef = useRef(false);

  const sendCorrectionMsg = async () => {
    const text = correction.trim();
    if (!text) return;
    setCorrecting(true);
    setError('');
    setChatLog((log) => [...log, { role: 'user', text }]);
    setCorrection('');
    try {
      const { turn, messages: msgs } = await sendCorrection(messages, items, text);
      onItemsChange(turn.items);
      onMessagesChange(msgs);
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
    onItemsChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  /** Gram değişince kalori ve makrolar da orantılı olarak yeniden hesaplanır — 100 g başına sabit
   * taban üzerinden, böylece art arda düzenlemede yuvarlama hatası birikmez. Birim tanımlıysa
   * adet de gramla birlikte güncellenir. */
  const updateGrams = (i: number, newGrams: number) => {
    const it = items[i];
    const base = itemPer100(it);
    const k = newGrams / 100;
    updateItem(i, {
      grams: newGrams,
      per100: base,
      calories: Math.round(base.calories * k),
      proteinG: Math.round(base.proteinG * k * 10) / 10,
      carbsG: Math.round(base.carbsG * k * 10) / 10,
      fatG: Math.round(base.fatG * k * 10) / 10,
      ...(it.unitGrams ? { unitCount: Math.round((newGrams / it.unitGrams) * 100) / 100 } : {}),
    });
  };

  /** Birim adedi değişince gram ve besin değerleri orantılı olarak yeniden hesaplanır. */
  const updateUnitCount = (i: number, count: number) => {
    const it = items[i];
    if (!it.unitGrams || !(count > 0)) return;
    updateGrams(i, Math.round(count * it.unitGrams * 10) / 10);
  };

  /** Kalori/makro elle değiştirilince taban geçersizleşir; sonraki gram düzenlemesi yeni
   * değerlerden yeni bir taban türetir. */
  const updateMacro = (i: number, patch: Partial<AiFoodItem>) => {
    updateItem(i, { ...patch, per100: undefined });
  };

  const removeItem = (i: number) => {
    onItemsChange(items.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    onItemsChange([...items, blankItem()]);
  };

  const total = items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      proteinG: acc.proteinG + it.proteinG,
      carbsG: acc.carbsG + it.carbsG,
      fatG: acc.fatG + it.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const validItems = items.filter((it) => it.name.trim().length > 0);

  const confirm = async () => {
    // İkinci dokunuşu yok say — aksi halde (özellikle AI analizinin doğal gecikmesiyle) art arda
    // iki dokunuş aynı öğeleri iki kez günlüğe ekleyip öğün toplamını yanlış şişirebiliyordu.
    if (validItems.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const now = Date.now();
    const loggedAt = new Date().toISOString();
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      // Gram düzenlendiyse taban zaten tam hassasiyetle saklanmış olur; yuvarlanmış ekran
      // değerlerinden geri hesaplamak yerine onu kullan.
      const base = itemPer100(it);
      const hasUnit = !!it.unitLabel && !!it.unitGrams && it.unitCount != null;
      const food: FoodItem = {
        id: `ai_${now}_${i}`,
        name: it.name,
        caloriesPer100g: Math.round(base.calories),
        proteinPer100g: Math.round(base.proteinG * 10) / 10,
        carbsPer100g: Math.round(base.carbsG * 10) / 10,
        fatPer100g: Math.round(base.fatG * 10) / 10,
        source: 'ai',
        // Birimi besinle birlikte sakla ki sonraki eklemelerde de adet/dilim seçilebilsin.
        ...(hasUnit ? { servings: [{ label: it.unitLabel!, grams: it.unitGrams! }] } : {}),
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
        ...(hasUnit ? { unitLabel: it.unitLabel, unitCount: it.unitCount, unitGrams: it.unitGrams } : {}),
      });
    }
    onDone();
  };

  return (
    <>
      <div className="px-1 text-xs text-slate-400">
        AI {items.length} öğe tespit etti — her birini kontrol et, gerekirse düzelt ya da kaldır.
      </div>
      {items.map((it, i) => {
        const unsure = it.confidence != null && it.confidence < LOW_CONFIDENCE;
        return (
        <Card key={i} className={`space-y-2 ${unsure ? '!border-amber-400/30' : ''}`}>
          {unsure && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300">
              <span>⚠️</span>
              <span>AI bu öğeden emin değil (%{Math.round(it.confidence! * 100)}) — kontrol et</span>
            </div>
          )}
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
          {it.unitLabel && it.unitGrams != null && (
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={it.unitCount ?? 1}
                onChange={(e) => updateUnitCount(i, Math.max(0, Number(e.target.value) || 0))}
                className="w-16 rounded-lg border border-white/10 bg-white/[0.04] px-1 py-1 text-center text-sm font-bold"
                aria-label={`${it.unitLabel} adedi`}
              />
              <span className="text-sm font-semibold text-emerald-300">{it.unitLabel}</span>
              <span className="text-xs text-slate-500">
                (1 {it.unitLabel} ≈ {it.unitGrams} g)
              </span>
            </div>
          )}
          <div className="grid grid-cols-5 gap-1.5">
            <label className="block">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={it.grams}
                onChange={(e) => updateGrams(i, Math.max(0, Number(e.target.value) || 0))}
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
                onChange={(e) => updateMacro(i, { calories: Math.max(0, Number(e.target.value) || 0) })}
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
                onChange={(e) => updateMacro(i, { proteinG: Math.max(0, Number(e.target.value) || 0) })}
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
                onChange={(e) => updateMacro(i, { carbsG: Math.max(0, Number(e.target.value) || 0) })}
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
                onChange={(e) => updateMacro(i, { fatG: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-1 py-1.5 text-center text-sm font-bold"
              />
              <div className="text-center text-[9px] text-slate-400">Y g</div>
            </label>
          </div>
        </Card>
        );
      })}

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
        {error && <div className="text-center text-sm text-rose-400">{error}</div>}
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

      <Button className="w-full" disabled={validItems.length === 0 || submitting} onClick={confirm}>
        {submitting ? 'Ekleniyor…' : `${MEAL_LABELS[mealType]} Öğününe Ekle (${validItems.length} öğe)`}
      </Button>
    </>
  );
}
