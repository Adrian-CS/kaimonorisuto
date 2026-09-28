/**
 * Redimensiona y comprime una foto en el navegador antes de subirla.
 * Una foto de móvil de 4 MB acaba pesando ~200 KB, así que el plan gratis
 * de R2 da para miles de artículos. 1600 px da para ampliarla en el visor y
 * leer la letra pequeña de la etiqueta.
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.75,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}
