import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const waterObservations = sqliteTable("water_observations", {
  stationId: text("station_id").notNull(),
  datum: text("datum").notNull(),
  observedAt: text("observed_at").notNull(),
  value: real("value").notNull(),
}, table => [primaryKey({ columns: [table.stationId, table.datum, table.observedAt] }), index("water_observations_time").on(table.observedAt)]);

export const waterObservationRevisions = sqliteTable("water_observation_revisions", {
  stationId: text("station_id").notNull(),
  datum: text("datum").notNull(),
  observedAt: text("observed_at").notNull(),
  value: real("value").notNull(),
  ingestedAt: text("ingested_at"),
  revision: integer("revision").notNull(),
}, table => [primaryKey({ columns: [table.stationId, table.datum, table.observedAt, table.revision] })]);

export const ingestionRuns = sqliteTable("ingestion_runs", {
  runId: text("run_id").primaryKey(),
  endedAt: text("ended_at").notNull(),
  payload: text("payload").notNull(),
});

export const hydroSnapshots = sqliteTable("hydro_snapshots", {
  sourceId: text("source_id").primaryKey(),
  receivedAt: text("received_at").notNull(),
  payload: text("payload").notNull(),
});
