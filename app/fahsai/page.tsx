import type { Metadata } from "next";
import FahSaiApp from "../components/fahsai/fahsai-app";

export const metadata: Metadata = {
  title: "ฟ้าใส (FahSai Weather & Sea) · พยากรณ์อากาศ ฝน ฝุ่น ความร้อน ลมหนาว และน้ำทะเล",
  description:
    "แอปพยากรณ์อากาศ ฝน ฝุ่น PM2.5 ความร้อน ลมหนาว และน้ำทะเลอ่าวไทยตอนบน สำหรับกรุงเทพฯ ปริมณฑล สมุทรปราการ สมุทรสาคร สมุทรสงคราม และชลบุรี พร้อมแผนที่ดาวเทียมพิกัดจริง WGS84 สัญลักษณ์ความเสี่ยง 5 ระดับ และเรดาร์ทิศทางฝนลม",
};

export default function FahSaiPage() {
  return <FahSaiApp />;
}
