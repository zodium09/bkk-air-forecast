import type { Metadata } from "next";
import MapWorkspace from "../components/intelligence/map-workspace";

export const metadata: Metadata = {
  title: "BKK Air Forecast — พยากรณ์ความร้อนและ Heat Index 1–7 วัน",
  description:
    "แผนที่พยากรณ์อุณหภูมิสูงสุดและดัชนีความร้อนเจ้าพระยาและกรุงเทพฯ–ปริมณฑล ล่วงหน้า 1–7 วัน",
  openGraph: {
    title: "BKK Air Forecast — พยากรณ์ความร้อนและ Heat Index 1–7 วัน",
    description:
      "แผนที่พยากรณ์อุณหภูมิสูงสุดและดัชนีความร้อนเจ้าพระยาและกรุงเทพฯ–ปริมณฑล ล่วงหน้า 1–7 วัน",
    type: "website",
    images: [
      {
        url: "/home-heat.png",
        width: 1536,
        height: 1024,
        alt: "ภาพพยากรณ์ความร้อนเจ้าพระยาและกรุงเทพฯ–ปริมณฑล",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["/home-heat.png"] },
};

export default function HeatPage() {
  return <MapWorkspace initialLayer="heat" />;
}
