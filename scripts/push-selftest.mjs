/**
 * Comprueba de verdad el cifrado de Web Push: monta una suscripción falsa,
 * deja que lib/push.ts la cifre, y la descifra desde el otro lado con la clave
 * privada del "navegador". También verifica la firma del JWT de VAPID.
 *
 *   node scripts/push-selftest.mjs
 */
import { webcrypto as crypto } from "node:crypto";
import http from "node:http";
import { build } from "esbuild";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const b64u = (b) => Buffer.from(b).toString("base64url");
const fromB64u = (s) => new Uint8Array(Buffer.from(s, "base64url"));
const utf8 = (s) => new TextEncoder().encode(s);
const cat = (...xs) => {
  const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of xs) (out.set(x, at), (at += x.length));
  return out;
};

// --- compilar lib/push.ts a un módulo que Node pueda importar ---
const dir = mkdtempSync(join(tmpdir(), "push-"));
const out = join(dir, "push.mjs");
await build({
  entryPoints: ["lib/push.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: out,
  logLevel: "silent",
});
const { sendPush } = await import(`file://${out}`);

// --- claves VAPID ---
const vapidPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const vapidPublic = b64u(await crypto.subtle.exportKey("raw", vapidPair.publicKey));
const vapidJwk = await crypto.subtle.exportKey("jwk", vapidPair.privateKey);
const keys = {
  publicKey: vapidPublic,
  privateKey: vapidJwk.d,
  subject: "mailto:test@example.com",
};

// --- "navegador": par ECDH + secreto auth ---
const uaPair = await crypto.subtle.generateKey(
  { name: "ECDH", namedCurve: "P-256" },
  true,
  ["deriveBits"],
);
const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", uaPair.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));

// --- servidor que hace de push service ---
let captured = null;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    captured = { headers: req.headers, body: Buffer.concat(chunks) };
    res.writeHead(201).end();
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const sub = {
  id: "test",
  endpoint: `http://127.0.0.1:${port}/push/abc`,
  p256dh: b64u(uaPublic),
  auth: b64u(authSecret),
};

const payload = { title: "🥕 Lista de la compra", body: "Adrian ha añadido 人参" };
const result = await sendPush(sub, payload, keys);
server.close();

const fail = (msg) => {
  console.error("✗ " + msg);
  process.exitCode = 1;
};
const ok = (msg) => console.log("✓ " + msg);

if (!result.ok) fail(`el push service devolvió ${result.status}`);
else ok(`entregado (HTTP ${result.status})`);

if (!captured) {
  fail("no llegó ninguna petición");
  process.exit(1);
}

// --- cabeceras ---
if (captured.headers["content-encoding"] !== "aes128gcm")
  fail(`Content-Encoding = ${captured.headers["content-encoding"]}`);
else ok("Content-Encoding: aes128gcm");

// --- VAPID ---
const authz = captured.headers.authorization ?? "";
const m = /^vapid t=([^,]+), k=(.+)$/.exec(authz);
if (!m) fail(`Authorization mal formada: ${authz}`);
else {
  const [, jwt, k] = m;
  if (k !== vapidPublic) fail("la clave pública del header no es la nuestra");
  const [h, p, sig] = jwt.split(".");
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    vapidPair.publicKey,
    fromB64u(sig),
    utf8(`${h}.${p}`),
  );
  if (!valid) fail("la firma del JWT no valida");
  else ok("JWT de VAPID firmado correctamente");

  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  if (claims.aud !== `http://127.0.0.1:${port}`) fail(`aud = ${claims.aud}`);
  else ok(`aud correcto (${claims.aud})`);
  if (claims.exp <= Math.floor(Date.now() / 1000)) fail("el JWT ya está caducado");
  else ok("exp en el futuro");
}

// --- descifrado desde el lado del navegador ---
const body = new Uint8Array(captured.body);
const salt = body.slice(0, 16);
const idlen = body[20];
const asPublic = body.slice(21, 21 + idlen);
const ciphertext = body.slice(21 + idlen);

const asKey = await crypto.subtle.importKey(
  "raw",
  asPublic,
  { name: "ECDH", namedCurve: "P-256" },
  false,
  [],
);
const shared = new Uint8Array(
  await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, uaPair.privateKey, 256),
);

async function hkdf(saltBytes, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: saltBytes, info },
      key,
      len * 8,
    ),
  );
}

const ikm = await hkdf(
  authSecret,
  shared,
  cat(utf8("WebPush: info\0"), uaPublic, asPublic),
  32,
);
const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

try {
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, ciphertext),
  );
  if (plain[plain.length - 1] !== 2) fail("falta el delimitador 0x02 del último registro");
  const text = new TextDecoder().decode(plain.slice(0, -1));
  const got = JSON.parse(text);
  if (got.body !== payload.body) fail(`el contenido no coincide: ${text}`);
  else ok(`descifrado correcto: "${got.body}"`);
} catch (e) {
  fail("no se pudo descifrar: " + e.message);
}

if (!process.exitCode) console.log("\nWeb Push OK.");
