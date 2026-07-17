import type { ReactNode } from 'react';
import { db, exerciseImageUrl, MUSCLE_GROUPS, type Exercise } from '../db';
import { useNav } from '../store';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-slate-800/70 border border-slate-700/60 p-4 ${onClick ? 'active:bg-slate-700/70 cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
}) {
  const styles = {
    primary: 'bg-emerald-500 text-slate-950 font-semibold active:bg-emerald-400',
    secondary: 'bg-slate-700 text-slate-100 active:bg-slate-600',
    danger: 'bg-rose-600/90 text-white active:bg-rose-500',
    ghost: 'bg-transparent text-slate-300 active:bg-slate-800',
  }[variant];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 text-sm disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 bg-[#0b1020]/95 backdrop-blur px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)]">
      {onBack && (
        <button onClick={onBack} className="-ml-2 rounded-lg p-2 text-slate-300 active:bg-slate-800" aria-label="Geri">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="flex-1 text-xl font-bold">{title}</h1>
      {right}
    </div>
  );
}

export function groupLabel(key: string): string {
  return MUSCLE_GROUPS.find((g) => g.key === key)?.label ?? key;
}

export function ExerciseThumb({ ex, size = 56 }: { ex: Exercise; size?: number }) {
  const url = exerciseImageUrl(ex);
  if (!url) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-700 text-xl"
        style={{ width: size, height: size }}
      >
        {ex.type === 'cardio' ? '🏃' : '🏋️'}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={ex.name}
      width={size}
      height={size}
      loading="lazy"
      className="rounded-lg bg-white object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function OverloadBadge({ suggestedKg }: { suggestedKg?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-400/30">
      🎯 Ağırlığı artırabilirsin{suggestedKg != null ? ` → ${suggestedKg} kg` : ''}
    </span>
  );
}

export function useTab() {
  return useNav((s) => s.tab);
}

export { db };
