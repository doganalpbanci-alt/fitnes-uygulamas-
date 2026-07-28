import { todayStr, type BodyWeightEntry, type DiaryEntry } from '../db';

function startOfWeekStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = (d.getDay() + 6) % 7; // 0 = Pazartesi
  d.setDate(d.getDate() - dow);
  return todayStr(d);
}

function avg(nums: number[]): number | undefined {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
}

export interface WeightWeekBucket {
  weekStart: string;
  avgWeightKg: number;
  avgBodyFatPct?: number;
  count: number;
}

/** Kilo kayıtlarını Pazartesi başlangıçlı haftalara gruplayıp haftalık ortalama çıkarır. */
export function computeWeightWeeklyBuckets(entries: BodyWeightEntry[]): WeightWeekBucket[] {
  const byWeek = new Map<string, BodyWeightEntry[]>();
  for (const e of entries) {
    const wk = startOfWeekStr(e.date);
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk)!.push(e);
  }
  return [...byWeek.entries()]
    .map(([weekStart, rows]) => {
      const bodyFat = avg(rows.filter((r) => r.bodyFatPct != null).map((r) => r.bodyFatPct!));
      return {
        weekStart,
        avgWeightKg: Math.round(avg(rows.map((r) => r.weightKg))! * 10) / 10,
        avgBodyFatPct: bodyFat != null ? Math.round(bodyFat * 10) / 10 : undefined,
        count: rows.length,
      };
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface WeightWeeklyChange {
  currentWeekAvg: number;
  previousWeekAvg?: number;
  deltaKg?: number;
  bodyFatDeltaPct?: number;
}

/** Bu haftanın ortalamasını geçen haftayla karşılaştırır. */
export function computeWeightWeeklyChange(buckets: WeightWeekBucket[]): WeightWeeklyChange | null {
  if (buckets.length === 0) return null;
  const current = buckets[buckets.length - 1];
  const previous = buckets.length > 1 ? buckets[buckets.length - 2] : undefined;
  const bodyFatDelta =
    previous && current.avgBodyFatPct != null && previous.avgBodyFatPct != null
      ? Math.round((current.avgBodyFatPct - previous.avgBodyFatPct) * 10) / 10
      : undefined;
  return {
    currentWeekAvg: current.avgWeightKg,
    previousWeekAvg: previous?.avgWeightKg,
    deltaKg: previous ? Math.round((current.avgWeightKg - previous.avgWeightKg) * 10) / 10 : undefined,
    bodyFatDeltaPct: bodyFatDelta,
  };
}

export interface DayNutritionSummary {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionWeeklyStats {
  days: DayNutritionSummary[];
  daysLogged: number;
  avgCalories: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
}

/** Son 7 günün (bugün dahil) günlük besin toplamları ve kayıt yapılan günlere göre ortalaması. */
export function computeNutritionWeeklyStats(entries: DiaryEntry[]): NutritionWeeklyStats {
  const dayList: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayList.push(todayStr(d));
  }
  const byDate = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date)!.push(e);
  }
  const days = dayList.map((date) => {
    const rows = byDate.get(date) ?? [];
    return {
      date,
      calories: rows.reduce((a, r) => a + r.calories, 0),
      proteinG: rows.reduce((a, r) => a + r.proteinG, 0),
      carbsG: rows.reduce((a, r) => a + r.carbsG, 0),
      fatG: rows.reduce((a, r) => a + r.fatG, 0),
    };
  });
  const logged = days.filter((d) => d.calories > 0);
  const denom = logged.length || 1;
  const sum = (key: 'calories' | 'proteinG' | 'carbsG' | 'fatG') => logged.reduce((a, d) => a + d[key], 0);
  return {
    days,
    daysLogged: logged.length,
    avgCalories: Math.round(sum('calories') / denom),
    avgProteinG: Math.round(sum('proteinG') / denom),
    avgCarbsG: Math.round(sum('carbsG') / denom),
    avgFatG: Math.round(sum('fatG') / denom),
  };
}
