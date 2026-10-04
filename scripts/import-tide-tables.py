"""Extract official hourly MSL tide tables. Requires pdfplumber (maintenance only).

Usage: python -X utf8 scripts/import-tide-tables.py --pdf-dir PATH
Download each manifest URL to CODE.pdf first. No runtime PDF dependency.
The importer refuses partial, reordered, wrong-year or wrong-datum tables.
"""
import argparse
import calendar
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--pdf-dir", type=Path, required=True)
args = parser.parse_args()
stations = json.loads((root / "app/data/tide-stations.json").read_text(encoding="utf-8"))
year = 2026
output = {"year": year, "datum": "msl", "cadenceMinutes": 60,
          "retrievedAt": datetime.now(timezone.utc).isoformat(), "stations": {}}
for station in stations:
    filename = args.pdf_dir / (station["code"] + ".pdf")
    blob = filename.read_bytes()
    hourly = []
    with pdfplumber.open(filename) as pdf:
        assert len(pdf.pages) == 23, "Unexpected PDF layout"
        location = pdf.pages[11].extract_text().splitlines()[2]
        coordinates = re.search(r'\(Lat\)\s*(\d+)\D+?(\d+)\x27\s*(\d+)".*?\(Long\)\s*(\d+)\D+?(\d+)\x27\s*(\d+)"', location)
        assert coordinates, "Missing station coordinates"
        degrees = [int(n) for n in coordinates.groups()]
        lat = degrees[0] + degrees[1] / 60 + degrees[2] / 3600
        lng = degrees[3] + degrees[4] / 60 + degrees[5] / 3600
        assert abs(lat - station["lat"]) < 0.00001 and abs(lng - station["lng"]) < 0.00001, "Wrong station PDF"
        for month in range(1, 13):
            text = pdf.pages[10 + month].extract_text()
            assert f"{calendar.month_name[month]} {year}" in text, "Wrong month/year"
            assert "ABOVE MEAN SEA LEVEL" in text, "Wrong vertical datum"
            assert "DATE 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23" in text
            rows = []
            for line in text.splitlines():
                if re.fullmatch(r"\d{1,2}(?: -?\d+\.\d){24}", line.strip()):
                    cells = line.split()
                    rows.append((int(cells[0]), [round(float(n) * 10) for n in cells[1:]]))
            expected = calendar.monthrange(year, month)[1]
            assert [day for day, _ in rows] == list(range(1, expected + 1)), "Missing/duplicate/reordered day"
            assert all(len(values) == 24 and all(-50 <= n <= 50 for n in values) for _, values in rows)
            hourly.extend(n for _, values in rows for n in values)
    assert len(hourly) == (366 if calendar.isleap(year) else 365) * 24
    output["stations"][station["id"]] = {"sourceUrl": station["sourceUrl"],
        "sha256": hashlib.sha256(blob).hexdigest(), "hourlyDecimetres": hourly}
    print(f'{station["id"]}: {len(hourly)} verified hourly readings')
(root / f"app/data/tide-predictions-{year}.json").write_text(
    json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
