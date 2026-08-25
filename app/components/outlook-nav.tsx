import type { RegionId } from "../lib/provinces";

type OutlookNavProps = {
  active: "air" | "rain";
  province?: RegionId;
};

export default function OutlookNav({ active, province }: OutlookNavProps) {
  const query = province ? `?province=${province}` : "";
  return (
    <nav className="product-nav" aria-label="ประเภทพยากรณ์">
      <a className="product-nav-home" href="/" aria-label="กลับหน้าหลัก" title="หน้าหลัก">
        <span aria-hidden="true">⌂</span>
      </a>
      <a href={`/air${query}`} aria-current={active === "air" ? "page" : undefined}>
        <span aria-hidden="true">◌</span>
        ฝุ่น PM2.5
      </a>
      <a href={`/rain${query}`} aria-current={active === "rain" ? "page" : undefined}>
        <span aria-hidden="true">●</span>
        พยากรณ์ฝน
      </a>
    </nav>
  );
}
