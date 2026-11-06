import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { PHOTO_PREFIX, getEnv, newId } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024; // el cliente ya comprime; esto es el tope duro
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export const POST = handler(async (req: Request) => {
  const me = await requireMe();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("photo_missing");
  if (!ALLOWED.has(file.type)) return fail("photo_type");
  if (file.size > MAX_BYTES) return fail("photo_large");

  // El tipo lo declara el navegador; se comprueba también por los primeros
  // bytes, para no guardar (y luego servir) algo que no es una imagen.
  const bytes = await file.arrayBuffer();
  const type = sniffImage(new Uint8Array(bytes.slice(0, 12)));
  if (!type || !ALLOWED.has(type)) return fail("photo_type");

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const key = `${PHOTO_PREFIX}/${me.householdId}/${newId()}.${ext}`;

  const env = await getEnv();
  await env.PHOTOS.put(key, bytes, {
    httpMetadata: { contentType: type },
  });

  return json({ key });
});

/** Tipo real de la imagen según su firma (JPEG, PNG o WebP), o null. */
function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
