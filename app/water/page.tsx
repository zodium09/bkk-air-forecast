import type { Metadata } from "next";
import WaterDashboard from "../components/intelligence/water-dashboard";

export const metadata: Metadata = {
  title: "BKK Air Forecast — ระดับน้ำเจ้าพระยาและกรุงเทพฯ–ปริมณฑล",
  description: "ติดตามระดับน้ำรายสถานี คลอง แม่น้ำ น้ำบนถนนในกรุงเทพฯ และสถานการณ์ต้นน้ำเจ้าพระยา พร้อมเวลาตรวจวัดและแผนที่จุดแบ่งสี",
};
export default function WaterPage() { return <WaterDashboard/>; }
