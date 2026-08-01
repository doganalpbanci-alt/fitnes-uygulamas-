import type { FoodItem, Serving } from '../db';

/** Uygulamayla birlikte gelen Türkçe besin veritabanı.
 *
 * Open Food Facts marka/paket ürünlerinde iyi ama "fıstık", "mercimek çorbası" gibi genel
 * Türkçe besinlerde neredeyse hiç sonuç vermiyor (üstelik internet gerektiriyor). Bu liste
 * çevrimdışı, anında ve Türkçe arandığı gibi çalışsın diye uygulamanın içinde tutuluyor.
 *
 * Değerler 100 gram (içecekler için 100 ml) içindir; USDA FoodData Central ve TürKomp
 * (Türkiye Ulusal Gıda Kompozisyon Veri Tabanı) referans alınmıştır. Ev yemekleri doğası
 * gereği tarife göre değişir — bu değerler tipik bir tarifin ortalamasıdır.
 */

/** Kompakt tanım: [ad, kcal, protein, karbonhidrat, yağ, birimler, eş anlamlılar]
 * birimler: "adet:50|dilim:30" · eş anlamlılar: "fistik,yerfistigi" */
type Row = [string, number, number, number, number, string?, string?];

function parseServings(spec?: string): Serving[] | undefined {
  if (!spec) return undefined;
  const out = spec.split('|').map((part) => {
    const [label, grams] = part.split(':');
    return { label: label.trim(), grams: Number(grams) };
  });
  return out.length ? out : undefined;
}

