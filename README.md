# FitTakip 🏋️

Kişisel beslenme, diyet ve spor takibi için basit bir PWA (iPhone'a "Ana Ekrana Ekle" ile kurulur).

**Özellikler (v0.1):**
- ⏱️ Aralıklı oruç takibi: 16:8, 18:6, 20:4, OMAD ve özel formatlar; sayaç, geçmiş, seri.
- 🏋️ Antrenman: görselli hareket kütüphanesi (63 hareket + özel hareket ekleme), antrenman şablonları,
  haftalık program döngüsü, set set kayıt (önceki değerler otomatik gelir).
- 🎯 Progressive overload: aynı hareket, arka arkaya 3 antrenman, aynı ağırlık, her sette hedef
  tekrar aralığı (varsayılan 8–10) → "ağırlığı artırabilirsin" önerisi.
- 📈 Hareket başına ağırlık ve hacim grafikleri.
- 💾 Veriler cihazda (IndexedDB); Ayarlar'dan JSON yedek al / geri yükle.

## Geliştirme

```bash
npm install
npm run dev      # geliştirme sunucusu
npm run build    # üretim derlemesi (dist/)
```

## Telefona kurulum

1. `main` dalına birleştirince GitHub Actions uygulamayı GitHub Pages'e yayınlar
   (bir kereliğine: repo **Settings → Pages → Source: GitHub Actions** seç).
2. iPhone'da Safari ile Pages adresini aç → Paylaş → **Ana Ekrana Ekle**.

Mimari ve yol haritası: [MIMARI-VE-PLAN.md](MIMARI-VE-PLAN.md)

Egzersiz görselleri: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (MIT).
