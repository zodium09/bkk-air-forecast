import type { Metadata } from "next";
import WaterDashboard from "../components/intelligence/water-dashboard";

export const metadata: Metadata = {
  title: "BKK Air Forecast — ระดับน้ำเจ้าพระยาและกรุงเทพฯ–ปริมณฑล",
  description: "วิเคราะห์น้ำขึ้นน้ำลงกับฝน ช่วงที่ควรติดตามน้ำหนุน พร้อมระดับน้ำรายสถานี น้ำบนถนน และสถานการณ์ต้นน้ำเจ้าพระยา แยกน้ำทำนายกับค่าตรวจวัดจริง",
};
export default function WaterPage() { return <WaterDashboard/>; }
