import type { Metadata } from "next";
import FahSaiApp from "../components/fahsai/fahsai-app";

export const metadata: Metadata = {
  title: "ฟ้าใส ทั่วไทย (FahSai Thailand) · แผนที่ Interactive ข้อมูลครบ 77 จังหวัด อากาศ ทะเล ท่องเที่ยว และพื้นที่เสี่ยงทั่วไทย",
  description:
    "แอปฟ้าใสสำหรับประชาชนทั่วไปแบบเข้าใจง่าย ครอบคลุมพื้นที่ทั้งประเทศไทยครบ 77 จังหวัด ครบทั้งเรื่องฝน ฟ้า อากาศ น้ำทะเลหนุน คลื่นลม ฝุ่น PM2.5 ความร้อน ลมหนาว การท่องเที่ยว พื้นที่เสี่ยง และพื้นที่เหมาะสม",
};

export default function FahSaiPage() {
  return <FahSaiApp />;
}