/** Türkçe adı, id olarak kullanılabilecek sade bir anahtara çevirir. */
function slug(name: string): string {
  return name
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export interface BuiltinFood extends FoodItem {
  category: string;
  /** Arama sırasında ada ek olarak taranan kelimeler (halk arasındaki adlar, yazım varyantları). */
  aliases?: string[];
}

const CATEGORIES: [string, Row[]][] = [
  [
    'Yumurta ve Süt Ürünleri',
    [
      ['Yumurta (haşlanmış)', 155, 13, 1.1, 10.6, 'adet:50', 'haslanmis yumurta,katı yumurta'],
      ['Yumurta (sahanda)', 196, 13.6, 0.8, 15.3, 'adet:60', 'sahanda,kızarmış yumurta'],
      ['Omlet', 173, 11, 1.2, 13.4, 'porsiyon:120', 'omlet'],
      ['Yumurta beyazı', 52, 11, 0.7, 0.2, 'adet:33', 'ak,beyaz'],
      ['Yumurta sarısı', 322, 16, 3.6, 27, 'adet:17', 'sarısı'],
      ['Beyaz peynir (tam yağlı)', 264, 17.6, 1.5, 21, 'dilim:30|kibrit kutusu:30', 'peynir,beyazpeynir'],
      ['Beyaz peynir (light)', 180, 20, 2, 10, 'dilim:30', 'light peynir,diyet peynir'],
      ['Kaşar peyniri', 375, 25, 2.5, 29, 'dilim:25', 'kasar,kaşar'],
      ['Tulum peyniri', 375, 24, 2, 30, 'dilim:25', 'tulum'],
      ['Lor peyniri', 98, 12, 3, 4, 'yemek kaşığı:20', 'lor,çökelek'],
      ['Labne', 250, 6, 4, 24, 'yemek kaşığı:15', 'labne,krem peynir'],
      ['Süt (tam yağlı)', 61, 3.2, 4.8, 3.3, 'bardak:200', 'sut,inek sütü'],
      ['Süt (yarım yağlı)', 50, 3.3, 4.8, 1.7, 'bardak:200', 'sut,light süt'],
      ['Ayran', 37, 1.7, 2.9, 2, 'bardak:200', 'ayran'],
      ['Yoğurt (tam yağlı)', 61, 3.5, 4.7, 3.3, 'kase:200|yemek kaşığı:20', 'yogurt'],
      ['Yoğurt (light)', 56, 5.3, 7.7, 0.2, 'kase:200', 'yogurt,diyet yoğurt'],
      ['Süzme yoğurt', 96, 9, 4, 4.5, 'kase:200', 'suzme,yunan yoğurdu'],
      ['Kefir', 41, 3.3, 4.5, 1, 'bardak:200', 'kefir'],
      ['Kaymak', 330, 3, 2, 35, 'yemek kaşığı:15', 'kaymak'],
      ['Tereyağı', 717, 0.9, 0.1, 81, 'yemek kaşığı:14|çay kaşığı:5', 'tereyag,tere yağı'],
    ],
  ],
  [
    'Et, Tavuk ve Balık',
    [
      ['Tavuk göğsü (ızgara)', 165, 31, 0, 3.6, 'porsiyon:150', 'tavuk,gogus,piliç'],
      ['Tavuk but (derisiz)', 209, 26, 0, 11, 'porsiyon:150', 'but,baget'],
      ['Tavuk kanat', 203, 30.5, 0, 8.1, 'adet:35', 'kanat'],
      ['Hindi göğsü', 135, 29, 0, 1.7, 'porsiyon:150', 'hindi'],
      ['Dana kıyma (yağlı)', 254, 17, 0, 20, 'porsiyon:150', 'kiyma,kıyma'],
      ['Dana kıyma (yağsız)', 176, 20, 0, 10, 'porsiyon:150', 'kiyma,az yağlı kıyma'],
      ['Dana bonfile', 143, 22, 0, 6, 'porsiyon:150', 'bonfile,biftek'],
      ['Dana antrikot', 271, 25, 0, 19, 'porsiyon:180', 'antrikot,et'],
      ['Kuzu pirzola', 294, 25, 0, 21, 'adet:70', 'pirzola,kuzu'],
      ['Sucuk', 449, 23, 2, 38, 'dilim:10', 'sucuk'],
      ['Salam', 310, 15, 3, 26, 'dilim:15', 'salam'],
      ['Sosis', 290, 12, 3, 25, 'adet:50', 'sosis'],
      ['Pastırma', 240, 35, 1, 11, 'dilim:8', 'pastirma'],
      ['Somon', 208, 20, 0, 13, 'porsiyon:150', 'somon,salmon'],
      ['Hamsi', 131, 20, 0, 5, 'porsiyon:150', 'hamsi'],
      ['Levrek', 97, 18, 0, 2.5, 'porsiyon:200', 'levrek'],
      ['Çipura', 115, 20, 0, 4, 'porsiyon:200', 'cipura'],
      ['Uskumru', 205, 19, 0, 14, 'porsiyon:150', 'uskumru'],
      ['Ton balığı (suda)', 116, 26, 0, 1, 'konserve:80', 'ton,tuna'],
      ['Karides', 99, 24, 0.2, 0.3, 'porsiyon:120', 'karides'],
    ],
  ],
  [
    'Ekmek ve Tahıl',
    [
      ['Beyaz ekmek', 265, 9, 49, 3.2, 'dilim:30', 'ekmek,francala'],
      ['Tam buğday ekmeği', 247, 13, 41, 3.4, 'dilim:30', 'ekmek,kepekli ekmek,tam bugday'],
      ['Çavdar ekmeği', 259, 9, 48, 3.3, 'dilim:30', 'cavdar,ekmek'],
      ['Simit', 320, 9, 57, 5.5, 'adet:100', 'simit,gevrek'],
      ['Lavaş', 275, 8, 54, 2, 'adet:60', 'lavas,dürüm ekmeği'],
      ['Yufka', 300, 9, 62, 1.5, 'yaprak:80', 'yufka'],
      ['Pirinç pilavı', 145, 2.8, 28, 2.5, 'porsiyon:150|yemek kaşığı:25', 'pilav,pirinc'],
      ['Bulgur pilavı', 130, 3.5, 24, 2.5, 'porsiyon:150|yemek kaşığı:25', 'bulgur,pilav'],
      ['Makarna (haşlanmış)', 158, 5.8, 31, 0.9, 'porsiyon:200', 'makarna,spagetti,erişte'],
      ['Kuskus (haşlanmış)', 112, 3.8, 23, 0.2, 'porsiyon:150', 'kuskus'],
      ['Yulaf ezmesi (kuru)', 379, 13, 67, 6.5, 'su bardağı:80|yemek kaşığı:10', 'yulaf,ovmiyl,oatmeal'],
      ['Mısır gevreği', 357, 7, 84, 1, 'kase:40', 'misir gevregi,cornflakes,gevrek'],
      ['Granola', 471, 10, 64, 20, 'kase:50|yemek kaşığı:12', 'granola,müsli'],
      ['Kinoa (haşlanmış)', 120, 4.4, 21, 1.9, 'porsiyon:150', 'kinoa,quinoa'],
      ['Pirinç (çiğ)', 360, 7, 79, 0.6, 'su bardağı:180', 'pirinc,cig pirinç'],
      ['Bulgur (çiğ)', 342, 12, 76, 1.3, 'su bardağı:170', 'bulgur'],
      ['Buğday unu', 364, 10, 76, 1, 'yemek kaşığı:8|su bardağı:120', 'un,bugday unu'],
      ['Galeta unu', 380, 12, 72, 3, 'yemek kaşığı:10', 'galeta'],
    ],
  ],
  [
    'Bakliyat',
    [
      ['Nohut (haşlanmış)', 164, 8.9, 27, 2.6, 'kase:150|yemek kaşığı:20', 'nohut'],
      ['Kuru fasulye (haşlanmış)', 127, 8.7, 23, 0.5, 'kase:150', 'fasulye,kuru fasulye'],
      ['Yeşil mercimek (haşlanmış)', 116, 9, 20, 0.4, 'kase:150', 'mercimek'],
      ['Kırmızı mercimek (çiğ)', 358, 24, 60, 1.5, 'su bardağı:190', 'mercimek,kirmizi mercimek'],
      ['Barbunya (haşlanmış)', 127, 9, 22, 0.5, 'kase:150', 'barbunya'],
      ['Nohut (çiğ)', 364, 19, 61, 6, 'su bardağı:190', 'nohut'],
      ['Bezelye', 81, 5.4, 14, 0.4, 'kase:150', 'bezelye'],
      ['Soya fasulyesi', 173, 16.6, 9.9, 9, 'kase:150', 'soya'],
    ],
  ],
  [
    'Sebze',
    [
      ['Domates', 18, 0.9, 3.9, 0.2, 'adet:120', 'domates'],
      ['Salatalık', 15, 0.7, 3.6, 0.1, 'adet:100', 'salatalik,hıyar'],
      ['Marul', 15, 1.4, 2.9, 0.2, 'yaprak:10', 'marul,kıvırcık'],
      ['Roka', 25, 2.6, 3.7, 0.7, 'demet:50', 'roka'],
      ['Maydanoz', 36, 3, 6, 0.8, 'demet:50', 'maydanoz'],
      ['Soğan', 40, 1.1, 9.3, 0.1, 'adet:110', 'sogan'],
      ['Sarımsak', 149, 6.4, 33, 0.5, 'diş:3', 'sarimsak'],
      ['Patates (haşlanmış)', 87, 1.9, 20, 0.1, 'adet:150', 'patates'],
      ['Patates kızartması', 312, 3.4, 41, 15, 'porsiyon:150', 'patates kizartmasi,cips,fries'],
      ['Havuç', 41, 0.9, 9.6, 0.2, 'adet:70', 'havuc'],
      ['Brokoli', 34, 2.8, 6.6, 0.4, 'porsiyon:150', 'brokoli'],
      ['Karnabahar', 25, 1.9, 5, 0.3, 'porsiyon:150', 'karnabahar'],
      ['Ispanak', 23, 2.9, 3.6, 0.4, 'porsiyon:150', 'ispanak'],
      ['Kabak', 17, 1.2, 3.1, 0.3, 'adet:200', 'kabak'],
      ['Patlıcan', 25, 1, 6, 0.2, 'adet:200', 'patlican'],
      ['Yeşil biber', 20, 0.9, 4.6, 0.2, 'adet:50', 'biber,sivri biber'],
      ['Kırmızı biber', 31, 1, 6, 0.3, 'adet:120', 'biber,kapya'],
      ['Mısır (haşlanmış)', 96, 3.4, 21, 1.5, 'adet:150', 'misir,koçan'],
      ['Mantar', 22, 3.1, 3.3, 0.3, 'porsiyon:100', 'mantar,kültür mantarı'],
      ['Avokado', 160, 2, 8.5, 15, 'adet:170', 'avokado'],
      ['Siyah zeytin', 115, 0.8, 6, 11, 'adet:4', 'zeytin,siyah zeytin'],
      ['Yeşil zeytin', 145, 1, 3.8, 15, 'adet:4', 'zeytin,yesil zeytin'],
      ['Turşu', 20, 0.8, 3.5, 0.2, 'porsiyon:60', 'tursu'],
    ],
  ],
  [
    'Meyve',
    [
      ['Elma', 52, 0.3, 14, 0.2, 'adet:180', 'elma'],
      ['Muz', 89, 1.1, 23, 0.3, 'adet:120', 'muz'],
      ['Portakal', 47, 0.9, 12, 0.1, 'adet:180', 'portakal'],
      ['Mandalina', 53, 0.8, 13, 0.3, 'adet:90', 'mandalina'],
      ['Üzüm', 69, 0.7, 18, 0.2, 'salkım:150', 'uzum'],
      ['Çilek', 32, 0.7, 7.7, 0.3, 'kase:150|adet:12', 'cilek'],
      ['Karpuz', 30, 0.6, 7.6, 0.2, 'dilim:200', 'karpuz'],
      ['Kavun', 34, 0.8, 8.2, 0.2, 'dilim:150', 'kavun'],
      ['Şeftali', 39, 0.9, 10, 0.3, 'adet:150', 'seftali'],
      ['Kayısı', 48, 1.4, 11, 0.4, 'adet:35', 'kayisi'],
      ['Armut', 57, 0.4, 15, 0.1, 'adet:170', 'armut'],
      ['Kivi', 61, 1.1, 15, 0.5, 'adet:75', 'kivi'],
      ['Ananas', 50, 0.5, 13, 0.1, 'dilim:80', 'ananas'],
      ['Nar', 83, 1.7, 19, 1.2, 'adet:250', 'nar'],
      ['İncir', 74, 0.8, 19, 0.3, 'adet:50', 'incir'],
      ['Kuru kayısı', 241, 3.4, 63, 0.5, 'adet:8', 'kuru kayisi'],
      ['Kuru üzüm', 299, 3.1, 79, 0.5, 'yemek kaşığı:10', 'kuru uzum,kişmiş'],
      ['Kuru incir', 249, 3.3, 64, 0.9, 'adet:20', 'kuru incir'],
      ['Hurma', 282, 2.5, 75, 0.4, 'adet:8', 'hurma'],
    ],
  ],
  [
    'Kuruyemiş ve Tohum',
    [
      ['Yer fıstığı', 567, 26, 16, 49, 'avuç:30|adet:1', 'fistik,yerfistigi,amerikan fistigi,peanut'],
      ['Antep fıstığı', 560, 20, 28, 45, 'avuç:30', 'fistik,sam fistigi,antepfistigi,pistachio'],
      ['Ceviz', 654, 15, 14, 65, 'avuç:30|adet:10', 'ceviz,walnut'],
      ['Badem', 579, 21, 22, 50, 'avuç:30|adet:1.2', 'badem,almond'],
      ['Fındık', 628, 15, 17, 61, 'avuç:30|adet:1', 'findik,hazelnut'],
      ['Kaju', 553, 18, 30, 44, 'avuç:30', 'kaju,cashew'],
      ['Ay çekirdeği', 584, 21, 20, 51, 'avuç:30', 'ay cekirdegi,çekirdek'],
      ['Kabak çekirdeği', 559, 30, 11, 49, 'avuç:30', 'kabak cekirdegi,çekirdek'],
      ['Leblebi', 364, 21, 59, 6, 'avuç:30', 'leblebi'],
      ['Fıstık ezmesi', 588, 25, 20, 50, 'yemek kaşığı:16', 'fistik ezmesi,peanut butter,fıstık'],
      ['Tahin', 595, 17, 21, 54, 'yemek kaşığı:15', 'tahin'],
      ['Chia tohumu', 486, 17, 42, 31, 'yemek kaşığı:12', 'chia,çia'],
      ['Keten tohumu', 534, 18, 29, 42, 'yemek kaşığı:10', 'keten tohumu'],
      ['Susam', 573, 18, 23, 50, 'yemek kaşığı:9', 'susam'],
      ['Hindistan cevizi (kuru)', 660, 6.9, 24, 64, 'yemek kaşığı:8', 'hindistan cevizi,coconut'],
    ],
  ],
  [
    'Yağ, Sos ve Katkı',
    [
      ['Zeytinyağı', 884, 0, 0, 100, 'yemek kaşığı:13|çay kaşığı:5', 'zeytinyagi,yağ,olive oil'],
      ['Ayçiçek yağı', 884, 0, 0, 100, 'yemek kaşığı:13|çay kaşığı:5', 'aycicek yagi,sıvı yağ,yağ'],
      ['Margarin', 717, 0.2, 0.7, 80, 'yemek kaşığı:14', 'margarin'],
      ['Mayonez', 680, 1, 2.7, 75, 'yemek kaşığı:14', 'mayonez'],
      ['Ketçap', 112, 1.3, 26, 0.2, 'yemek kaşığı:17', 'kecap,ketchup'],
      ['Hardal', 66, 4, 5, 3.5, 'yemek kaşığı:15', 'hardal'],
      ['Domates salçası', 82, 4.3, 19, 0.5, 'yemek kaşığı:16', 'salca,salça'],
      ['Bal', 304, 0.3, 82, 0, 'yemek kaşığı:21|çay kaşığı:7', 'bal,honey'],
      ['Reçel', 278, 0.4, 69, 0.1, 'yemek kaşığı:20', 'recel'],
      ['Pekmez', 293, 0.5, 73, 0, 'yemek kaşığı:20', 'pekmez'],
      ['Kakaolu fındık kreması', 539, 6, 57, 31, 'yemek kaşığı:18', 'nutella,cikolata kremasi,çikolata sürülebilir'],
      ['Toz şeker', 387, 0, 100, 0, 'çay kaşığı:4|küp:3', 'seker,şeker'],
    ],
  ],
  [
    'Çorbalar',
    [
      ['Mercimek çorbası', 65, 3, 10, 1.5, 'kase:250', 'mercimek corbasi,çorba'],
      ['Ezogelin çorbası', 70, 3.2, 11, 1.6, 'kase:250', 'ezogelin,çorba'],
      ['Tarhana çorbası', 68, 2.6, 11, 1.7, 'kase:250', 'tarhana,çorba'],
      ['Yayla çorbası', 72, 2.8, 9, 2.8, 'kase:250', 'yayla,çorba'],
      ['Domates çorbası', 62, 1.8, 9, 2, 'kase:250', 'domates corbasi,çorba'],
      ['Tavuk suyu çorba', 45, 2.5, 5, 1.5, 'kase:250', 'tavuk corbasi,şehriye çorbası,çorba'],
      ['İşkembe çorbası', 90, 7, 5, 4.5, 'kase:250', 'iskembe,çorba'],
    ],
  ],
  [
    'Türk Yemekleri',
    [
      ['Kuru fasulye (yemek)', 120, 6.5, 17, 2.8, 'porsiyon:250', 'kuru fasulye,fasulye'],
      ['Nohut yemeği', 130, 6, 18, 3.5, 'porsiyon:250', 'nohut yemegi'],
      ['Etli türlü', 95, 5, 9, 4, 'porsiyon:250', 'turlu,sebze yemeği'],
      ['Karnıyarık', 130, 4.5, 9, 8.5, 'adet:200', 'karniyarik'],
      ['İmam bayıldı', 120, 1.8, 9, 8.5, 'adet:200', 'imambayildi'],
      ['Musakka', 125, 6, 8, 7.5, 'porsiyon:250', 'musakka'],
      ['Menemen', 110, 5, 5, 7.5, 'porsiyon:250', 'menemen'],
      ['Zeytinyağlı yaprak sarma', 180, 3, 22, 9, 'adet:25', 'sarma,yaprak sarma,dolma'],
      ['Etli biber dolma', 130, 4.5, 14, 6, 'adet:150', 'dolma,biber dolması'],
      ['İçli köfte', 240, 8, 28, 11, 'adet:90', 'icli kofte'],
      ['Çiğ köfte', 180, 5, 32, 3.5, 'adet:25', 'cig kofte'],
      ['Lahmacun', 250, 11, 33, 8, 'adet:130', 'lahmacun'],
      ['Kıymalı pide', 250, 11, 30, 9, 'porsiyon:250', 'pide,kiymali pide'],
      ['Adana kebap', 235, 18, 2, 17, 'porsiyon:180', 'adana,kebap'],
      ['Urfa kebap', 225, 18, 2, 16, 'porsiyon:180', 'urfa,kebap'],
      ['İskender kebap', 210, 12, 16, 11, 'porsiyon:300', 'iskender,kebap'],
      ['Tavuk şiş', 175, 25, 2, 7, 'porsiyon:180', 'tavuk sis,şiş'],
      ['Izgara köfte', 240, 18, 5, 17, 'adet:30', 'kofte,köfte'],
      ['Et döner', 280, 20, 3, 21, 'porsiyon:150', 'doner,dürüm'],
      ['Tavuk döner', 190, 22, 3, 10, 'porsiyon:150', 'tavuk doner,dürüm'],
      ['Mantı', 200, 8, 28, 6, 'porsiyon:250', 'manti'],
      ['Su böreği', 245, 8, 28, 11, 'dilim:120', 'su boregi,börek'],
      ['Kıymalı börek', 280, 9, 30, 14, 'dilim:120', 'borek,börek'],
      ['Sigara böreği', 300, 8, 28, 17, 'adet:35', 'sigara boregi,börek'],
      ['Poğaça', 340, 7, 40, 17, 'adet:70', 'pogaca'],
      ['Açma', 330, 8, 48, 12, 'adet:80', 'acma'],
      ['Gözleme', 250, 8, 33, 9, 'adet:200', 'gozleme'],
      ['Kaşarlı tost', 300, 13, 28, 15, 'adet:150', 'tost,sandviç'],
      ['Hamburger', 260, 13, 22, 13, 'adet:200', 'hamburger,burger'],
      ['Pizza', 266, 11, 33, 10, 'dilim:100', 'pizza'],
      ['Humus', 166, 7.9, 14, 9.6, 'yemek kaşığı:15|porsiyon:100', 'humus'],
      ['Cacık', 45, 1.8, 3, 2.8, 'kase:200', 'cacik'],
      ['Haydari', 150, 5, 4, 13, 'yemek kaşığı:20', 'haydari,meze'],
      ['Piyaz', 110, 4.5, 13, 4.5, 'porsiyon:150', 'piyaz'],
      ['Çoban salata', 35, 1, 5, 1.5, 'porsiyon:200', 'salata,coban salata'],
    ],
  ],
  [
    'Tatlı',
    [
      ['Baklava', 430, 6, 50, 23, 'dilim:60', 'baklava'],
      ['Künefe', 350, 8, 40, 18, 'porsiyon:150', 'kunefe'],
      ['Sütlaç', 130, 3.5, 22, 3, 'kase:150', 'sutlac'],
      ['Kazandibi', 155, 4, 25, 4, 'porsiyon:125', 'kazandibi'],
      ['Revani', 330, 4, 55, 10, 'dilim:80', 'revani'],
      ['Şekerpare', 350, 4, 58, 12, 'adet:45', 'sekerpare'],
      ['Tulumba tatlısı', 390, 3, 52, 19, 'adet:30', 'tulumba'],
      ['Lokum', 350, 0.2, 85, 0.2, 'adet:15', 'lokum'],
      ['Tahin helvası', 516, 12, 50, 31, 'dilim:30', 'helva,tahin helvasi'],
      ['İrmik helvası', 380, 5, 55, 16, 'porsiyon:100', 'helva,irmik helvasi'],
      ['Dondurma', 207, 3.5, 24, 11, 'top:60', 'dondurma'],
      ['Sütlü çikolata', 535, 7.6, 59, 30, 'kare:5|tablet:80', 'cikolata,çikolata'],
      ['Bitter çikolata', 546, 7.8, 46, 31, 'kare:5|tablet:80', 'cikolata,bitter'],
      ['Kek', 380, 5, 50, 17, 'dilim:60', 'kek,pasta'],
      ['Kurabiye', 480, 6, 60, 24, 'adet:15', 'kurabiye'],
      ['Bisküvi', 450, 7, 70, 16, 'adet:8|paket:80', 'biskuvi'],
    ],
  ],
  [
    'İçecek',
    [
      ['Çay (şekersiz)', 1, 0, 0.2, 0, 'bardak:200', 'cay,çay'],
      ['Türk kahvesi (sade)', 2, 0.1, 0.3, 0, 'fincan:70', 'kahve,turk kahvesi'],
      ['Filtre kahve', 2, 0.1, 0.3, 0, 'fincan:200', 'kahve,americano'],
      ['Sütlü latte', 55, 3, 5, 2.5, 'bardak:250', 'latte,kahve,cappuccino'],
      ['Kola', 42, 0, 10.6, 0, 'kutu:330|bardak:250', 'kola,cola,gazoz'],
      ['Kola (şekersiz)', 0.3, 0, 0, 0, 'kutu:330', 'kola zero,diyet kola'],
      ['Portakal suyu', 45, 0.7, 10, 0.2, 'bardak:200', 'meyve suyu,portakal suyu'],
      ['Limonata', 45, 0.1, 11, 0, 'bardak:250', 'limonata'],
      ['Şalgam suyu', 20, 0.7, 4, 0.1, 'bardak:200', 'salgam'],
      ['Maden suyu', 0, 0, 0, 0, 'şişe:200', 'maden suyu,soda'],
      ['Bira', 43, 0.5, 3.6, 0, 'şişe:330', 'bira'],
      ['Kırmızı şarap', 85, 0.1, 2.6, 0, 'kadeh:150', 'sarap,şarap'],
      ['Rakı', 245, 0, 0, 0, 'kadeh:50', 'raki'],
      ['Enerji içeceği', 45, 0, 11, 0, 'kutu:250', 'enerji icecegi,red bull'],
    ],
  ],
  [
    'Takviye',
    [
      ['Whey protein tozu', 380, 78, 8, 5, 'ölçek:30', 'protein tozu,whey,protein'],
      ['Kazein protein tozu', 360, 75, 8, 3, 'ölçek:30', 'kazein,protein tozu'],
      ['Protein bar', 350, 30, 40, 10, 'adet:60', 'protein bar'],
      ['Kreatin monohidrat', 0, 0, 0, 0, 'ölçek:5', 'kreatin,creatine'],
    ],
  ],
];

function build(): BuiltinFood[] {
  const out: BuiltinFood[] = [];
  for (const [category, rows] of CATEGORIES) {
    for (const [name, cal, p, c, f, servingSpec, aliasSpec] of rows) {
      out.push({
        id: `tr_${slug(name)}`,
        name,
        category,
        caloriesPer100g: cal,
        proteinPer100g: p,
        carbsPer100g: c,
        fatPer100g: f,
        source: 'builtin',
        servings: parseServings(servingSpec),
        aliases: aliasSpec?.split(',').map((a) => a.trim()).filter(Boolean),
      });
    }
  }
  return out;
}

export const BUILTIN_FOODS: BuiltinFood[] = build();

/** Fuzzy aramanın tarayacağı metin: ad + eş anlamlılar tek bir dizede. */
export function builtinSearchText(f: BuiltinFood): string {
  return f.aliases?.length ? `${f.name} ${f.aliases.join(' ')}` : f.name;
}
