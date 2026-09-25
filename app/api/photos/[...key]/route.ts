import { requireMe } from "@/lib/auth";
import { fail, handler } from "@/lib/api";
import { PHOTO_PREFIX, getEnv } from "@/lib/db";

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
