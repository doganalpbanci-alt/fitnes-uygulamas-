import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, MEAL_LABELS, todayStr, type FoodItem, type MealType } from '../db';
import { BUILTIN_FOODS } from '../data/foods';
import { useNutritionTargets } from '../lib/useTargets';
import { searchFoods, type OFFProduct } from '../lib/openFoodFacts';
import {
  computeFrequentFoods,
  computeRecentFoods,
  dedupeFoodsByName,
  fuzzyFilterSort,
  fuzzyScoreWithAliases,
  type FrequentFood,
  type RecentFood,
} from '../lib/foodSearch';
import { GRAM_UNIT, fmtQty, normalizeServings } from '../lib/servings';
import { useNav } from '../store';
import { Button, Card, ScreenHeader } from '../components/ui';
import PhotoFoodScan from './PhotoFoodScan';
import TextFoodScan from './TextFoodScan';

const SOURCE_ICON: Record<FoodItem['source'], string> = {
  builtin: '🥗',
  openfoodfacts: '🌐',
  custom: '✏️',
  ai: '📷',
};

interface FoodRow {
  key: string;
  food: FoodItem;
  grams: number;
  calories: number;
  servingLabel: string;
  /** Daha önce bu birimle eklendiyse, miktar ekranı aynı birimle açılsın. */
  unitLabel?: string;
}

/** Birimle eklenmiş bir porsiyonu "2 adet · 136 g", gramla eklenmişi "136 g" diye yazar. */
function servingLabelFor(grams: number, unitLabel?: string, unitCount?: number): string {
  if (unitLabel && unitCount != null) return `${fmtQty(unitCount)} ${unitLabel} · ${Math.round(grams)} g`;
  return `${Math.round(grams)} g`;
}

/** Besinin doğal bir ölçüsü varsa satırı onunla göster ("1 dilim · 30 g"), yoksa 100 g üzerinden. */
function rowFromFoodItem(food: FoodItem, grams?: number): FoodRow {
  const first = normalizeServings(food.servings ?? [])[0];
  const useServing = grams == null && first != null;
  const g = useServing ? first.grams : grams ?? 100;
  const factor = g / 100;
  return {
    key: food.id,
    food,
    grams: g,
    calories: Math.round(food.caloriesPer100g * factor),
    servingLabel: useServing ? `1 ${first.label} · ${Math.round(g)} g` : `${Math.round(g)} g`,
    unitLabel: useServing ? first.label : undefined,
  };
}

function rowFromOff(p: OFFProduct): FoodRow {
  return rowFromFoodItem(
    { id: p.id, name: p.name, brand: p.brand, caloriesPer100g: p.caloriesPer100g, proteinPer100g: p.proteinPer100g, carbsPer100g: p.carbsPer100g, fatPer100g: p.fatPer100g, source: 'openfoodfacts', servings: p.servings },
    100,
  );
}

function rowFromLogged(f: FrequentFood | RecentFood): FoodRow {
  return {
    key: f.foodId,
    food: { id: f.foodId, name: f.name, caloriesPer100g: f.caloriesPer100g, proteinPer100g: f.proteinPer100g, carbsPer100g: f.carbsPer100g, fatPer100g: f.fatPer100g, source: 'custom' },
    grams: f.lastGrams,
    calories: Math.round((f.caloriesPer100g * f.lastGrams) / 100),
    servingLabel: servingLabelFor(f.lastGrams, f.lastUnitLabel, f.lastUnitCount),
    unitLabel: f.lastUnitLabel,
  };
}

function FoodRowCard({
  row,
  tgd,
  selected,
  onToggleSelect,
  onOpen,
}: {
  row: FoodRow;
  tgd: number | null;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <Card className="flex items-center justify-between py-2.5">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="truncate font-semibold">
          <span className="mr-1">{SOURCE_ICON[row.food.source]}</span>
          {row.food.name}
        </div>
        <div className="truncate text-xs">
          <span className="text-emerald-400">{row.servingLabel}</span>
          <span className="text-slate-500"> · {row.calories} kcal</span>
          {tgd != null && <span className="text-slate-500"> · TGD %{tgd}</span>}
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        aria-label={selected ? 'Seçimi kaldır' : 'Seç'}
        className={`ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-white/20 text-transparent'
        }`}
      >
        <span className="text-xs leading-none">✓</span>
      </button>
    </Card>
  );
}

