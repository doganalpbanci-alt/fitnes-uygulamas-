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

export interface AiFoodResult {
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface AiChatTurn {
  reply: string;
  result: AiFoodResult;
}

type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT =
  'Sen bir beslenme uzmanısın. Kullanıcı sana bir yemek fotoğrafı gönderir; sen TÜM porsiyon/tabak için ' +
  'toplam besin değerlerini tahmin edersin (100g için değil, gördüğün porsiyonun tamamı için). Tahminin ' +
  'yanlış olabilir (yemeği yanlış tanıma, miktarı yanlış tahmin etme) — kullanıcı seni düzeltirse ' +
  '("bu tavuk değil somon", "porsiyon daha büyük, yaklaşık 500 gram" gibi) bunu dikkate alıp tahminini ' +
  'güncelle. HER ZAMAN sadece şu alanlara sahip bir JSON nesnesi döndür, başka hiçbir şey yazma: ' +
  'reply (kullanıcıya kısa Türkçe yanıtın, 1 cümle), name (Türkçe yemek adı), estimatedGrams (sayı), ' +
  'calories (sayı), proteinG (sayı), carbsG (sayı), fatG (sayı).';

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? Math.max(0, v) : 0;
}

export function buildInitialMessages(dataUrl: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Bu fotoğraftaki yemeği tanı ve besin değerlerini tahmin et.' },
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
    body: JSON.stringify({ model: MODEL, response_format: { type: 'json_object' }, max_tokens: 350, messages }),
  });

  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('request-failed');

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty-response');
  const parsed = JSON.parse(content);

  const result: AiFoodResult = {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Tanınan Yemek',
    grams: num(parsed.estimatedGrams) || 100,
    calories: Math.round(num(parsed.calories)),
    proteinG: Math.round(num(parsed.proteinG) * 10) / 10,
    carbsG: Math.round(num(parsed.carbsG) * 10) / 10,
    fatG: Math.round(num(parsed.fatG) * 10) / 10,
  };
  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'Tahminimi güncelledim.';

  return { turn: { reply, result }, messages: [...messages, { role: 'assistant', content }] };
}

/** Fotoğraftaki yemeği tanıyıp porsiyonun toplam besin değerlerini tahmin eder. */
export function analyzeFoodPhoto(dataUrl: string): Promise<{ turn: AiChatTurn; messages: ChatMessage[] }> {
  return callChat(buildInitialMessages(dataUrl));
}

/** Kullanıcının düzeltme mesajını sohbete ekleyip tahmini güncelletir. */
export function sendCorrection(
  messages: ChatMessage[],
  text: string,
): Promise<{ turn: AiChatTurn; messages: ChatMessage[] }> {
  return callChat([...messages, { role: 'user', content: text }]);
}
