import type { Metadata } from "next";
import { headers } from "next/headers";
import RainDashboard from "./rain-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "BKK Rain Outlook — พยากรณ์ฝนกรุงเทพฯ 1–5 วัน";
  const description = "แผนที่พยากรณ์โอกาสฝนและปริมาณฝนสะสมกรุงเทพฯ ล่วงหน้า 1–5 วัน พร้อมช่วงเวลาที่ควรเฝ้าระวัง";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og-rain.png`, width: 1967, height: 799, alt: "BKK Rain Outlook Bangkok rain forecast" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-rain.png`],
    },
  };
}

export default function RainPage() {
  return <RainDashboard />;
}
