import type { DiaryEntry, FoodItem, MealType } from '../db';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .trim();
}

/** Türkçe eklerin en yaygın olanları — en uzundan kısaya doğru denenir. */
const SUFFIXES = [
  'larimiz', 'lerimiz', 'lariniz', 'leriniz',
  'lardan', 'lerden', 'larin', 'lerin', 'lari', 'leri', 'lara', 'lere',
  'lar', 'ler', 'imiz', 'iniz', 'dan', 'den', 'tan', 'ten',
  'nin', 'nun', 'in', 'un', 'da', 'de', 'ta', 'te', 'ya', 'ye',
  'si', 'su', 'sı', 'i', 'u', 'a', 'e',
];

/** Türkçedeki ünsüz yumuşaması: "ekmek" → "ekmeği", "fıstık" → "fıstığı".
 * Ek atıldıktan sonra sondaki yumuşamış ünsüzü sertine geri çevirir ki kök eşleşsin. */
const UNSOFTEN: Record<string, string> = { g: 'k', b: 'p', c: 'c', d: 't' };

/** Kelimeyi kabaca köküne indirger: "fistigi" → "fistik", "yumurtasi" → "yumurta".
 * Türkçe sondan eklemeli olduğu için "fıstık" araması "Antep fıstığı" ile eşleşmiyordu.
 * En fazla iki ek atılır ve kök 3 harften kısalırsa değişiklik geri alınır — böylece
 * kısa kelimeler ("bal", "et") yanlışlıkla kırpılmaz. */
export function turkishStem(word: string): string {
  let w = word;
  for (let round = 0; round < 2; round++) {
    const suffix = SUFFIXES.find((s) => w.length - s.length >= 3 && w.endsWith(s));
    if (!suffix) break;
    w = w.slice(0, -suffix.length);
  }
  if (w === word) return w;
  const last = w[w.length - 1];
  if (UNSOFTEN[last] && UNSOFTEN[last] !== last) w = w.slice(0, -1) + UNSOFTEN[last];
  return w;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

/** İki kelime arasındaki benzerlik (0–1): biri diğerini içeriyorsa güçlü, yoksa yazım hatalarına
 * (typo) toleranslı levenshtein benzerliği. Çok kısa kelimelerde (≤2 harf) tesadüfi eşleşmeleri
 * önlemek için levenshtein devre dışı bırakılır. */
function wordSimilarity(qw: string, tw: string): number {
  if (qw === tw) return 1;
  if (tw.includes(qw) || qw.includes(tw)) return 0.9;
  // Türkçe ek farkını ("fistik" ↔ "fistigi") yazım hatası saymadan eşleştir.
  const qs = turkishStem(qw);
  const ts = turkishStem(tw);
  if (qs === ts) return 0.95;
  if (ts.includes(qs) || qs.includes(ts)) return 0.85;
  if (qw.length <= 2 || tw.length <= 2) return 0;
  const dist = levenshtein(qw, tw);
  const maxLen = Math.max(qw.length, tw.length);
  const similarity = 1 - dist / maxLen;
  return similarity > 0.6 ? similarity : 0;
}

/** 0 (eşleşme yok) – 1 (tam eşleşme) arası benzerlik skoru. Türkçe karakterleri normalize eder;
 * tam yazılmamış ya da yazım hatalı aramalarda da en yakın sonuçların bulunabilmesi için her sorgu
 * kelimesini hedefin kelimeleriyle tek tek karşılaştırıp en iyi eşleşmeyi bulur — bu sayede çok
 * kelimeli bir besin adında (ör. "beyaz peynir") tek bir kelimedeki yazım hatası ("peynr") diğer
 * kelimeler yüzünden cezalandırılmaz. */
export function fuzzyScore(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);
  if (!q) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.95;
  if (t.includes(q)) return 0.85;

  const qWords = q.split(/\s+/).filter(Boolean);
  const tWords = t.split(/\s+/).filter(Boolean);
  if (qWords.length === 0 || tWords.length === 0) return 0;

  const perWordScores = qWords.map((qw) => Math.max(0, ...tWords.map((tw) => wordSimilarity(qw, tw))));
  const avg = perWordScores.reduce((a, b) => a + b, 0) / perWordScores.length;
  return avg > 0 ? 0.35 + avg * 0.5 : 0;
}

