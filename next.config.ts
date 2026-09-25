import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

// Permite usar los bindings de Cloudflare (D1, R2) durante `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
