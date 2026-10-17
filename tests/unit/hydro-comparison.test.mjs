import assert from "node:assert/strict";
import test from "node:test";
import { comparisonTimes, comparisonTrack, parseComparisonIds, readingAtCursor } from "../../app/lib/hydro/comparison.ts";

const at = minute => new Date(Date.parse("2026-10-02T00:00:00.000Z") + minute * 60000).toISOString();
const point = (minute, value) => ({ observedAt: at(minute), value });

test("comparison URL accepts only four distinct source station IDs", () => {
  assert.deepEqual(parseComparisonIds("A_1,B-2,A_1,3,4,5,<script>"), ["A_1", "B-2", "3", "4"]);
  assert.deepEqual(parseComparisonIds(null), []);
});

test("shared cursor uses actual observation times and never interpolates", () => {
  const first = [point(0, 10), point(60, 12)];
  const second = [point(30, 4), point(150, 5)];
  assert.deepEqual(comparisonTimes([first, second]), [0, 30, 60, 150].map(minute => Date.parse(at(minute))));
  assert.deepEqual(readingAtCursor(first, Date.parse(at(30))), first[0]);
  assert.equal(readingAtCursor(first, Date.parse(at(121))), null);
  assert.equal(readingAtCursor(second, Date.parse(at(0))), null);
});

test("each station track has its own scale and breaks after a gap over one hour", () => {
  const water = [point(0, 100), point(30, 101), point(120, 102)];
  const track = comparisonTrack(water, Date.parse(at(0)), Date.parse(at(180)));
  assert.equal(track.paths.length, 2);
  assert.equal(track.dots.length, 3);
  assert.match(track.paths[0], / L/);
  assert.match(track.paths[1], /^M/);
  assert.ok(track.min < 100 && track.max > 102);
  const other = comparisonTrack([point(0, 4), point(30, 5)], Date.parse(at(0)), Date.parse(at(180)));
  assert.ok(other.max < track.min);
  assert.equal(comparisonTrack([point(0, 4)], Date.parse(at(0)), Date.parse(at(180))).dots.length, 1);
});
