import SurveillanceDashboard from "./surveillance-dashboard";
import { buildSurveillanceSnapshot } from "../lib/surveillance";

export const dynamic = "force-dynamic";

export default function SurveillancePage() {
  return <SurveillanceDashboard snapshot={buildSurveillanceSnapshot()} />;
}
