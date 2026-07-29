import { useState } from 'react';
import { type MealType } from '../db';
import { analyzeFoodDescription, getOpenAiKey, type AiFoodItem, type ChatMessage } from '../lib/openaiVision';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';
import FoodItemsReview from './FoodItemsReview';

export default function TextFoodScan({
  mealType,
  onClose,
  onDone,
}: {
  mealType: MealType;
  onClose: () => void;
  onDone: () => void;
}) {
  const setTab = useNav((s) => s.setTab);
  const [hasKey] = useState(() => !!getOpenAiKey());
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AiFoodItem[] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [initialReply, setInitialReply] = useState('');

  const analyze = async () => {
    const text = description.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    try {
      const { turn, messages: msgs } = await analyzeFoodDescription(text);
      setItems(turn.items);
      setMessages(msgs);
      setInitialReply(turn.reply);
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

  if (!hasKey) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[#070a14]">
        <ScreenHeader title="AI'a Anlat" onBack={onClose} />
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
      <ScreenHeader title="AI'a Anlat" onBack={onClose} />
      <div className="space-y-3 px-4">
        {!items && (
          <Card className="space-y-3">
            <div className="text-sm text-slate-400">
              Veritabanında bulamadığın bir yemek mi var? Ne yediğini kendi cümlelerinle anlat, AI besin
              değerlerini tahmin etsin. Ör: <i>"Ev yapımı mercimek çorbası, 1 kase, üzerinde tereyağı ve nane"</i>
              ya da <i>"4 adet ızgara köfte, yanında bulgur pilavı bir tabak"</i>.
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ne yediğini anlat…"
              autoFocus
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
            />
            {!loading && (
              <Button className="w-full" disabled={!description.trim()} onClick={analyze}>
                Analiz Et
              </Button>
            )}
            {loading && <div className="text-center text-sm text-slate-400">Tarif tek tek analiz ediliyor…</div>}
            {error && <div className="text-center text-sm text-rose-400">{error}</div>}
          </Card>
        )}

        {items && messages && (
          <FoodItemsReview
            items={items}
            onItemsChange={setItems}
            messages={messages}
            onMessagesChange={setMessages}
            initialReply={initialReply}
            mealType={mealType}
            onDone={onDone}
          />
        )}
      </div>
    </div>
  );
}
