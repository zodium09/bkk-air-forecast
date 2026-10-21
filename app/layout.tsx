import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./components/intelligence/dashboard-redesign.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "สายน้ำเจ้าพระยา (ChaoPhraya Flow) · ฝนและน้ำทั้ง 7 ลุ่มน้ำ";
  const description = "แอปติดตามเส้นทางสายน้ำเจ้าพระยา ปิง วัง ยม น่าน ป่าสัก และสะแกกรัง รูปแบบสีสันสดใส เข้าใจง่าย พร้อมอนิเมชันการไหลของน้ำ เขื่อน และระดับตลิ่ง";

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
    },
    twitter: {
      card: "summary",
      title,
      description,
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
