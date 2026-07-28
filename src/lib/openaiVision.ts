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

const MODEL = 'gpt-4o-mini';

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? Math.max(0, v) : 0;
}

/** Fotoğraftaki yemeği tanıyıp porsiyonun toplam besin değerlerini tahmin eder. */
export async function analyzeFoodPhoto(dataUrl: string): Promise<AiFoodResult> {
  const key = getOpenAiKey();
  if (!key) throw new Error('no-key');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'Sen bir beslenme uzmanısın. Fotoğraftaki yemeği tanı ve TÜM porsiyon/tabak için toplam besin ' +
            'değerlerini tahmin et (100g için değil, gördüğün porsiyonun tamamı için). Sadece şu alanlara ' +
            'sahip bir JSON nesnesi döndür: name (Türkçe yemek adı), estimatedGrams (sayı), calories (sayı), ' +
            'proteinG (sayı), carbsG (sayı), fatG (sayı).',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Bu fotoğraftaki yemeği tanı ve besin değerlerini tahmin et.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('request-failed');

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty-response');
  const parsed = JSON.parse(content);

  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Tanınan Yemek',
    grams: num(parsed.estimatedGrams) || 100,
    calories: Math.round(num(parsed.calories)),
    proteinG: Math.round(num(parsed.proteinG) * 10) / 10,
    carbsG: Math.round(num(parsed.carbsG) * 10) / 10,
    fatG: Math.round(num(parsed.fatG) * 10) / 10,
  };
}
