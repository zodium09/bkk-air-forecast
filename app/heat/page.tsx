import type { Metadata } from "next";
import HeatDashboard from "./heat-dashboard";

export const metadata: Metadata = {
  title: "BKK Air Forecast — พยากรณ์ความร้อนและ Heat Index 1–7 วัน",
  description: "แผนที่พยากรณ์อุณหภูมิสูงสุดและดัชนีความร้อนกรุงเทพฯ และปริมณฑล ล่วงหน้า 1–7 วัน",
};

export default function HeatPage() {
  return <HeatDashboard />;
}
