import { create } from 'zustand';
import type { MealType } from './db';

export type Tab = 'home' | 'fasting' | 'nutrition' | 'workout' | 'progress' | 'settings';

export type View =
  | { t: 'tabs' }
  | { t: 'editTemplate'; id?: number }
  | { t: 'session'; templateId: number }
  | { t: 'exerciseDetail'; exerciseId: string }
  | { t: 'sessionSummary'; sessionId: number }
  | { t: 'sessionEdit'; sessionId: number }
  | { t: 'nutritionProfile' }
  | { t: 'foodPicker'; mealType: MealType; date?: string }
  | { t: 'weightHistory' };

interface NavState {
  tab: Tab;
  view: View;
  setTab: (tab: Tab) => void;
  push: (view: View) => void;
  back: () => void;
}

export const useNav = create<NavState>((set) => ({
  tab: 'home',
  view: { t: 'tabs' },
  setTab: (tab) => set({ tab, view: { t: 'tabs' } }),
  push: (view) => set({ view }),
  back: () => set({ view: { t: 'tabs' } }),
}));
