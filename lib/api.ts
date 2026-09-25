import { NextResponse } from "next/server";
import { UnauthorizedError } from "./auth";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data as never, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Envuelve un handler para no repetir try/catch en cada ruta. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) return fail("unauthorized", 401);
      console.error(err);
      return fail("server_error", 500);
    }
  };
}

/** Normaliza un campo opcional del formulario: "" -> null. */
export function opt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
