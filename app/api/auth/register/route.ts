import { createSession, hashPassword } from "@/lib/auth";
import { fail, handler, json } from "@/lib/api";
import { getDb, newCode, newId, now } from "@/lib/db";

export const POST = handler(async (req: Request) => {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
    householdName?: string;
  };

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const inviteCode = body.inviteCode?.trim().toUpperCase();

  if (!name) return fail("name_required");
  if (!email || !email.includes("@")) return fail("email_invalid");
  if (password.length < 8) return fail("password_short");

  const db = await getDb();
  const t = now();

  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return fail("email_taken");

  let householdId: string;

  if (inviteCode) {
    const h = await db
      .prepare("SELECT id FROM households WHERE invite_code = ?")
      .bind(inviteCode)
      .first<{ id: string }>();
    if (!h) return fail("invalid_code");
    householdId = h.id;
  } else {
    householdId = newId();
    const householdName = body.householdName?.trim() || `Casa de ${name}`;
    await db
      .prepare(
        "INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(householdId, householdName, newCode(), t)
      .run();
  }

  const userId = newId();
  await db
    .prepare(
      "INSERT INTO users (id, household_id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(userId, householdId, name, email, await hashPassword(password), t)
    .run();

  await createSession(userId);
  return json({ ok: true });
});
