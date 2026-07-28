import { useEffect, useState } from 'react';
import { db, MEAL_LABELS, type FoodItem, type MealType } from '../db';
import { searchFoods, type OFFProduct } from '../lib/openFoodFacts';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';

function toFoodItem(p: OFFProduct): FoodItem {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    caloriesPer100g: p.caloriesPer100g,
    proteinPer100g: p.proteinPer100g,
    carbsPer100g: p.carbsPer100g,
    fatPer100g: p.fatPer100g,
    source: 'openfoodfacts',
  };
}

function GramsStep({
  food,
  mealType,
  onDone,
  onBack,
}: {
  food: FoodItem;
  mealType: MealType;
  onDone: () => void;
  onBack: () => void;
}) {
  const [grams, setGrams] = useState('100');
  const g = Math.max(0, Number(grams) || 0);
  const factor = g / 100;
  const calories = Math.round(food.caloriesPer100g * factor);
  const proteinG = Math.round(food.proteinPer100g * factor * 10) / 10;
  const carbsG = Math.round(food.carbsPer100g * factor * 10) / 10;
  const fatG = Math.round(food.fatPer100g * factor * 10) / 10;

  const confirm = async () => {
    await db.foods.put(food);
    await db.diaryEntries.add({
      date: new Date().toISOString().slice(0, 10),
      mealType,
      foodId: food.id,
      foodName: food.name,
      grams: g,
      calories,
      proteinG,
      carbsG,
      fatG,
      loggedAt: new Date().toISOString(),
    });
    onDone();
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#070a14]">
      <ScreenHeader title={food.name} onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <Card className="space-y-1">
          {food.brand && <div className="text-sm text-slate-400">{food.brand}</div>}
          <div className="text-xs text-slate-500">{MEAL_LABELS[mealType]} öğününe eklenecek</div>
        </Card>
        <Card>
          <label className="block">
            <span className="text-sm text-slate-400">Miktar (gram)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              autoFocus
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-2xl font-bold"
            />
          </label>
        </Card>
        <Card className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-400">{calories}</div>
            <div className="text-[10px] text-slate-400">kcal</div>
          </div>
          <div>
            <div className="text-lg font-bold">{proteinG}g</div>
            <div className="text-[10px] text-slate-400">Protein</div>
          </div>
          <div>
            <div className="text-lg font-bold">{carbsG}g</div>
            <div className="text-[10px] text-slate-400">Karb.</div>
          </div>
          <div>
            <div className="text-lg font-bold">{fatG}g</div>
            <div className="text-[10px] text-slate-400">Yağ</div>
          </div>
        </Card>
        <Button className="w-full" disabled={g <= 0} onClick={confirm}>
          Günlüğe Ekle
        </Button>
      </div>
    </div>
  );
}

function CustomFoodForm({ onCreated }: { onCreated: (food: FoodItem) => void }) {
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const valid = name.trim().length > 0 && Number(cal) >= 0;

  const create = () => {
    if (!valid) return;
    onCreated({
      id: 'custom_' + Date.now(),
      name: name.trim(),
      caloriesPer100g: Math.max(0, Number(cal) || 0),
      proteinPer100g: Math.max(0, Number(protein) || 0),
      carbsPer100g: Math.max(0, Number(carbs) || 0),
      fatPer100g: Math.max(0, Number(fat) || 0),
      source: 'custom',
    });
  };

  return (
    <Card className="space-y-2">
      <div className="text-sm font-semibold text-slate-300">Aradığın yok mu? Özel besin ekle</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Besin adı"
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm"
      />
      <div className="text-xs text-slate-500">100 gram için besin değerleri:</div>
      <div className="grid grid-cols-4 gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="kcal"
          value={cal}
          onChange={(e) => setCal(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm"
        />
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="P g"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm"
        />
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="K g"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm"
        />
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="Y g"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm"
        />
      </div>
      <Button variant="secondary" className="w-full" disabled={!valid} onClick={create}>
        Devam Et
      </Button>
    </Card>
  );
}

export default function FoodPicker({ mealType }: { mealType: MealType }) {
  const back = useNav((s) => s.back);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<FoodItem | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    const id = setTimeout(async () => {
      try {
        const r = await searchFoods(q);
        setResults(r);
      } catch {
        setError('Arama başarısız oldu — internet bağlantını kontrol et.');
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [query]);

  if (selected) {
    return (
      <GramsStep
        food={selected}
        mealType={mealType}
        onBack={() => setSelected(null)}
        onDone={back}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#070a14]">
      <ScreenHeader title={`${MEAL_LABELS[mealType]} · Besin Ekle`} onBack={back} />
      <div className="px-4 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Besin ara… (örn. yulaf ezmesi)"
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
        />
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {loading && <div className="py-4 text-center text-sm text-slate-400">Aranıyor…</div>}
        {error && <div className="py-2 text-center text-sm text-rose-400">{error}</div>}
        {!loading &&
          results.map((p) => (
            <Card key={p.id} className="flex items-center justify-between py-2.5" onClick={() => setSelected(toFoodItem(p))}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-xs text-slate-400">
                  {p.brand ? `${p.brand} · ` : ''}
                  {p.caloriesPer100g} kcal / 100g
                </div>
              </div>
              <span className="text-emerald-400">+</span>
            </Card>
          ))}
        {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
          <div className="py-2 text-center text-sm text-slate-400">Sonuç bulunamadı.</div>
        )}
        <CustomFoodForm onCreated={setSelected} />
      </div>
    </div>
  );
}
