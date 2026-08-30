import type { Metadata } from "next";
import HeatDashboard from "./heat-dashboard";

export const metadata: Metadata = {
  title: "BKK Air Forecast — พยากรณ์ความร้อนและ Heat Index 1–7 วัน",
  description: "แผนที่พยากรณ์อุณหภูมิสูงสุดและดัชนีความร้อนกรุงเทพฯ และปริมณฑล ล่วงหน้า 1–7 วัน",
  openGraph: {
    title: "BKK Air Forecast — พยากรณ์ความร้อนและ Heat Index 1–7 วัน",
    description: "แผนที่พยากรณ์อุณหภูมิสูงสุดและดัชนีความร้อนกรุงเทพฯ และปริมณฑล ล่วงหน้า 1–7 วัน",
    type: "website",
    images: [{ url: "/home-heat.png", width: 1536, height: 1024, alt: "ภาพพยากรณ์ความร้อนกรุงเทพฯ และปริมณฑล" }],
  },
  twitter: { card: "summary_large_image", images: ["/home-heat.png"] },
};

export default function HeatPage() {
  return <HeatDashboard />;
}
