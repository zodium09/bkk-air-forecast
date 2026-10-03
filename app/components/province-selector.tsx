import { CHAO_PHRAYA_REGION_ID, chaoPhrayaRegion, METRO_REGION_ID, metroRegion, regionOptionLabel, provinces, type RegionId } from "../lib/provinces";

type ProvinceSelectorProps = {
  value: RegionId;
  onChange: (province: RegionId) => void;
};

export default function ProvinceSelector({ value, onChange }: ProvinceSelectorProps) {
  return (
    <label className="province-selector">
      <span>พื้นที่</span>
      <select value={value} onChange={(event) => onChange(event.target.value as RegionId)}>
        <option value={CHAO_PHRAYA_REGION_ID}>{chaoPhrayaRegion.nameTh}</option>
        <option value={METRO_REGION_ID}>{metroRegion.nameTh} (ภาพรวม)</option>
        {provinces.map((province) => (
          <option key={province.id} value={province.id}>{regionOptionLabel(province)}</option>
        ))}
      </select>
    </label>
  );
}
