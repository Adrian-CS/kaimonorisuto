import type { D1Database, R2Bucket, Fetcher } from "@cloudflare/workers-types";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      PHOTOS: R2Bucket;
      ASSETS: Fetcher;
      /** Claves VAPID para las notificaciones (secrets; opcionales). */
      VAPID_PUBLIC_KEY?: string;
      VAPID_PRIVATE_KEY?: string;
      VAPID_SUBJECT?: string;
    }
  }

  interface CloudflareEnv extends Cloudflare.Env {}
}

export {};
