export interface OFFProduct {
  id: string;
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OFFRawProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: OFFNutriments;
}

function toProduct(p: OFFRawProduct, fallbackId?: string): OFFProduct | null {
  if (!p.product_name || p.nutriments?.['energy-kcal_100g'] == null) return null;
  return {
    id: p.code ?? fallbackId ?? p.product_name,
    name: p.product_name,
    brand: p.brands || undefined,
    caloriesPer100g: Math.round(p.nutriments['energy-kcal_100g'] ?? 0),
    proteinPer100g: Math.round((p.nutriments.proteins_100g ?? 0) * 10) / 10,
    carbsPer100g: Math.round((p.nutriments.carbohydrates_100g ?? 0) * 10) / 10,
    fatPer100g: Math.round((p.nutriments.fat_100g ?? 0) * 10) / 10,
  };
}

/** Open Food Facts (ücretsiz, açık, anahtar gerektirmeyen) besin arama. */
export async function searchFoods(query: string): Promise<OFFProduct[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=25` +
    `&fields=code,product_name,brands,nutriments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Arama başarısız oldu');
  const data = await res.json();
  const products: OFFRawProduct[] = data.products ?? [];
  return products
    .map((p) => toProduct(p))
    .filter((p): p is OFFProduct => p != null);
}
