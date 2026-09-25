import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/lang";
import { I18nProvider } from "@/components/I18n";
import { makeT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLang());
  return {
    title: t("app.title"),
    description: t("app.subtitle"),
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
