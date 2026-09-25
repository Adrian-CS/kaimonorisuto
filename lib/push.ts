/**
 * Web Push desde un Worker, sin dependencias.
 *
 * Las librerías habituales (web-push) asumen Node, así que aquí están las dos
 * piezas del protocolo implementadas con WebCrypto:
 *   - VAPID: un JWT ES256 que identifica al servidor ante el push service.
 *   - aes128gcm (RFC 8291/8188): el cuerpo cifrado para el navegador.
 */

export type PushKeys = { publicKey: string; privateKey: string; subject: string };

export type PushSub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/* ---------- base64url ---------- */

export function b64uToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    s.length + ((4 - (s.length % 4)) % 4),
    "=",
  );
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(b: ArrayBuffer | Uint8Array): string {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/* ---------- VAPID ---------- */

async function importVapidPrivateKey(keys: PushKeys) {
  const pub = b64uToBytes(keys.publicKey); // 65 bytes: 0x04 || X(32) || Y(32)
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: keys.privateKey,
    x: bytesToB64u(pub.slice(1, 33)),
    y: bytesToB64u(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function vapidHeader(endpoint: string, keys: PushKeys) {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64u(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64u(
    utf8(
      JSON.stringify({
        aud,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: keys.subject,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;

  const key = await importVapidPrivateKey(keys);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    utf8(signingInput),
  );

  return `vapid t=${signingInput}.${bytesToB64u(sig)}, k=${keys.publicKey}`;
}

/* ---------- cifrado aes128gcm ---------- */

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  bytes: number,
) {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(sub: PushSub, payload: string) {
  const uaPublic = b64uToBytes(sub.p256dh);
  const authSecret = b64uToBytes(sub.auth);

  // Par efímero del servidor.
  const eph = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const asPublic = new Uint8Array(
    await crypto.subtle.exportKey("raw", eph.publicKey),
  );

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256),
  );

  // IKM = HKDF(auth, shared, "WebPush: info\0" || ua_public || as_public)
  const keyInfo = concat(utf8("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
    "encrypt",
  ]);
  // 0x02 marca el final del último registro (delimitador de relleno).
  const plaintext = concat(utf8(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aesKey,
      plaintext as BufferSource,
    ),
  );

  // Cabecera: salt(16) | rs(4) | idlen(1) | as_public(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

/* ---------- envío ---------- */

export type PushResult = { id: string; ok: boolean; gone: boolean; status: number };

export async function sendPush(
  sub: PushSub,
  payload: unknown,
  keys: PushKeys,
  ttlSeconds = 3600,
): Promise<PushResult> {
  try {
    const body = await encryptPayload(sub, JSON.stringify(payload));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidHeader(sub.endpoint, keys),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttlSeconds),
        Urgency: "normal",
      },
      body: body as BodyInit,
    });
    // 404/410 = suscripción muerta: hay que borrarla de la base.
    if (!res.ok) {
      // 403 casi siempre = la suscripción se hizo con otra clave VAPID.
      const detail = await res.text().catch(() => "");
      console.error(
        `push ${res.status} para ${new URL(sub.endpoint).origin}: ${detail.slice(0, 200)}`,
      );
    }
    return {
      id: sub.id,
      ok: res.ok,
      gone: res.status === 404 || res.status === 410,
      status: res.status,
    };
  } catch (err) {
    console.error("push falló antes de salir:", err);
    return { id: sub.id, ok: false, gone: false, status: 0 };
  }
}

/** Lee las claves VAPID del entorno; null si no están configuradas. */
export function readKeys(env: {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}): PushKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || "mailto:nadie@example.com",
  };
}
