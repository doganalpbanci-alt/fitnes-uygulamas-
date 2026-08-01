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
  /** Besin doğal olarak sayılabiliyorsa ("adet", "dilim") birim bilgisi. */
  unitLabel?: string;
  unitCount?: number;
  unitGrams?: number;
  /** Modelin bu öğe için kendi bildirdiği güven değeri (0–1). */
  confidence?: number;
  /** Yalnızca arayüzde kullanılan, 100 g başına sabit taban. Gram değiştikçe besin değerleri
   * hep bu tabandan yeniden hesaplanır; böylece art arda yapılan düzenlemelerde yuvarlama
   * hatası birikmez. Kullanıcı kalori/makroyu elle değiştirince temizlenir, API'ye gönderilmez. */
  per100?: { calories: number; proteinG: number; carbsG: number; fatG: number };
}

/** Öğenin 100 g başına değerleri — kaydedilmiş taban varsa o, yoksa mevcut değerlerden türetilir. */
export function itemPer100(it: AiFoodItem): NonNullable<AiFoodItem['per100']> {
  if (it.per100) return it.per100;
  if (!(it.grams > 0)) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const k = 100 / it.grams;
  return {
    calories: it.calories * k,
    proteinG: it.proteinG * k,
    carbsG: it.carbsG * k,
    fatG: it.fatG * k,
  };
}

/** Bu eşiğin altındaki öğeler kullanıcıya "kontrol et" diye işaretlenir. */
export const LOW_CONFIDENCE = 0.6;

export interface AiChatTurn {
  reply: string;
  items: AiFoodItem[];
}

type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

const MODEL_STORAGE = 'fittakip_openai_model';

export interface AiModelOption {
  id: string;
  label: string;
  desc: string;
}

/** Kullanılabilir görsel modeller. Maliyet kullanıcının kendi OpenAI hesabından çıktığı için
 * seçim ona bırakılıyor. */
export const AI_MODELS: AiModelOption[] = [
  { id: 'gpt-4o-mini', label: 'Hızlı', desc: 'Düşük maliyet, günlük kullanım için yeterli' },
  { id: 'gpt-4o', label: 'Hassas', desc: 'Porsiyon tahmininde daha isabetli, birkaç kat maliyetli' },
];

export const DEFAULT_MODEL = AI_MODELS[0].id;

export function getAiModel(): string {
  const saved = localStorage.getItem(MODEL_STORAGE);
  return AI_MODELS.some((m) => m.id === saved) ? saved! : DEFAULT_MODEL;
}

export function setAiModel(id: string) {
  localStorage.setItem(MODEL_STORAGE, id);
}

const SYSTEM_PROMPT =
  'Sen bir beslenme uzmanısın. Kullanıcı sana ya bir tabak/yemek fotoğrafı ya da yediği yemeğin yazılı bir ' +
  'tarifini gönderir (besin veritabanında bulamadığı ev yemekleri, yöresel tarifler için). HER AYRI besini/' +
  'yemeği TEK TEK, ayrı satırlar halinde listele (örn. bir kahvaltı tabağında ya da tarifinde "haşlanmış ' +
  'yumurta", "beyaz peynir", "zeytin", "ekmek", "kızarmış patates" ayrı ayrı öğeler olmalı — hepsini tek bir ' +
  'satırda toplama). Aynı türden birden fazla parça varsa tek satırda birleştirebilirsin (örn. "2 haşlanmış ' +
  'yumurta"). Her öğe için tarif edilen/gördüğün porsiyonun TAMAMI için (100g için değil) besin değerlerini ' +
  'tahmin et. PORSİYON TAHMİNİ: fotoğraftaki bilinen boyutlu nesneleri ölçek referansı al — standart yemek ' +
  'tabağı ~26 cm, çay tabağı ~15 cm, çatal ~19 cm, yemek kaşığı dolusu ~15 g, çay bardağı ~110 ml, su ' +
  'bardağı ~200 ml. Besinin tabağın ne kadarını kapladığını ve kalınlığını/yüksekliğini de hesaba kat, ' +
  'yalnızca göz kararı bir sayı verme. Kalori ile makrolar tutarlı olmalı: protein×4 + karbonhidrat×4 + ' +
  'yağ×9 ≈ kalori. Kullanıcı bir düzeltme yaparsa ("bu peynir değil beyaz peynir", "patates miktarı daha az", ' +
  '"yumurta yok say" gibi) bunu dikkate alıp ilgili öğeyi güncelle veya kaldır, ardından GÜNCEL TÜM listeyi ' +
  'yeniden gönder. Besin doğal olarak sayılabilen bir birimle ölçülüyorsa (yumurta→adet, ekmek→dilim, ' +
  'zeytin→adet, muz→adet, çorba→kase gibi) "unit" alanına birimin TEKİL Türkçe adını, "unitCount" alanına ' +
  'kaç birim olduğunu ve "unitGrams" alanına BİR birimin gram karşılığını yaz; ölçülemiyorsa (pilav, salata, ' +
  'kıyma gibi) bu üç alanı null bırak. estimatedGrams her durumda dolu olmalı ve birim verdiysen ' +
  'unitCount × unitGrams ile tutarlı olmalı. HER ZAMAN sadece şu şekilde bir JSON nesnesi döndür, başka ' +
  'Her öğe için "confidence" alanına 0 ile 1 arasında bir güven değeri yaz: besini net tanıyıp porsiyonu ' +
  'rahat kestirebiliyorsan yüksek (0.8+), tabakta üst üste binmiş/kısmen görünen ya da hangi besin olduğundan ' +
  'emin olamadığın durumlarda düşük (0.5 altı) ver. Abartma, dürüst ol. ' +
  'HER ZAMAN sadece şu şekilde bir JSON nesnesi döndür, başka ' +
  'hiçbir şey yazma: {"reply": kullanıcıya kısa Türkçe yanıtın (1 cümle), "items": [{"name": Türkçe besin ' +
  'adı, "estimatedGrams": sayı, "calories": sayı, "proteinG": sayı, "carbsG": sayı, "fatG": sayı, ' +
  '"unit": metin|null, "unitCount": sayı|null, "unitGrams": sayı|null, "confidence": 0-1 arası sayı}, ...]}';

