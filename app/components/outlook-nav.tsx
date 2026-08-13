import Link from "next/link";

type OutlookNavProps = {
  active: "air" | "rain";
};

export default function OutlookNav({ active }: OutlookNavProps) {
  return (
    <nav className="product-nav" aria-label="ประเภทพยากรณ์">
      <Link href="/" aria-current={active === "air" ? "page" : undefined}>
        <span aria-hidden="true">◌</span>
        ฝุ่น PM2.5
      </Link>
      <Link href="/rain" aria-current={active === "rain" ? "page" : undefined}>
        <span aria-hidden="true">●</span>
        พยากรณ์ฝน
      </Link>
    </nav>
  );
}
