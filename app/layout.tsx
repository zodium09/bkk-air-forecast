import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "BKK Air Forecast — ฝน ฝุ่น และความร้อนเจ้าพระยา–กรุงเทพฯ";
  const description = "ดูฝน ฝุ่น และความร้อน 7 วันในลุ่มน้ำเจ้าพระยาและกรุงเทพฯ–ปริมณฑล พร้อมค่าตรวจวัดน้ำและการติดตามต้นน้ำ 6 ลุ่มน้ำ";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og-home.png`, width: 1733, height: 907, alt: "BKK Air Forecast for Bangkok metropolitan air quality and rain" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-home.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const saved = localStorage.getItem("bkk-air-theme"); document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; } })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
