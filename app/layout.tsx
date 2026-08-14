import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "BKK Air Forecast — พยากรณ์ฝุ่นและฝนกรุงเทพฯ";
  const description = "ศูนย์รวมพยากรณ์ฝุ่น PM2.5 และฝนกรุงเทพฯ ล่วงหน้า 1–5 วัน เพื่อช่วยวางแผนก่อนออกจากบ้าน";

  return {
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
      images: [{ url: `${origin}/og-home.png`, width: 1733, height: 907, alt: "BKK Air Forecast for Bangkok air quality and rain" }],
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
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
