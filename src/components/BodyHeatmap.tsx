import type { MuscleGroup } from '../db';
import { groupLabel } from './ui';

type GroupVolume = Partial<Record<MuscleGroup, number>>;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

const SKY: [number, number, number] = [56, 189, 248];
const EMERALD: [number, number, number] = [52, 211, 153];
const ORANGE: [number, number, number] = [251, 146, 60];

/** t: 0 (hiç çalışılmamış) .. 1 (en çok çalışılan bölge) */
function heatColor(t: number): { fill: string; glow: string; opacity: number } {
  if (t <= 0.02) {
    return { fill: 'rgba(148,163,184,0.10)', glow: 'transparent', opacity: 0 };
  }
  const rgb = t < 0.5 ? mixColor(SKY, EMERALD, t / 0.5) : mixColor(EMERALD, ORANGE, (t - 0.5) / 0.5);
  const [r, g, b] = rgb.map(Math.round);
  return {
    fill: `rgba(${r},${g},${b},0.88)`,
    glow: `rgba(${r},${g},${b},${0.45 + t * 0.4})`,
    opacity: 6 + t * 16,
  };
}

function Region({ d, t, rx }: { d: string; t: number; rx?: number }) {
  const { fill, glow, opacity } = heatColor(t);
  const style = glow !== 'transparent' ? { filter: `drop-shadow(0 0 ${opacity}px ${glow})` } : undefined;
  if (rx != null) {
    // d holds "x,y,w,h" packed for rects
    const [x, y, w, h] = d.split(',').map(Number);
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={fill}
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={0.7}
        style={style}
      />
    );
  }
  return <path d={d} fill={fill} stroke="rgba(255,255,255,0.14)" strokeWidth={0.7} style={style} />;
}

function FigureBase() {
  return (
    <>
      <circle cx="50" cy="17" r="13" fill="rgba(203,213,225,0.18)" />
      <rect x="45" y="28" width="10" height="9" rx="3" fill="rgba(203,213,225,0.14)" />
    </>
  );
}

function FrontFigure({ groupT }: { groupT: (g: MuscleGroup) => number }) {
  return (
    <svg viewBox="0 0 100 220" className="h-full w-full">
      <FigureBase />
      {/* Omuz */}
      <Region d="21,40,58,18" rx={9} t={groupT('omuz')} />
      {/* Göğüs */}
      <Region d="30,42,40,28" rx={8} t={groupT('gogus')} />
      {/* Karın */}
      <Region d="34,71,32,34" rx={8} t={groupT('karin')} />
      {/* Kollar */}
      <Region d="12,50,12,42" rx={6} t={groupT('kol')} />
      <Region d="76,50,12,42" rx={6} t={groupT('kol')} />
      <Region d="10,90,12,36" rx={6} t={groupT('kol')} />
      <Region d="78,90,12,36" rx={6} t={groupT('kol')} />
      {/* Bacaklar */}
      <Region d="34,107,15,92" rx={7} t={groupT('bacak')} />
      <Region d="51,107,15,92" rx={7} t={groupT('bacak')} />
    </svg>
  );
}

function BackFigure({ groupT }: { groupT: (g: MuscleGroup) => number }) {
  return (
    <svg viewBox="0 0 100 220" className="h-full w-full">
      <FigureBase />
      {/* Omuz (arka delt) */}
      <Region d="21,40,58,18" rx={9} t={groupT('omuz')} />
      {/* Sırt (tüm sırt tek bölge) */}
      <Region d="30,42,40,63" rx={9} t={groupT('sirt')} />
      {/* Kollar (triceps) */}
      <Region d="12,50,12,42" rx={6} t={groupT('kol')} />
      <Region d="76,50,12,42" rx={6} t={groupT('kol')} />
      <Region d="10,90,12,36" rx={6} t={groupT('kol')} />
      <Region d="78,90,12,36" rx={6} t={groupT('kol')} />
      {/* Bacaklar (hamstring/kalf) */}
      <Region d="34,107,15,92" rx={7} t={groupT('bacak')} />
      <Region d="51,107,15,92" rx={7} t={groupT('bacak')} />
    </svg>
  );
}

export function BodyHeatmap({ groupVolume }: { groupVolume: GroupVolume }) {
  const entries = Object.entries(groupVolume) as [MuscleGroup, number][];
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const groupT = (g: MuscleGroup) => Math.max(0, (groupVolume[g] ?? 0) / max);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex gap-6 opacity-40">
          <div className="h-40 w-20">
            <FrontFigure groupT={() => 0} />
          </div>
          <div className="h-40 w-20">
            <BackFigure groupT={() => 0} />
          </div>
        </div>
        <div className="text-sm text-slate-400">
          Antrenman kaydettikçe çalıştığın bölgeler burada parlamaya başlayacak.
        </div>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-44 w-24">
            <FrontFigure groupT={groupT} />
          </div>
          <span className="text-[11px] font-medium text-slate-500">Ön</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-44 w-24">
            <BackFigure groupT={groupT} />
          </div>
          <span className="text-[11px] font-medium text-slate-500">Arka</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {sorted.map(([g, v]) => {
          const t = groupT(g);
          const { glow } = heatColor(t);
          return (
            <div key={g} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: glow === 'transparent' ? 'rgba(148,163,184,0.3)' : glow, boxShadow: glow !== 'transparent' ? `0 0 6px ${glow}` : undefined }}
              />
              <span className="flex-1 text-slate-300">{groupLabel(g)}</span>
              <span className="text-slate-500">{Math.round((v / total) * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
