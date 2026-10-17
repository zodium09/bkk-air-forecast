-- Run separately from schema migrations on an existing database after backing it up.
-- Historical ingestion time was never captured, so NULL is intentional.
-- Safe to rerun: existing revision 1 rows are retained.
INSERT OR IGNORE INTO water_observation_revisions
  (station_id, datum, observed_at, value, ingested_at, revision)
SELECT station_id, datum, observed_at, value, NULL, 1 FROM water_observations;
