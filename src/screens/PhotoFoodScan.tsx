import { useRef, useState } from 'react';
import { type MealType } from '../db';
import { analyzeFoodPhoto, getOpenAiKey, type AiFoodItem, type ChatMessage } from '../lib/openaiVision';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';
import FoodItemsReview from './FoodItemsReview';

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
  const [initialReply, setInitialReply] = useState('');

  const onFile = (file: File) => {
    setError('');
    setItems(null);
    setMessages(null);
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
