import type { ReactNode } from 'react';
import { db, exerciseImageUrl, MUSCLE_GROUPS, type Exercise } from '../db';
import { useNav } from '../store';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`card-base p-4 ${onClick ? 'card-tap cursor-pointer active:bg-white/[0.06]' : ''} ${className}`}
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
    primary:
      'bg-gradient-to-b from-emerald-400 to-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/25 border border-emerald-300/30',
    secondary: 'bg-white/[0.07] text-slate-100 border border-white/[0.08] font-medium',
    danger: 'bg-gradient-to-b from-rose-500 to-rose-600 text-white font-semibold shadow-lg shadow-rose-500/20',
    ghost: 'bg-transparent text-slate-300',
  }[variant];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`btn-tap rounded-xl px-4 py-3 text-sm disabled:opacity-40 disabled:shadow-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.04] bg-[#070a14]/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl">
      {onBack && (
        <button
          onClick={onBack}
          className="btn-tap -ml-2 rounded-lg p-2 text-slate-300 active:bg-white/[0.06]"
          aria-label="Geri"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="flex-1 text-[22px] font-bold tracking-tight text-slate-50">{title}</h1>
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
        className="flex shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-gradient-to-br from-slate-700 to-slate-800 text-xl"
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
      className="shrink-0 rounded-xl bg-white object-cover ring-1 ring-white/[0.08]"
      style={{ width: size, height: size }}
    />
  );
}

export function OverloadBadge({ suggestedKg }: { suggestedKg?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-400/15 to-orange-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
      🎯 Ağırlığı artırabilirsin{suggestedKg != null ? ` → ${suggestedKg} kg` : ''}
    </span>
  );
}

export function useTab() {
  return useNav((s) => s.tab);
}

export { db };
