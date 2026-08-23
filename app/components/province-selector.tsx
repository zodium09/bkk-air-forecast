import { provinces, type ProvinceId } from "../lib/provinces";

type ProvinceSelectorProps = {
  value: ProvinceId;
  onChange: (province: ProvinceId) => void;
};

export default function ProvinceSelector({ value, onChange }: ProvinceSelectorProps) {
  return (
    <label className="province-selector">
      <span>จังหวัด</span>
      <select value={value} onChange={(event) => onChange(event.target.value as ProvinceId)}>
        {provinces.map((province) => (
          <option key={province.id} value={province.id}>{province.nameTh}</option>
        ))}
      </select>
    </label>
  );
}
