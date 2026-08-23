import type { Metadata } from "next";
import { headers } from "next/headers";
import ForecastDashboard from "../forecast-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "BKK Air Forecast — พยากรณ์ฝุ่นกรุงเทพฯ และปริมณฑล 1–7 วัน";
  const description = "แผนที่พยากรณ์ PM2.5 กรุงเทพฯ และ 5 จังหวัดปริมณฑล ล่วงหน้า 1–7 วัน พร้อมค่าเฉลี่ย สภาพอากาศ และพื้นที่เฝ้าระวัง";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: `${origin}/og-air.png`, width: 1983, height: 793, alt: "BKK Air Forecast live PM2.5 forecast map" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-air.png`],
    },
  };
}

export default function AirPage() {
  return <ForecastDashboard />;
}
