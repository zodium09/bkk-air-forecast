import { index, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const waterObservations = sqliteTable("water_observations", {
  stationId: text("station_id").notNull(),
  datum: text("datum").notNull(),
  observedAt: text("observed_at").notNull(),
  value: real("value").notNull(),
}, table => [primaryKey({ columns: [table.stationId, table.datum, table.observedAt] }), index("water_observations_time").on(table.observedAt)]);
