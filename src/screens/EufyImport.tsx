import { useRef, useState } from 'react';
import { parseEufyWeightCsv, summarizeMembers, type MemberSummary, type ParsedEufyEntry } from '../lib/eufyImport';
import { importEufyEntries } from '../lib/bodyWeight';
import { Button, Card, ScreenHeader } from '../components/ui';

export default function EufyImport({ onClose }: { onClose: () => void }) {
  const back = onClose;
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<ParsedEufyEntry[] | null>(null);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<number | null>(null);

  const onFile = async (file: File) => {
    setError('');
    setResult(null);
    try {
      const text = await file.text();
      const parsed = parseEufyWeightCsv(text);
      if (parsed.length === 0) throw new Error('empty');
      const summary = summarizeMembers(parsed);
      setEntries(parsed);
      setMembers(summary);
      setSelected(summary[0]?.name ?? null);
    } catch {
      setError('Dosya okunamadı — EufyLife "Export All Data" ile aldığın kilo raporu (CSV) olduğundan emin ol.');
      setEntries(null);
    }
  };

  const memberEntries = selected ? (entries ?? []).filter((e) => e.member.trim() === selected) : [];
  const selectedSummary = members.find((m) => m.name === selected);

  const confirm = async () => {
    const added = await importEufyEntries(memberEntries);
    setResult(added);
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-[#070a14] pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <ScreenHeader title="Eufy'den İçe Aktar" onBack={back} />
      <div className="space-y-3 px-4">
        {!entries && (
          <Card className="space-y-3 text-center">
            <div className="text-3xl">⚖️</div>
            <div className="text-sm text-slate-400">
              EufyLife uygulamasında <b>Me → Data → Export All Data</b> ile aldığın kilo raporu CSV dosyasını seç.
            </div>
            <Button className="w-full" onClick={() => fileRef.current?.click()}>
              CSV Dosyası Seç
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            {error && <div className="text-sm text-rose-400">{error}</div>}
          </Card>
        )}

        {entries && result == null && (
          <>
            <Card className="space-y-2">
              <div className="font-semibold">Bu tartı birden fazla kişi tarafından kullanılıyor gibi görünüyor</div>
              <div className="text-sm text-slate-400">Hangi profil sana ait? Sadece seçtiğin kişinin ölçümleri aktarılacak.</div>
              <div className="space-y-1.5">
                {members.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => setSelected(m.name)}
                    className={`btn-tap flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${
                      selected === m.name
                        ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-400/15 to-emerald-500/5'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-slate-400">
                        {m.count} ölçüm · son: {m.latestWeight} kg
                      </div>
                    </div>
                    {selected === m.name && <span className="text-emerald-400">✓</span>}
                  </button>
                ))}
              </div>
            </Card>

            {selectedSummary && (
              <Card className="text-center">
                <div className="text-sm text-slate-400">İçe aktarılacak</div>
                <div className="text-2xl font-bold">{selectedSummary.count} ölçüm</div>
                <div className="text-xs text-slate-500">
                  En son: {selectedSummary.latestDate} · {selectedSummary.latestWeight} kg
                </div>
              </Card>
            )}

            <Button className="w-full" disabled={!selected} onClick={confirm}>
              İçe Aktar
            </Button>
            <Button variant="ghost" className="w-full !py-2 text-sm" onClick={() => setEntries(null)}>
              Farklı dosya seç
            </Button>
          </>
        )}

        {result != null && (
          <Card className="space-y-3 border-emerald-400/20 bg-gradient-to-br from-emerald-400/[0.10] via-white/[0.03] to-transparent text-center">
            <div className="text-3xl">✓</div>
            <div className="font-bold">İçe aktarma tamamlandı</div>
            <div className="text-sm text-slate-400">
              {result} yeni ölçüm eklendi{result === 0 ? ' (hepsi zaten kayıtlıydı)' : ''}. Profildeki güncel kilon
              en son ölçüme göre güncellendi.
            </div>
            <Button className="w-full" onClick={back}>
              Tamam
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
