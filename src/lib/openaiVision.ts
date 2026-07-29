const KEY_STORAGE = 'fittakip_openai_key';

/** Anahtar yalnızca bu cihazda (localStorage) tutulur — Dexie'ye yazılmadığı için
 * JSON yedeklerine asla dahil olmaz ve hiçbir sunucuya gönderilmez. */
export function getOpenAiKey(): string | null {
  return localStorage.getItem(KEY_STORAGE);
}

export function setOpenAiKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearOpenAiKey() {
  localStorage.removeItem(KEY_STORAGE);
}

export interface AiFoodItem {
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface AiChatTurn {
  reply: string;
  items: AiFoodItem[];
}

type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT =
  'Sen bir beslenme uzmanısın. Kullanıcı sana ya bir tabak/yemek fotoğrafı ya da yediği yemeğin yazılı bir ' +
  'tarifini gönderir (besin veritabanında bulamadığı ev yemekleri, yöresel tarifler için). HER AYRI besini/' +
  'yemeği TEK TEK, ayrı satırlar halinde listele (örn. bir kahvaltı tabağında ya da tarifinde "haşlanmış ' +
  'yumurta", "beyaz peynir", "zeytin", "ekmek", "kızarmış patates" ayrı ayrı öğeler olmalı — hepsini tek bir ' +
  'satırda toplama). Aynı türden birden fazla parça varsa tek satırda birleştirebilirsin (örn. "2 haşlanmış ' +
  'yumurta"). Her öğe için tarif edilen/gördüğün porsiyonun TAMAMI için (100g için değil) besin değerlerini ' +
  'tahmin et. Kullanıcı bir düzeltme yaparsa ("bu peynir değil beyaz peynir", "patates miktarı daha az", ' +
  '"yumurta yok say" gibi) bunu dikkate alıp ilgili öğeyi güncelle veya kaldır, ardından GÜNCEL TÜM listeyi ' +
  'yeniden gönder. HER ZAMAN sadece şu şekilde bir JSON nesnesi döndür, başka hiçbir şey yazma: {"reply": ' +
  'kullanıcıya kısa Türkçe yanıtın (1 cümle), "items": [{"name": Türkçe besin adı, "estimatedGrams": sayı, ' +
  '"calories": sayı, "proteinG": sayı, "carbsG": sayı, "fatG": sayı}, ...]}';

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? Math.max(0, v) : 0;
}

export function buildInitialMessages(dataUrl: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Bu fotoğraftaki tabaktaki her besini tek tek tanı ve besin değerlerini tahmin et.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];
}

async function callChat(messages: ChatMessage[]): Promise<{ turn: AiChatTurn; messages: ChatMessage[] }> {
  const key = getOpenAiKey();
  if (!key) throw new Error('no-key');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, response_format: { type: 'json_object' }, max_tokens: 700, messages }),
  });

  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('request-failed');

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty-response');
  const parsed = JSON.parse(content);

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: AiFoodItem[] = rawItems.map((it: Record<string, unknown>) => ({
    name: typeof it.name === 'string' && it.name.trim() ? it.name.trim() : 'Tanınan Besin',
    grams: num(it.estimatedGrams) || 100,
    calories: Math.round(num(it.calories)),
    proteinG: Math.round(num(it.proteinG) * 10) / 10,
    carbsG: Math.round(num(it.carbsG) * 10) / 10,
    fatG: Math.round(num(it.fatG) * 10) / 10,
  }));
  if (items.length === 0) throw new Error('empty-response');

  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'Tahminimi güncelledim.';

  return { turn: { reply, items }, messages: [...messages, { role: 'assistant', content }] };
}

/** Fotoğraftaki tabağı tanıyıp her besini ayrı ayrı listeler. */
export function analyzeFoodPhoto(dataUrl: string): Promise<{ turn: AiChatTurn; messages: ChatMessage[] }> {
  return callChat(buildInitialMessages(dataUrl));
}

export function buildInitialMessagesFromText(description: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Şu yemeği/besinleri tarif ediyorum, her birini ayrı ayrı tanıyıp besin değerlerini tahmin et: ${description}` },
  ];
}

/** Besin veritabanında bulunamayan bir yemeği yazılı tarifinden tanıyıp her besini ayrı ayrı listeler. */
export function analyzeFoodDescription(description: string): Promise<{ turn: AiChatTurn; messages: ChatMessage[] }> {
  return callChat(buildInitialMessagesFromText(description));
}

/** Kullanıcının düzeltme mesajını sohbete ekleyip öğe listesini güncelletir.
 * `currentItems`, kullanıcının ekrandaki (elle sildiği/düzenlediği dahil) güncel listesidir —
 * AI'ın kendi eski hafızasından değil, kullanıcının GÖRDÜĞÜ listeden devam etmesi için sohbetteki
 * son asistan mesajı gönderilmeden önce bu listeyle senkronize edilir. */
export function sendCorrection(
  messages: ChatMessage[],
  currentItems: AiFoodItem[],
  text: string,
): Promise<{ turn: AiChatTurn; messages: ChatMessage[] }> {
  const synced = [...messages];
  for (let i = synced.length - 1; i >= 0; i--) {
    if (synced[i].role === 'assistant') {
      synced[i] = {
        role: 'assistant',
        content: JSON.stringify({
          reply: '',
          items: currentItems.map((it) => ({
            name: it.name,
            estimatedGrams: it.grams,
            calories: it.calories,
            proteinG: it.proteinG,
            carbsG: it.carbsG,
            fatG: it.fatG,
          })),
        }),
      };
      break;
    }
  }
  return callChat([...synced, { role: 'user', content: text }]);
}
