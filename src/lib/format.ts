export function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}s ${String(m).padStart(2, '0')}d`;
  return `${m}d ${String(s).padStart(2, '0')}sn`;
}

export function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
}

export function fmtKg(kg: number): string {
  return `${kg % 1 === 0 ? kg : kg.toFixed(1)} kg`;
}
