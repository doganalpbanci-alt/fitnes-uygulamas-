# FitTakip — Mimari ve İlk Taslak Plan

Kişisel kullanım için beslenme, diyet ve spor verilerini tutan; aralıklı oruç takibi ve
antrenman (direnç + kardiyo) takibi yapan, iOS telefondan kullanılabilir basit bir uygulama.

---

## 1. Platform Kararı: PWA (Progresif Web Uygulaması)

**Öneri: React tabanlı bir PWA.** Nedenleri:

- iOS'ta Safari'den "Ana Ekrana Ekle" ile normal bir uygulama gibi (tam ekran, ikonlu) çalışır.
- App Store, geliştirici hesabı (99$/yıl), Mac/Xcode gerektirmez. Kişisel kullanım için en hızlı ve ücretsiz yol.
- Çevrimdışı çalışabilir (Service Worker) — spor salonunda internet olmasa da antrenman girilebilir.
- Tek kod tabanı; ileride istenirse Capacitor ile gerçek iOS uygulamasına sarılabilir.

**Bilinen kısıtlar (kabul edilebilir):**
- iOS'ta arka planda gerçek push bildirimi kısıtlıdır. Oruç zamanlayıcısı için bitiş *zamanını* kaydedip
  uygulama açıldığında kalan süreyi hesaplayacağız (timer arka planda "çalışmak" zorunda değil).
- Veriler cihazda tutulur; yedekleme için dışa/içe aktarma (JSON) özelliği ekleyeceğiz.

### Teknoloji Yığını

| Katman | Seçim | Neden |
|---|---|---|
| UI | React + TypeScript + Vite | Hızlı geliştirme, geniş ekosistem |
| Stil | Tailwind CSS | Mobil öncelikli, hızlı arayüz |
| Veri (yerel) | IndexedDB (Dexie.js) | Çevrimdışı, sorgulanabilir, kalıcı |
| Durum yönetimi | Zustand (hafif) | Basit uygulama için yeterli |
| PWA | vite-plugin-pwa | Service worker + manifest otomasyonu |
| Barındırma | GitHub Pages veya Vercel (ücretsiz) | Tek kişilik kullanım için ideal |

**Sunucu yok, hesap yok, giriş yok.** Tüm veri cihazda (IndexedDB). Bu, uygulamayı basit tutar;
ileride çoklu cihaz senkronu istenirse Supabase gibi ücretsiz bir arka uç eklenebilir (Faz 4).

---

## 2. Modüller

### Modül A — Aralıklı Oruç Takibi
- Hazır formatlar: **16:8, 18:6, 20:4, OMAD (23:1)** + özel format tanımlama.
- "Orucu Başlat" → başlangıç zamanı kaydedilir; dairesel bir sayaç kalan süreyi ve
  ilerleme yüzdesini gösterir ("Yeme penceresine 3s 24d kaldı").
- Oruç geçmişi: tamamlanan/yarıda kesilen oruçlar, seri (streak) sayacı, haftalık özet.
- Sayaç, bitiş zamanı damgasıyla çalışır — uygulama kapansa da doğru kalır.

### Modül B — Antrenman Takibi (çekirdek modül)

**B1. Egzersiz Kütüphanesi**
- Bilinen fitness/vücut geliştirme hareketleri, kas grubuna göre kategorili
  (göğüs, sırt, bacak, omuz, kol, karın, kardiyo).
- Her hareketin **basit çizim/piktogram görseli** olacak. Kaynak: açık lisanslı
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (800+ hareket, görselli, MIT lisans)
  içinden seçilmiş bir alt küme; Türkçe isimler bizim tarafımızdan eklenecek.
- Kullanıcı kendi özel hareketini de ekleyebilir.
- Hareket tipi: `direnç` (set × tekrar × ağırlık) veya `kardiyo/süreli` (süre, opsiyonel mesafe).

**B2. Antrenman Şablonu Oluşturma**
- "Antrenman Oluştur" ekranı: isim ver (örn. *İtiş Günü*), kütüphaneden hareket seç
  (görselleriyle), her hareket için hedef set sayısı, tekrar aralığı (örn. 8–10) ve
  başlangıç ağırlığı ya da süre gir.

**B3. Haftalık Program (Döngü)**
- Şablonlar haftanın günlerine atanır: *Pzt → İtiş, Çar → Çekiş, Cum → Bacak, Sal/Per → Kardiyo*.
- Ana ekran "bugünün antrenmanını" gösterir; döngü her hafta otomatik tekrar eder.
- Takvim görünümünde tamamlanan günler işaretlenir.

**B4. Antrenman Kaydı (Oturum)**
- Antrenman günü "Başlat" → şablon set set önüne gelir; her set için **yapılan tekrar ve ağırlık**
  (kardiyoda süre/mesafe) girilir. Önceki oturumdaki değerler varsayılan olarak gelir → hızlı giriş.
- Setler arası dinlenme sayacı (opsiyonel, basit).

**B5. Progressive Overload Motoru**
- Her direnç hareketi için son oturumlar analiz edilir. Kural:

  > Aynı hareket, **arka arkaya 3 antrenmanda**, **aynı ağırlıkla**, **her sette 8–10 tekrar**
  > aralığına ulaşıldıysa → 🎯 **"Ağırlığı artırabilirsin"** uyarısı.

