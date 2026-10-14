import { requireMe } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { PHOTO_PREFIX, getEnv } from "@/lib/db";
import { deletePhotoIfUnused } from "@/lib/photos";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string[] }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");

  // La clave empieza siempre por el id del hogar: nadie ve fotos de otra casa.
  if (!key.startsWith(`${PHOTO_PREFIX}/${me.householdId}/`))
    return fail("not_found", 404);

  const env = await getEnv();
  const obj = await env.PHOTOS.get(key);
  if (!obj) return fail("not_found", 404);

  return new Response(obj.body as ReadableStream, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: obj.httpEtag,
    },
  });
});

/**
 * Borra una foto recién subida que al final no se usó (se cambió por otra o
 * se cerró la ficha sin guardar). Si algún artículo la usa, no hace nada.
 */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const me = await requireMe();
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  await deletePhotoIfUnused(me.householdId, key);
  return json({ ok: true });
});
