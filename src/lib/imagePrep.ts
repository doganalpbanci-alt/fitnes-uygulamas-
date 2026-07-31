/** Analize göndermeden önce fotoğrafı küçültüp JPEG'e çevirir.
 *
 * Telefon fotoğrafları 3–12 MB olabiliyor ve base64'e çevrilince ~%33 daha büyüyor; bu hem mobil
 * veride yavaş hem de gereksiz token maliyeti demek. Görsel modeller fotoğrafı zaten karolara
 * bölerek işlediği için ~1024 pikselin üstündeki çözünürlük yemek tanımada kayda değer bir isabet
 * kazandırmıyor. Küçültme başarısız olursa (eski tarayıcı vb.) dosya olduğu gibi kullanılır.
 */
export async function prepareFoodPhoto(file: File, maxEdge = 1024, quality = 0.8): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (!dataUrl.startsWith('data:image/jpeg')) throw new Error('encode-failed');
    return dataUrl;
  } catch {
    return readAsDataUrl(file);
  }
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Bir data URL'in yaklaşık byte boyutu (base64 çözülmüş hâli). */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round((base64.length * 3) / 4);
}
