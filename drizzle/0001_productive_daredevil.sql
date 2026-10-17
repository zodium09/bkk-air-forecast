CREATE TABLE `hydro_snapshots` (
	`source_id` text PRIMARY KEY NOT NULL,
	`received_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`ended_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `water_observation_revisions` (
	`station_id` text NOT NULL,
	`datum` text NOT NULL,
	`observed_at` text NOT NULL,
	`value` real NOT NULL,
	`ingested_at` text,
	`revision` integer NOT NULL,
	PRIMARY KEY(`station_id`, `datum`, `observed_at`, `revision`)
);
