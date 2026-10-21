import type { Metadata } from "next";
import FahSaiApp from "../components/fahsai/fahsai-app";

export const metadata: Metadata = {
  title: "ฟ้าใส (FahSai Weather & Sea) — พยากรณ์ฝน ฝุ่น ความร้อน ลมหนาว และน้ำทะเล",
  description:
    "แอปพยากรณ์อากาศ ฝน ฝุ่น PM2.5 ความร้อน ลมหนาว และระดับน้ำทะเล สำหรับกรุงเทพฯ ปริมณฑล และอ่าวไทยตอนบน พร้อมระบบวิเคราะห์แผนที่ดาวเทียม QGIS 5 ระดับความเสี่ยง",
};

export default function FahSaiPage() {
  return <FahSaiApp />;
}