function num(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? Math.max(0, v) : 0;
}

/** Atwater katsayıları — makrolardan kalori: protein/karbonhidrat 4, yağ 9 kcal/g. */
export function caloriesFromMacros(proteinG: number, carbsG: number, fatG: number): number {
  return proteinG * 4 + carbsG * 4 + fatG * 9;
}

const MACRO_MISMATCH_TOLERANCE = 0.2;

/** Modelin verdiği kalori ile makroların ima ettiği kalori tutarsız olabiliyor (ör. "200 kcal"
 * derken makroları 350 kcal'ye denk gelmek). Sapma %20'yi aşarsa makrolar, belirtilen kaloriye
 * oranla ölçeklenir: modelin amaçladığı makro *dağılımı* korunur ama sayılar kendi içinde
 * tutarlı hâle gelir — yoksa günlükteki kalori toplamı makro çubuklarıyla çelişiyordu. */
export function reconcileMacros(item: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}): { proteinG: number; carbsG: number; fatG: number; adjusted: boolean } {
  const implied = caloriesFromMacros(item.proteinG, item.carbsG, item.fatG);
  if (item.calories <= 0 || implied <= 0) {
    return { proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, adjusted: false };
  }
  const drift = Math.abs(implied - item.calories) / item.calories;
  if (drift <= MACRO_MISMATCH_TOLERANCE) {
    return { proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, adjusted: false };
  }
  const k = item.calories / implied;
  return {
    proteinG: Math.round(item.proteinG * k * 10) / 10,
    carbsG: Math.round(item.carbsG * k * 10) / 10,
    fatG: Math.round(item.fatG * k * 10) / 10,
    adjusted: true,
  };
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
    // Düşük temperature: bu bir yaratıcılık değil tahmin işi — aynı fotoğrafın her analizde
    // benzer gramajlar vermesi isteniyor.
    body: JSON.stringify({
      model: getAiModel(),
      response_format: { type: 'json_object' },
      max_tokens: 700,
      temperature: 0.2,
      messages,
    }),
  });

  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error('request-failed');

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('empty-response');
  const parsed = JSON.parse(content);

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: AiFoodItem[] = rawItems.map((it: Record<string, unknown>) => {
    const unitLabel = typeof it.unit === 'string' && it.unit.trim() ? it.unit.trim() : undefined;
    const unitGrams = num(it.unitGrams) || undefined;
    const unitCount = num(it.unitCount) || undefined;
    const hasUnit = !!unitLabel && !!unitGrams && !!unitCount;
    // Birim verildiyse gramajı birimden türet — modelin verdiği estimatedGrams ile
    // unitCount × unitGrams çelişirse birim bilgisi esas alınır.
    const grams = hasUnit ? unitCount! * unitGrams! : num(it.estimatedGrams) || 100;
    const calories = Math.round(num(it.calories));
    const macros = reconcileMacros({
      calories,
      proteinG: Math.round(num(it.proteinG) * 10) / 10,
      carbsG: Math.round(num(it.carbsG) * 10) / 10,
      fatG: Math.round(num(it.fatG) * 10) / 10,
    });
    const rawConfidence = typeof it.confidence === 'number' && isFinite(it.confidence) ? it.confidence : undefined;
    return {
      name: typeof it.name === 'string' && it.name.trim() ? it.name.trim() : 'Tanınan Besin',
      grams,
      calories,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      ...(hasUnit ? { unitLabel, unitCount, unitGrams } : {}),
      ...(rawConfidence != null ? { confidence: Math.min(1, Math.max(0, rawConfidence)) } : {}),
    };
  });
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
            unit: it.unitLabel ?? null,
            unitCount: it.unitCount ?? null,
            unitGrams: it.unitGrams ?? null,
            confidence: it.confidence ?? null,
          })),
        }),
      };
      break;
    }
  }
  return callChat([...synced, { role: 'user', content: text }]);
}
