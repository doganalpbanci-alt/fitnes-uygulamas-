import { useEffect, useState } from 'react';

/** Yeni bir sürüm yayınlandığında kullanıcıyı haberdar eder.
 *
 * Uygulama bir PWA olduğu için service worker eski dosyaları cache'ten sunar; telefonda
 * uygulama günlerce açık kalabildiğinden yeni sürüm fark edilmeden eski arayüzde takılı
 * kalınabiliyordu. Burada iki şey yapıyoruz:
 *   1. Uygulama öne geldiğinde (ve saatlik olarak) service worker güncellemesi kontrol edilir.
 *   2. Yeni bir service worker bulunup etkinleşince kullanıcıya yenileme çağrısı gösterilir.
 *
 * Sayfayı kendiliğinden yenilemiyoruz — kullanıcı bir form doldurmuş olabilir; kararı ona
 * bırakıp tek dokunuşla yenilemesini sağlıyoruz.
 */
export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;

    let reg: ServiceWorkerRegistration | undefined;
    let disposed = false;
    const check = () => {
      reg?.update().catch(() => {
        /* çevrimdışıysa sessizce geç */
      });
    };

    sw.getRegistration().then((r) => {
      if (disposed || !r) return;
      reg = r;

      // Kaydı aldığımızda zaten etkin bir service worker varsa, bundan sonra bulunan her yeni
      // worker gerçek bir güncellemedir. İlk kurulumda `active` henüz null olduğu için
      // "yeni sürüm" uyarısı yanlışlıkla gösterilmez.
      const hadActiveWorker = !!r.active;
      r.addEventListener('updatefound', () => {
        const incoming = r.installing;
        if (!incoming || !hadActiveWorker) return;
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'activated') setUpdateReady(true);
        });
      });

      check();
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(check, 60 * 60 * 1000);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, []);

  return { updateReady, reload: () => location.reload() };
}
