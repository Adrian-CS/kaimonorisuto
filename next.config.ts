import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app no usa next/image (las fotos ya se comprimen en el navegador y se
  // sirven desde R2), así que se apaga el optimizador de imágenes: sin él no
  // existe el endpoint /_next/image, que ha tenido fallos graves (SSRF, RCE
  // con SVG). Menos superficie expuesta.
  images: { unoptimized: true },
};

export default nextConfig;

// Permite usar los bindings de Cloudflare (D1, R2) durante `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
