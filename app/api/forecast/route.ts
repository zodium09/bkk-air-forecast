import { forecastDays, forecastStations, issuedAt } from "../../lib/forecast-data";

export async function GET() {
  return Response.json({
    status: "demo",
    issuedAt,
    model: "BKK-AIR-MVP 0.1",
    disclaimer: "ข้อมูลจำลองสำหรับทดสอบส่วนติดต่อผู้ใช้ ไม่ใช่คำพยากรณ์หรือคำเตือนจริง",
    sources: ["AirBKK observation contract", "CAMS forecast contract", "TMD weather contract"],
    days: forecastDays,
    stations: forecastStations,
  });
}