- Uyarı hem hareket geçmişi ekranında rozet olarak, hem de bir sonraki antrenman
  başlarken o hareketin yanında gösterilir.
- Tekrar aralığı hareket bazında özelleştirilebilir (varsayılan 8–10).
- İlerleme grafikleri: hareket başına ağırlık ve toplam hacim (set × tekrar × kg) zaman grafiği.

### Modül C — Beslenme / Diyet (sonraki faz, basit tutulacak)
- Günlük kalori + protein hedefi ve hızlı giriş (detaylı yemek veritabanı YOK, basitlik esas).
- Kilo takibi ve grafiği.
- Oruç modülüyle entegre: yeme penceresinde giriş hatırlatması.

---

## 3. Veri Modeli (IndexedDB / Dexie)

```ts
// Egzersiz kütüphanesi
Exercise {
  id: string
  name: string            // Türkçe ad (örn. "Bench Press / Göğüs Pres")
  muscleGroup: 'göğüs'|'sırt'|'bacak'|'omuz'|'kol'|'karın'|'kardiyo'
  type: 'resistance' | 'cardio'
  imageUrl: string        // basit çizim (uygulama içine gömülü)
  isCustom: boolean
}

// Antrenman şablonu
WorkoutTemplate {
  id: string
  name: string            // "İtiş Günü"
  exercises: [{
    exerciseId: string
    targetSets: number
    repRangeMin: number   // 8
    repRangeMax: number   // 10
    startWeightKg?: number
    targetDurationMin?: number   // kardiyo için
  }]
}

// Haftalık plan
WeeklySchedule {
  dayOfWeek: 0..6
  templateId: string | null
}

// Tamamlanan antrenman oturumu
WorkoutSession {
  id: string
  templateId: string
  date: string
  entries: [{
    exerciseId: string
    sets: [{ reps?: number, weightKg?: number, durationMin?: number }]
  }]
}

// Oruç kaydı
Fast {
  id: string
  protocol: '16:8' | '18:6' | '20:4' | 'custom'
  targetHours: number
  startedAt: string
  endedAt?: string        // null = devam ediyor
  completed: boolean
}

// Beslenme (Faz 3)
BodyWeight { date, weightKg }
NutritionDay { date, calories, proteinG, note }
```

**Progressive overload kontrolü (sözde kod):**

```
sonUcOturum = hareketX içeren son 3 WorkoutSession
eğer 3 oturum da varsa VE
   hepsinde ağırlık aynıysa VE
   her oturumda TÜM setler repRangeMin–repRangeMax aralığındaysa
→ "ağırlığı artır" önerisi göster (öneri: +2.5 kg)
```

---

## 4. Ekranlar

1. **Ana Ekran** — bugünün antrenmanı, aktif oruç sayacı, hızlı başlat düğmeleri.
2. **Oruç** — protokol seçimi, dairesel sayaç, geçmiş ve seri.
3. **Antrenman** — haftalık program görünümü, "bugünü başlat".
4. **Antrenman Oturumu** — set set kayıt, önceki değerler, overload rozetleri.
5. **Şablon Oluştur/Düzenle** — görselli hareket seçici (kas grubuna göre filtre + arama).
6. **İlerleme** — hareket başına ağırlık/hacim grafikleri, overload önerileri listesi.
7. **Ayarlar** — veri dışa/içe aktar (JSON yedek), birim (kg), özel oruç formatı.

Alt gezinme çubuğu: 🏠 Ana | ⏱ Oruç | 🏋️ Antrenman | 📈 İlerleme | ⚙️ Ayarlar

---

## 5. Yol Haritası

| Faz | Kapsam | Çıktı |
|---|---|---|
| **Faz 0** | Proje iskeleti: Vite + React + TS + Tailwind + PWA + Dexie kurulumu, alt gezinme | iPhone'a eklenebilir boş kabuk |
| **Faz 1** | Oruç modülü (formatlar, sayaç, geçmiş) | Kullanılabilir ilk sürüm |
| **Faz 2** | Antrenman çekirdeği: kütüphane (görselli), şablon oluşturma, haftalık program, oturum kaydı | Asıl ana özellik |
| **Faz 2.5** | Progressive overload motoru + ilerleme grafikleri | Akıllı öneriler |
| **Faz 3** | Basit beslenme: kalori/protein hedefi, kilo takibi | Beslenme ayağı |
| **Faz 4 (ops.)** | JSON yedekleme iyileştirme, çoklu cihaz senkronu (Supabase), bildirimler | Konfor özellikleri |

Her faz sonunda uygulama telefonda gerçekten kullanılabilir durumda olacak; Faz 1'den
itibaren günlük kullanıma başlayıp geri bildirimle ilerleyebiliriz.

---

## 6. Açık Sorular

1. Ağırlık artış önerisi sabit **+2.5 kg** mı olsun, hareket tipine göre mi değişsin
   (örn. büyük hareketlerde +5 kg)?
2. Egzersiz görselleri: hazır açık kaynak çizimler (İngilizce isimli, biz Türkçeleştiririz) yeterli mi?
3. Beslenme modülünde yalnızca kalori/protein mi, yoksa karbonhidrat/yağ da takip edilsin mi?
