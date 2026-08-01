import Dexie, { type Table } from 'dexie';
import { SEED_EXERCISES } from './data/exercises';

export type MuscleGroup = 'gogus' | 'sirt' | 'bacak' | 'omuz' | 'kol' | 'karin' | 'kardiyo';

export const MUSCLE_GROUPS: { key: MuscleGroup; label: string }[] = [
  { key: 'gogus', label: 'Göğüs' },
  { key: 'sirt', label: 'Sırt' },
  { key: 'bacak', label: 'Bacak' },
  { key: 'omuz', label: 'Omuz' },
  { key: 'kol', label: 'Kol' },
  { key: 'karin', label: 'Karın' },
  { key: 'kardiyo', label: 'Kardiyo' },
];

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  type: 'resistance' | 'cardio';
  isCustom?: boolean;
}

export interface TemplateExercise {
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  startWeightKg?: number;
  targetDurationMin?: number;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  exercises: TemplateExercise[];
}

export interface ScheduleDay {
  dayOfWeek: number; // 0 = Pazartesi ... 6 = Pazar
  templateId: number | null;
}

export interface SetEntry {
  reps?: number;
  weightKg?: number;
  durationMin?: number;
}

export interface SessionEntry {
  exerciseId: string;
  repMin: number;
  repMax: number;
  sets: SetEntry[];
}

export interface WorkoutSession {
  id?: number;
  templateId: number;
  templateName: string;
  date: string; // YYYY-MM-DD
  startedAt: string;
  finishedAt?: string;
  entries: SessionEntry[];
}

export interface Fast {
  id?: number;
  protocol: string;
  targetHours: number;
  startedAt: string;
  endedAt?: string;
  completed?: boolean;
}

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type NutritionGoal = 'lose' | 'maintain' | 'gain';

export interface UserProfile {
  id: number; // her zaman 1 — tekil profil
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  goalRateKgPerWeek: number;
}

/** Gram dışında doğal bir ölçü birimi (1 adet yumurta, 1 dilim ekmek, 1 porsiyon…).
 * `grams` bir birimin gram karşılığıdır. */
export interface Serving {
  label: string;
  grams: number;
}

export interface FoodItem {
  id: string; // barkod (OFF) ya da 'custom_' + zaman damgası
  name: string;
  brand?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: 'openfoodfacts' | 'custom' | 'ai';
  servings?: Serving[];
}

export type MealType = 'kahvalti' | 'ogle' | 'aksam' | 'ara';

export const MEAL_LABELS: Record<MealType, string> = {
  kahvalti: 'Kahvaltı',
  ogle: 'Öğle',
  aksam: 'Akşam',
  ara: 'Ara Öğün',
};

export interface DiaryEntry {
  id?: number;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  foodId: string;
  foodName: string;
  grams: number; // her zaman dolu — hesaplamalar bunun üzerinden yapılır
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: string;
  // Gram yerine bir birimle girildiyse ("2 adet") gösterim için saklanır.
  // grams === unitCount * unitGrams olur.
  unitLabel?: string;
  unitCount?: number;
  unitGrams?: number;
}

export interface BodyWeightEntry {
  id?: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (akıllı tartı gibi zaman damgalı kaynaklarda)
  weightKg: number;
  bmi?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  muscleMassPct?: number;
  waterPct?: number;
  boneMassKg?: number;
  visceralFat?: number;
  bodyAge?: number;
  source?: 'manual' | 'eufy';
}

class FitDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, number>;
  schedule!: Table<ScheduleDay, number>;
  sessions!: Table<WorkoutSession, number>;
  fasts!: Table<Fast, number>;
  profile!: Table<UserProfile, number>;
  foods!: Table<FoodItem, string>;
  diaryEntries!: Table<DiaryEntry, number>;
  bodyWeights!: Table<BodyWeightEntry, number>;

  constructor() {
    super('fittakip');
    this.version(1).stores({
      exercises: 'id, muscleGroup, type',
      templates: '++id',
      schedule: 'dayOfWeek',
      sessions: '++id, date, templateId',
      fasts: '++id, startedAt',
    });
    this.version(2).stores({
      exercises: 'id, muscleGroup, type',
      templates: '++id',
      schedule: 'dayOfWeek',
      sessions: '++id, date, templateId',
      fasts: '++id, startedAt',
      profile: 'id',
      foods: 'id, source',
      diaryEntries: '++id, date, mealType',
      bodyWeights: '++id, date',
    });
    this.on('populate', async () => {
      await this.exercises.bulkAdd(SEED_EXERCISES);
      await this.schedule.bulkAdd(
        Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, templateId: null })),
      );
    });
    // Kütüphaneye yeni hareket eklendiğinde mevcut kurulumları senkronize et
    // (özel hareketler farklı id ön ekine sahip olduğu için etkilenmez).
    this.on('ready', async () => {
      await this.exercises.bulkPut(SEED_EXERCISES);
    });
  }
}

export const db = new FitDB();

export function exerciseImageUrl(ex: Exercise): string | null {
  if (ex.isCustom) return null;
  return `${import.meta.env.BASE_URL}exercises/${ex.id}.jpg`;
}

export const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** JS Date.getDay() (0=Pazar) → bizim indeks (0=Pazartesi) */
export function todayIndex(d = new Date()): number {
  return (d.getDay() + 6) % 7;
}

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
