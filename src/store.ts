import { create } from 'zustand';

export type Tab = 'home' | 'fasting' | 'workout' | 'progress' | 'settings';

export type View =
  | { t: 'tabs' }
  | { t: 'editTemplate'; id?: number }
  | { t: 'session'; templateId: number }
  | { t: 'exerciseDetail'; exerciseId: string }
  | { t: 'sessionSummary'; sessionId: number };

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
