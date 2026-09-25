import { createSession, verifyPassword } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { getDb } from "@/lib/db";

export const POST = handler(async (req: Request) => {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) return fail("missing_fields");

  const db = await getDb();
  const user = await db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash)))
    return fail("bad_credentials", 401);

  await createSession(user.id);
  return json({ ok: true });
});
