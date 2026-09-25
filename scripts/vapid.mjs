/**
 * Genera el par de claves VAPID para las notificaciones.
 *
 *   node scripts/vapid.mjs
 *
 * Luego, una vez cada una:
 *   npx wrangler secret put VAPID_PUBLIC_KEY
 *   npx wrangler secret put VAPID_PRIVATE_KEY
 *   npx wrangler secret put VAPID_SUBJECT      # mailto:tu@email
 *
 * Y las mismas tres líneas en .dev.vars para probarlo en local.
 */
import { webcrypto as crypto } from "node:crypto";

const b64u = (buf) =>
  Buffer.from(buf).toString("base64url");

const pair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const publicKey = b64u(await crypto.subtle.exportKey("raw", pair.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("");
console.log("Guárdalas con `npx wrangler secret put <NOMBRE>` y en .dev.vars.");