/** Ada ve eş anlamlılara birlikte bakan skor. Ad üzerinden eşleşme her zaman eş anlamlı
 * üzerinden eşleşmeden önce gelsin diye eş anlamlı skorları hafifçe kısılır. */
export function fuzzyScoreWithAliases(query: string, name: string, aliases?: string[]): number {
  const base = fuzzyScore(query, name);
  if (!aliases?.length) return base;
  const best = Math.max(...aliases.map((a) => fuzzyScore(query, a)));
  return Math.max(base, best * 0.9);
}

export function fuzzyFilterSort<T>(query: string, items: T[], getText: (item: T) => string, minScore = 0.3): T[] {
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getText(item)) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

/** Aynı isme (büyük/küçük harf ve boşluk farkı gözetmeden) sahip kayıtlardan yalnızca birini tutar. */
export function dedupeFoodsByName(foods: FoodItem[]): FoodItem[] {
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const f of foods) {
    const key = normalize(f.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export interface FrequentFood {
  name: string;
  foodId: string;
  lastUnitLabel?: string;
  lastUnitCount?: number;
  count: number;
  lastGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/** Günlükte en sık kaydedilen besinleri (isme göre gruplanmış), en son girilen porsiyon/besin
 * değerleriyle birlikte, sıklık sırasına göre döndürür. */
export function computeFrequentFoods(entries: DiaryEntry[], limit = 12): FrequentFood[] {
  const byName = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const key = normalize(e.foodName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(e);
  }
  return [...byName.values()]
    .map((rows) => {
      const latest = [...rows].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];
      const factor = latest.grams > 0 ? 100 / latest.grams : 1;
      return {
        name: latest.foodName,
        foodId: latest.foodId,
        count: rows.length,
        lastGrams: latest.grams,
        lastUnitLabel: latest.unitLabel,
        lastUnitCount: latest.unitCount,
        caloriesPer100g: Math.round(latest.calories * factor),
        proteinPer100g: Math.round(latest.proteinG * factor * 10) / 10,
        carbsPer100g: Math.round(latest.carbsG * factor * 10) / 10,
        fatPer100g: Math.round(latest.fatG * factor * 10) / 10,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface RecentFood {
  name: string;
  foodId: string;
  lastUnitLabel?: string;
  lastUnitCount?: number;
  lastGrams: number;
  lastLoggedAt: string;
  lastMealType: MealType;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/** Günlükte kaydedilmiş besinleri (isme göre gruplanmış), en son ne zaman/hangi öğünde/ne kadar
 * yendiğiyle birlikte, en yeniden en eskiye doğru döndürür. */
export function computeRecentFoods(entries: DiaryEntry[], limit = 40): RecentFood[] {
  const byName = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const key = normalize(e.foodName);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(e);
  }
  return [...byName.values()]
    .map((rows) => {
      const latest = [...rows].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];
      const factor = latest.grams > 0 ? 100 / latest.grams : 1;
      return {
        name: latest.foodName,
        foodId: latest.foodId,
        lastGrams: latest.grams,
        lastUnitLabel: latest.unitLabel,
        lastUnitCount: latest.unitCount,
        lastLoggedAt: latest.loggedAt,
        lastMealType: latest.mealType,
        caloriesPer100g: Math.round(latest.calories * factor),
        proteinPer100g: Math.round(latest.proteinG * factor * 10) / 10,
        carbsPer100g: Math.round(latest.carbsG * factor * 10) / 10,
        fatPer100g: Math.round(latest.fatG * factor * 10) / 10,
      };
    })
    .sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt))
    .slice(0, limit);
}
