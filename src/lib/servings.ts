import type { DiaryEntry, Serving } from '../db';

/** Gram girişini temsil eden sanal birim. */
export const GRAM_UNIT = 'g';

/** Miktarı okunur biçimde yazar: 1.5 → "1,5" (Türkçe ondalık ayırıcı), 2 → "2". */
export function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',');
}

/** Bir günlük kaydının porsiyon etiketi: birimle girildiyse "2 adet · 136 g", değilse "136 g". */
export function portionLabel(entry: Pick<DiaryEntry, 'grams' | 'unitLabel' | 'unitCount'>): string {
  if (entry.unitLabel && entry.unitCount != null) {
    return `${fmtQty(entry.unitCount)} ${entry.unitLabel} · ${Math.round(entry.grams)} g`;
  }
  return `${Math.round(entry.grams)} g`;
}

/** Aynı etiketli birimleri teke indirir, geçersiz olanları atar. */
export function normalizeServings(servings: (Serving | null | undefined)[]): Serving[] {
  const out: Serving[] = [];
  const seen = new Set<string>();
  for (const s of servings) {
    if (!s) continue;
    const label = s.label?.trim();
    if (!label || !(s.grams > 0)) continue;
    const key = label.toLocaleLowerCase('tr');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, grams: Math.round(s.grams * 10) / 10 });
  }
  return out;
}

/** Open Food Facts'in "serving_size" alanını ("30 g", "1 dilim (25g)") bir birime çevirir. */
export function parseServingSize(raw?: string): Serving | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  // Gram değerini bul: "30 g", "25gr", "(25 g)"
  const gramMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|gram)\b/i);
  if (!gramMatch) return null;
  const grams = Number(gramMatch[1].replace(',', '.'));
  if (!(grams > 0)) return null;
  // Birim adı varsa kullan ("1 dilim (25g)" → "dilim"), yoksa genel "porsiyon"
  const labelMatch = text.match(/^\s*\d+(?:[.,]\d+)?\s*([^\d(),]+)/);
  const label = labelMatch?.[1]?.trim().toLocaleLowerCase('tr');
  const isJustGrams = !label || /^(g|gr|gram)$/i.test(label);
  return { label: isJustGrams ? 'porsiyon' : label, grams };
}
