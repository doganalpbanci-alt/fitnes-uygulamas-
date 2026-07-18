let ctx: AudioContext | null = null;

function getCtor(): typeof AudioContext | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/**
 * iOS Safari sesi yalnızca bir kullanıcı jestiyle (tap/click) başlatılan bir
 * AudioContext üzerinden çalar. Bunu, zamanlayıcıyı başlatan onay dokunuşu
 * sırasında senkron çağırıp context'i "kilidini açıyoruz"; bip sesi daha
 * sonra zamanlayıcı bitince aynı context üzerinden çalınabiliyor.
 */
export function unlockAudio() {
  const Ctor = getCtor();
  if (!Ctor) return;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Zamanlayıcı bittiğinde çalınan kısa, çift bip uyarısı. */
export function playBeep() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < 2; i++) {
    const start = now + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
}
