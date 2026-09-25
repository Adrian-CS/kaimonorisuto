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

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `${PHOTO_PREFIX}/${me.householdId}/${newId()}.${ext}`;

  const env = await getEnv();
  await env.PHOTOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  return json({ key });
});
