CREATE TABLE `water_observations` (
	`station_id` text NOT NULL,
	`datum` text NOT NULL,
	`observed_at` text NOT NULL,
	`value` real NOT NULL,
	PRIMARY KEY(`station_id`, `datum`, `observed_at`)
);
--> statement-breakpoint
CREATE INDEX `water_observations_time` ON `water_observations` (`observed_at`);