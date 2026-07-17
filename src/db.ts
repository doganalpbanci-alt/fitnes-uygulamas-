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

class FitDB extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<WorkoutTemplate, number>;
  schedule!: Table<ScheduleDay, number>;
  sessions!: Table<WorkoutSession, number>;
  fasts!: Table<Fast, number>;

  constructor() {
    super('fittakip');
    this.version(1).stores({
      exercises: 'id, muscleGroup, type',
      templates: '++id',
      schedule: 'dayOfWeek',
      sessions: '++id, date, templateId',
      fasts: '++id, startedAt',
    });
    this.on('populate', async () => {
      await this.exercises.bulkAdd(SEED_EXERCISES);
      await this.schedule.bulkAdd(
        Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, templateId: null })),
      );
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
