export interface ParsedEufyEntry {
  member: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
  weightKg: number;
  bmi?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  muscleMassPct?: number;
  waterPct?: number;
  boneMassKg?: number;
  visceralFat?: number;
  bodyAge?: number;
}

// EufyLife "Export All Data" kilo raporundaki sütun sırası
const COL = {
  time: 0,
  member: 1,
  weight: 2,
  bmi: 3,
  bodyFat: 4,
  muscleKg: 6,
  musclePct: 7,
  water: 9,
  boneKg: 12,
  visceralFat: 14,
  bodyAge: 18,
};

/** "0.000000" Eufy'de 'ölçülmedi' anlamına gelir — gerçek bir değer değil. */
function num(v: string | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!isFinite(n) || n === 0) return undefined;
  return n;
}

export function parseEufyWeightCsv(text: string): ParsedEufyEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const out: ParsedEufyEntry[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map((c) => c.trim());
    const member = cols[COL.member];
    const weight = num(cols[COL.weight]);
    const dt = cols[COL.time];
    if (!member || weight == null || !dt) continue;
    const [dateStr, timeStr] = dt.split(' ');
    if (!dateStr) continue;
    out.push({
      member,
      dateStr,
      timeStr: timeStr?.slice(0, 5) ?? '00:00',
      weightKg: weight,
      bmi: num(cols[COL.bmi]),
      bodyFatPct: num(cols[COL.bodyFat]),
      muscleMassKg: num(cols[COL.muscleKg]),
      muscleMassPct: num(cols[COL.musclePct]),
      waterPct: num(cols[COL.water]),
      boneMassKg: num(cols[COL.boneKg]),
      visceralFat: num(cols[COL.visceralFat]),
      bodyAge: num(cols[COL.bodyAge]),
    });
  }
  return out;
}

export interface MemberSummary {
  name: string;
  count: number;
  latestWeight: number;
  latestDate: string;
}

export function summarizeMembers(entries: ParsedEufyEntry[]): MemberSummary[] {
  const byMember = new Map<string, ParsedEufyEntry[]>();
  for (const e of entries) {
    const key = e.member.trim();
    if (!byMember.has(key)) byMember.set(key, []);
    byMember.get(key)!.push(e);
  }
  return [...byMember.entries()]
    .map(([name, rows]) => {
      const sorted = [...rows].sort((a, b) => `${b.dateStr} ${b.timeStr}`.localeCompare(`${a.dateStr} ${a.timeStr}`));
      return { name, count: rows.length, latestWeight: sorted[0].weightKg, latestDate: sorted[0].dateStr };
    })
    .sort((a, b) => b.count - a.count);
}
