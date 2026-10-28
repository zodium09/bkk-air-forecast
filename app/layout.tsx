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
  const title = "ฟ้าใส ทั่วไทย (FahSai Thailand) · แผนที่ Interactive ข้อมูลครบ 77 จังหวัด อากาศ ทะเล ท่องเที่ยว ครบวงจร";
  const description =
    "แอปฟ้าใสสำหรับประชาชนทั่วไปแบบเข้าใจง่าย ครอบคลุมพื้นที่ทั้งประเทศไทยครบ 77 จังหวัด ครบทั้งเรื่องฝน ฟ้า อากาศ น้ำทะเลหนุน คลื่นลม ฝุ่น PM2.5 ความร้อน ลมหนาว การท่องเที่ยว พื้นที่เสี่ยง และพื้นที่เหมาะสม";

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