function GramsStep({
  food,
  mealType,
  initialGrams,
  initialUnit,
  onDone,
  onBack,
}: {
  food: FoodItem;
  mealType: MealType;
  initialGrams?: number;
  initialUnit?: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  // useState güncellemesi bir sonraki render'a kadar yansımadığı için hızlı art arda dokunmalarda
  // hâlâ eski değeriyle okunabiliyordu — gerçek koruma senkron güncellenen bir ref üzerinden yapılıyor.
  const submittingRef = useRef(false);
  // Besinin birimleri düzenlenebilir olduğu için state'te tutuluyor: kullanıcı burada yeni bir
  // birim tanımlayabiliyor ve bu birim besinle birlikte kalıcı olarak kaydediliyor.
  const [servings, setServings] = useState(() => normalizeServings(food.servings ?? []));
  // Başlangıç birimi: daha önce bu birimle eklendiyse onu, yoksa varsa ilk birimi, yoksa gramı seç.
  const [unit, setUnit] = useState(() => {
    const initial = normalizeServings(food.servings ?? []);
    if (initialUnit && initial.some((s) => s.label === initialUnit)) return initialUnit;
    return initial[0]?.label ?? GRAM_UNIT;
  });
  const activeServing = servings.find((s) => s.label === unit);
  const [qty, setQty] = useState(() => {
    const initial = normalizeServings(food.servings ?? []);
    const startGrams = initialGrams ?? 100;
    const s = initialUnit ? initial.find((x) => x.label === initialUnit) : initial[0];
    return s ? fmtQty(Math.round((startGrams / s.grams) * 100) / 100) : String(startGrams);
  });
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitLabel, setNewUnitLabel] = useState('');
  const [newUnitGrams, setNewUnitGrams] = useState('');

  const addUnit = () => {
    const label = newUnitLabel.trim();
    const grams = Number(newUnitGrams.replace(',', '.'));
    if (!label || !(grams > 0)) return;
    const next = normalizeServings([...servings, { label, grams }]);
    setServings(next);
    setUnit(label);
    // Yeni birimde, o ana kadarki gram miktarına denk gelen adedi göster.
    setQty(fmtQty(Math.round((g / grams) * 100) / 100) || '1');
    setAddingUnit(false);
    setNewUnitLabel('');
    setNewUnitGrams('');
  };

  const qtyNum = Math.max(0, Number(qty.replace(',', '.')) || 0);
  const g = activeServing ? qtyNum * activeServing.grams : qtyNum;
  const factor = g / 100;
  const calories = Math.round(food.caloriesPer100g * factor);
  const proteinG = Math.round(food.proteinPer100g * factor * 10) / 10;
  const carbsG = Math.round(food.carbsPer100g * factor * 10) / 10;
  const fatG = Math.round(food.fatPer100g * factor * 10) / 10;

  // Birim değişince miktarı, gram karşılığı yaklaşık aynı kalacak şekilde çevir.
  const switchUnit = (next: string) => {
    const from = activeServing?.grams ?? 1;
    const to = servings.find((s) => s.label === next)?.grams ?? 1;
    const currentGrams = qtyNum * from;
    setUnit(next);
    setQty(fmtQty(Math.round((currentGrams / to) * 100) / 100));
  };

  const confirm = async () => {
    // İkinci dokunuşu yok say — aksi halde aynı kayıt iki kez eklenip öğün toplamı şişebiliyordu.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    // Burada tanımlanan birimler besinle kaydedilir; bir dahaki eklemede hazır gelir.
    await db.foods.put({ ...food, servings: servings.length ? servings : undefined });
    await db.diaryEntries.add({
      date: todayStr(),
      mealType,
      foodId: food.id,
      foodName: food.name,
      grams: Math.round(g * 10) / 10,
      calories,
      proteinG,
      carbsG,
      fatG,
      loggedAt: new Date().toISOString(),
      ...(activeServing
        ? { unitLabel: activeServing.label, unitCount: qtyNum, unitGrams: activeServing.grams }
        : {}),
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
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {[...servings.map((s) => s.label), GRAM_UNIT].map((label) => (
              <button
                key={label}
                onClick={() => switchUnit(label)}
                className={`btn-tap rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  unit === label
                    ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                }`}
              >
                {label === GRAM_UNIT ? 'gram' : label}
              </button>
            ))}
            {!addingUnit && (
              <button
                onClick={() => setAddingUnit(true)}
                className="btn-tap rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-400"
              >
                + Birim
              </button>
            )}
          </div>
          {addingUnit && (
            <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
              <div className="text-xs text-slate-400">
                Bu besin için bir ölçü tanımla — bir dahaki sefere hazır gelir.
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">1</span>
                <input
                  value={newUnitLabel}
                  onChange={(e) => setNewUnitLabel(e.target.value)}
                  placeholder="adet"
                  autoFocus
                  className="w-24 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm"
                  aria-label="Birim adı"
                />
                <span className="text-xs text-slate-500">=</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={newUnitGrams}
                  onChange={(e) => setNewUnitGrams(e.target.value)}
                  placeholder="60"
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm"
                  aria-label="Birim gramı"
                />
                <span className="text-xs text-slate-500">g</span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 !py-1.5 !text-xs" onClick={() => setAddingUnit(false)}>
                  İptal
                </Button>
                <Button
                  className="flex-1 !py-1.5 !text-xs"
                  disabled={!newUnitLabel.trim() || !(Number(newUnitGrams.replace(',', '.')) > 0)}
                  onClick={addUnit}
                >
                  Ekle
                </Button>
              </div>
            </div>
          )}
          <label className="block">
            <span className="text-sm text-slate-400">
              Miktar ({activeServing ? activeServing.label : 'gram'})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={activeServing ? 0.5 : 1}
              autoFocus
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-2xl font-bold"
            />
          </label>
          {activeServing && (
            <div className="text-center text-xs text-slate-500">
              1 {activeServing.label} ≈ {fmtQty(activeServing.grams)} g · toplam {Math.round(g)} g
            </div>
          )}
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
        <Button className="w-full" disabled={!(g > 0) || submitting} onClick={confirm}>
          {submitting ? 'Ekleniyor…' : 'Günlüğe Ekle'}
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
  const [unitLabel, setUnitLabel] = useState('');
  const [unitGrams, setUnitGrams] = useState('');

  const valid = name.trim().length > 0 && Number(cal) >= 0;

  const create = () => {
    if (!valid) return;
    const servings = normalizeServings([
      unitLabel.trim() && Number(unitGrams) > 0
        ? { label: unitLabel.trim(), grams: Number(unitGrams) }
        : null,
    ]);
    onCreated({
      id: 'custom_' + Date.now(),
      name: name.trim(),
      caloriesPer100g: Math.max(0, Number(cal) || 0),
      proteinPer100g: Math.max(0, Number(protein) || 0),
      carbsPer100g: Math.max(0, Number(carbs) || 0),
      fatPer100g: Math.max(0, Number(fat) || 0),
      source: 'custom',
      ...(servings.length ? { servings } : {}),
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
      <div className="text-xs text-slate-500">Ölçü birimi (isteğe bağlı) — böylece adet/dilim ile ekleyebilirsin:</div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500">1</span>
        <input
          value={unitLabel}
          onChange={(e) => setUnitLabel(e.target.value)}
          placeholder="adet"
          className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm"
        />
        <span className="text-xs text-slate-500">=</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="60"
          value={unitGrams}
          onChange={(e) => setUnitGrams(e.target.value)}
          className="w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center text-sm"
        />
        <span className="text-xs text-slate-500">gram</span>
      </div>
      <Button variant="secondary" className="w-full" disabled={!valid} onClick={create}>
        Devam Et
      </Button>
    </Card>
  );
}

type PickerTab = 'ara' | 'son' | 'sik';
const TABS: { key: PickerTab; label: string }[] = [
  { key: 'ara', label: '🔍 Ara' },
  { key: 'son', label: '🕐 Son Eklenenler' },
  { key: 'sik', label: '⭐ Sık Yenenler' },
];

export default function FoodPicker({ mealType }: { mealType: MealType }) {
  const back = useNav((s) => s.back);
  const [tab, setTab] = useState<PickerTab>('ara');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<{ food: FoodItem; grams?: number; unitLabel?: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [describing, setDescribing] = useState(false);
  const [selection, setSelection] = useState<Map<string, FoodRow>>(new Map());
  const [showAllSameMeal, setShowAllSameMeal] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const bulkSubmittingRef = useRef(false);

  const myFoods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const diaryEntries = useLiveQuery(() => db.diaryEntries.toArray(), []) ?? [];
  const foodById = useMemo(() => new Map(myFoods.map((f) => [f.id, f])), [myFoods]);

  // Sık/son yenenler listesindeki satırlar günlük kayıtlarından türetiliyor ve birim tanımlarını
  // içermiyor; kayıtlı besin varsa onu kullan ki "adet/dilim" seçenekleri de gelsin.
  const openRow = (row: FoodRow) =>
    setOpened({ food: foodById.get(row.food.id) ?? row.food, grams: row.grams, unitLabel: row.unitLabel });

  const calorieTarget = useNutritionTargets()?.calorieTarget ?? null;
  const tgdFor = (calories: number) => (calorieTarget ? Math.round((calories / calorieTarget) * 100) : null);

  const frequent = useMemo(() => computeFrequentFoods(diaryEntries), [diaryEntries]);
  const recentAll = useMemo(() => computeRecentFoods(diaryEntries), [diaryEntries]);
  const recentSameMeal = useMemo(() => recentAll.filter((r) => r.lastMealType === mealType), [recentAll, mealType]);
  const recentOther = useMemo(() => recentAll.filter((r) => r.lastMealType !== mealType), [recentAll, mealType]);

  const q = query.trim();
  const localMatches = useMemo(
    () => (q.length >= 2 ? fuzzyFilterSort(q, dedupeFoodsByName(myFoods), (f) => f.name, 0.3).slice(0, 8) : []),
    [q, myFoods],
  );
  // Uygulamayla gelen Türkçe veritabanı: çevrimdışı ve anında — internete/debounce'a gerek yok.
  // Kullanıcının kendi kayıtlarında zaten olanlar (ör. birim eklediği) yukarıda listelendiği için
  // burada tekrar gösterilmez.
  const builtinMatches = useMemo(() => {
    if (q.length < 2) return [];
    return BUILTIN_FOODS.filter((f) => !foodById.has(f.id))
      .map((f) => ({ f, score: fuzzyScoreWithAliases(q, f.name, f.aliases) }))
      .filter((x) => x.score >= 0.45)
      .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
      .slice(0, 20)
      .map((x) => x.f);
  }, [q, foodById]);
  const rankedResults = useMemo(() => fuzzyFilterSort(q, results, (p) => p.name, 0), [q, results]);

  useEffect(() => {
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
  }, [q]);

  const toggleSelect = (row: FoodRow) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(row.key)) next.delete(row.key);
      else next.set(row.key, row);
      return next;
    });
  };

  const confirmBulk = async () => {
    if (bulkSubmittingRef.current) return;
    bulkSubmittingRef.current = true;
    setBulkSubmitting(true);
    const date = todayStr();
    const loggedAt = new Date().toISOString();
    for (const row of selection.values()) {
      // Sık/son yenenler satırları günlükten türetildiği için birim tanımı taşımaz; kayıtlı besin
      // varsa onu koru, yoksa satırdakini kaydet — aksi halde tanımlı birimler silinirdi.
      const stored = foodById.get(row.food.id);
      await db.foods.put(stored ?? row.food);
      const serving = normalizeServings((stored ?? row.food).servings ?? []).find(
        (s) => s.label === row.unitLabel,
      );
      const factor = row.grams / 100;
      await db.diaryEntries.add({
        date,
        mealType,
        foodId: row.food.id,
        foodName: row.food.name,
        grams: row.grams,
        calories: row.calories,
        proteinG: Math.round(row.food.proteinPer100g * factor * 10) / 10,
        carbsG: Math.round(row.food.carbsPer100g * factor * 10) / 10,
        fatG: Math.round(row.food.fatPer100g * factor * 10) / 10,
        loggedAt,
        ...(serving
          ? { unitLabel: serving.label, unitCount: Math.round((row.grams / serving.grams) * 100) / 100, unitGrams: serving.grams }
          : {}),
      });
    }
    back();
  };

  if (opened) {
    return (
      <GramsStep
        food={opened.food}
        mealType={mealType}
        initialGrams={opened.grams}
        initialUnit={opened.unitLabel}
        onBack={() => setOpened(null)}
        onDone={back}
      />
    );
  }

  const hasAnyMatch = localMatches.length > 0 || builtinMatches.length > 0 || rankedResults.length > 0;
  const showEmptyState = q.length >= 2 && !loading && !hasAnyMatch && !error;
  const sameMealShown = showAllSameMeal ? recentSameMeal : recentSameMeal.slice(0, 4);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#070a14]">
      <ScreenHeader title={`${MEAL_LABELS[mealType]} · Besin Ekle`} onBack={back} />
      <div className="px-4 pb-2">
        <div className="grid grid-cols-3 gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`btn-tap rounded-xl border px-2 py-2 text-xs font-semibold ${
                tab === t.key
                  ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                  : 'border-white/[0.06] bg-white/[0.02] text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'ara' && (
          <div className="relative mt-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Besin ara… (örn. yulaf ezmesi)"
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
        )}
      </div>
      <div
        className="flex-1 space-y-3 overflow-y-auto px-4"
        style={{ paddingBottom: selection.size > 0 ? 88 : 16 }}
      >
        {tab === 'ara' && (
          <>
            <Card className="flex items-center justify-between py-2.5" onClick={() => setScanning(true)}>
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
                <div className="text-sm font-semibold">Fotoğraftan Ekle (AI)</div>
              </div>
              <span className="text-slate-500">›</span>
            </Card>
            <Card className="flex items-center justify-between py-2.5" onClick={() => setDescribing(true)}>
              <div className="flex items-center gap-2">
                <span className="text-xl">✍️</span>
                <div>
                  <div className="text-sm font-semibold">AI'a Anlat (Yazarak)</div>
                  <div className="text-xs text-slate-400">Veritabanında bulamadığın bir yemek için</div>
                </div>
              </div>
              <span className="text-slate-500">›</span>
            </Card>

            {q.length >= 2 && localMatches.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-sm font-semibold text-slate-400">🍽️ Senin Besinlerin</div>
                {localMatches.map((f) => {
                  const row = rowFromFoodItem(f);
                  return (
                    <FoodRowCard
                      key={row.key}
                      row={row}
                      tgd={tgdFor(row.calories)}
                      selected={selection.has(row.key)}
                      onToggleSelect={() => toggleSelect(row)}
                      onOpen={() => openRow(row)}
                    />
                  );
                })}
              </div>
            )}

            {builtinMatches.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-sm font-semibold text-slate-400">🥗 Besin Veritabanı</div>
                {builtinMatches.map((f) => {
                  const row = rowFromFoodItem(f);
                  return (
                    <FoodRowCard
                      key={row.key}
                      row={row}
                      tgd={tgdFor(row.calories)}
                      selected={selection.has(row.key)}
                      onToggleSelect={() => toggleSelect(row)}
                      onOpen={() => openRow(row)}
                    />
                  );
                })}
              </div>
            )}

            {q.length >= 2 && (loading || rankedResults.length > 0) && (
              <div className="space-y-2">
                <div className="px-1 text-sm font-semibold text-slate-400">🌐 Paketli / Markalı Ürünler</div>
                {loading && <div className="py-2 text-center text-sm text-slate-400">Aranıyor…</div>}
                {!loading &&
                  rankedResults.map((p) => {
                    const row = rowFromOff(p);
                    return (
                      <FoodRowCard
                        key={row.key}
                        row={row}
                        tgd={tgdFor(row.calories)}
                        selected={selection.has(row.key)}
                        onToggleSelect={() => toggleSelect(row)}
                        onOpen={() => openRow(row)}
                      />
                    );
                  })}
              </div>
            )}

            {error && hasAnyMatch && (
              <div className="py-1 text-center text-xs text-slate-500">
                Markalı ürün araması yapılamadı (internet yok) — yukarıdaki sonuçlar çevrimdışı çalışır.
              </div>
            )}
            {error && !hasAnyMatch && <div className="py-2 text-center text-sm text-rose-400">{error}</div>}
            {showEmptyState && (
              <div className="py-2 text-center text-sm text-slate-400">
                Sonuç bulunamadı. Yukarıdaki "AI'a Anlat" ile de ekleyebilirsin.
              </div>
            )}

            <CustomFoodForm onCreated={(food) => setOpened({ food })} />
          </>
        )}

        {tab === 'son' && (
          <>
            {recentAll.length === 0 ? (
              <Card className="text-sm text-slate-400">Henüz kayıtlı besin geçmişin yok.</Card>
            ) : (
              <>
                {recentSameMeal.length > 0 && (
                  <div className="space-y-2">
                    <div className="px-1 text-sm font-semibold text-slate-400">☀️ {MEAL_LABELS[mealType].toUpperCase()}</div>
                    {sameMealShown.map((f) => {
                      const row = rowFromLogged(f);
                      return (
                        <FoodRowCard
                          key={row.key}
                          row={row}
                          tgd={tgdFor(row.calories)}
                          selected={selection.has(row.key)}
                          onToggleSelect={() => toggleSelect(row)}
                          onOpen={() => openRow(row)}
                        />
                      );
                    })}
                    {recentSameMeal.length > 4 && !showAllSameMeal && (
                      <button
                        onClick={() => setShowAllSameMeal(true)}
                        className="w-full py-1 text-center text-sm font-semibold text-emerald-400"
                      >
                        Daha Fazla Göster ▾
                      </button>
                    )}
                  </div>
                )}
                {recentOther.length > 0 && (
                  <div className="space-y-2">
                    <div className="px-1 text-sm font-semibold text-slate-400">🕐 TÜM DİĞER ÖĞÜNLER</div>
                    {recentOther.map((f) => {
                      const row = rowFromLogged(f);
                      return (
                        <FoodRowCard
                          key={row.key}
                          row={row}
                          tgd={tgdFor(row.calories)}
                          selected={selection.has(row.key)}
                          onToggleSelect={() => toggleSelect(row)}
                          onOpen={() => openRow(row)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'sik' && (
          <>
            {frequent.length === 0 ? (
              <Card className="text-sm text-slate-400">Sık yediğin besinler burada görünecek.</Card>
            ) : (
              frequent.map((f) => {
                const row = rowFromLogged(f);
                return (
                  <FoodRowCard
                    key={row.key}
                    row={row}
                    tgd={tgdFor(row.calories)}
                    selected={selection.has(row.key)}
                    onToggleSelect={() => toggleSelect(row)}
                    onOpen={() => openRow(row)}
                  />
                );
              })
            )}
          </>
        )}
      </div>

      {selection.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-[#070a14]/95 px-4 py-3 backdrop-blur-xl">
          <Button className="w-full" disabled={bulkSubmitting} onClick={confirmBulk}>
            {bulkSubmitting ? 'Ekleniyor…' : `${selection.size} seçili · ${MEAL_LABELS[mealType]} Öğününe Ekle`}
          </Button>
        </div>
      )}

      {scanning && <PhotoFoodScan mealType={mealType} onClose={() => setScanning(false)} onDone={back} />}
      {describing && <TextFoodScan mealType={mealType} onClose={() => setDescribing(false)} onDone={back} />}
    </div>
  );
}
