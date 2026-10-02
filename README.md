# BKK Air Forecast

BKK Air Forecast is a Bangkok-metropolitan web application for viewing seven-day PM2.5 and rain outlooks across Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Samut Sakhon, and Nakhon Pathom. It is designed for planning and data exploration; it is not an official warning or health-advisory system.

## Features

- Top-of-page important-event briefing with source-classified road/water/PM2.5 observations, nearby TMD rain analysis and current-interval heat forecasts; scope-aware in-page alerts suppress unchanged refreshes. Contracts: [docs/IMPORTANT_EVENTS_TH.md](docs/IMPORTANT_EVENTS_TH.md).
- Large mobile map with colored forecast dots (direct provider rain values; IDW for air/heat), immediate touch panning, an unobstructed canvas and optional full-map mode
- Continuous place list below the map: named Bangkok districts and surrounding sample areas, ordered by forecast signal with plain-language readings and next steps
- One-tap day/hour selection for provider-supplied rain and heat forecasts; opening without an explicit time defaults to the current Bangkok date/hour and follows the clock until the user chooses a time. Changing layers preserves a deliberately selected time, while default views remain current. Daily-only sources use the nearest available period; PM2.5 stays explicitly daily
- Named-area watch lists for PM2.5, rain and heat forecast signals, with actual period, source status and direct map selection
- On-demand search, settings, trends and location details, shown beside the desktop map or as separate mobile views

- Chart-first overview at `/` with current readings, seven-day trends, concise summaries and animated graphics; dedicated `/air`, `/rain` and `/heat` briefings lead into geographic exploration

- Seven-day PM2.5 outlook with Bangkok station observations, province model grids, and spatial IDW surfaces
- Rain outlook split into a chance mode (TMD-assisted 0–48 hours or Open-Meteo 7 days) and a 24-hour accumulation mode (TMD Daily or Open-Meteo 7 days)
- Seven-day heat outlook with 3-hour windows and a user-selectable TMD/Open-Meteo source mode
- Province selector shared across air and rain views, defaulting to the six-province metropolitan overview
- Optional TMD RadarGIS observed and 0–3 hour nowcast layers
- Optional authenticated TMD NWP rain and heat mode (`TMD_NWP_TOKEN`) for the first 48 hours, with an explicit Open-Meteo/GFS seven-day mode and transparent fallback status
- Explicit `live`, `degraded`, and `unavailable` data states
- Upstream timeout handling, quality-control summaries, and safe no-data behavior
- Responsive Leaflet maps with bounded surface caches

## Architecture

The application uses React 19 and vinext with file-based routes under `app/`. Server routes adapt upstream sources into stable JSON contracts. Pure PM2.5 logic lives under `app/lib/forecast/` so timestamps, quality control, interpolation, CAMS aggregation, bias correction, and reliability scoring can be tested without network access.

The primary workspace renders Leaflet base maps with colored forecast dots and a continuous readable place list. A public geographic snapshot supplies 487 khwaeng/tambon references across the six provinces: 453 positions on named OpenStreetMap roads, matched spatially to official BMA/DMR subdistrict polygons, and 34 interior locality references where no suitable named road was found. Labels include road, khwaeng/tambon, khet/amphoe and province. At overview scales the map shows one reference per khet/amphoe (79); zoom level 10 reveals all references, while the list remains complete. Selecting a list row zooms to street level. Search matches every part of the address.

Air/heat dots, selected-location reading, list and combined area watch share the same bounded IDW values, with at least three anchors within 50 km. Distances/weights are reused across forecast hours while missing neighbors are reconsidered for each reading. Missing values remain distinct from zero, and no colored area overlay or weather motion appears in the primary workspace. Street names identify the position, not street-level forecast accuracy or district-wide measurements.

Selecting an individual surrounding province shows its tambon references immediately, without extra zoom steps. Bangkok and the metropolitan overview retain the district overview at wide scales. The selected road name appears as a small geographic label beside its dot, including in full-map mode.

`/api/map-places` serves the static catalog without runtime geocoding or sending user locations upstream. Road positions are © OpenStreetMap contributors, licensed under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/); administrative labels come from [BMA GIS](https://bmagis.bangkok.go.th/arcgis/rest/services/Hosted/FGDS_BMA_SUBDISTRICT_POLYGON/FeatureServer/0) and [DMR GIS](https://gisportal.dmr.go.th/arcgis/rest/services/Data_Production/WAB_VIEW/MapServer/10). Exact source URLs, the OSM timestamp and attribution accompany the distributable catalog in `app/data/map-places.json`. Run `npm run update:map-places -- --refresh` to refresh public geometry and regenerate it; omit `--refresh` to reuse the ignored `output/geography/` cache. Updates fail before replacing the catalog if upstream data is incomplete.

The primary rain map uses `/api/rain-places` to request Open-Meteo Best Match directly at all 487 named reference coordinates. Dot colors, list amounts, selected readings and rain watch use the same source values without application IDW. Accumulation is the default metric, with one-hour, three-hour and full-day (24-hour) selection; probability is supplemental. Hourly precipitation timestamps mark the end of the preceding hour: the 06:00–07:00 interval reads the source's 07:00 value. Eight upstream calendar days supply the closing midnight of the seven displayed days. Three-hour totals require all three hourly amounts; daily totals sum the same point's 24 hourly amounts over 00:00–24:00 Bangkok time and require complete coverage. The separate provider daily aggregate is not substituted, so changing cadence always preserves the displayed interval boundaries. Probability for multi-hour/day periods is explicitly the maximum single-hour probability, not a calculated probability of rain throughout that period. Missing values remain null, including entirely missing locations. Arbitrary map coordinates receive no interpolated rain value; users select an actual source-backed reference instead.

The response retains the provider's actual grid center separately from the requested place coordinate. Multiple places may use the same model cell; road names locate references and do not imply road-level measurements. Fixed batches of up to 50 coordinates, four concurrent requests, in-flight deduplication and two-hour memory/optional Cloudflare caches share snapshots across province filters. Failed or incomplete snapshots are cached for ten minutes without a retry burst. The endpoint's edge cache expires at Bangkok midnight to avoid carrying yesterday's date horizon into the next day. No runtime reverse geocoding or personal geolocation is sent to this endpoint. Weather data attribution: [Open-Meteo](https://open-meteo.com/) / [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); field semantics: [official API documentation](https://open-meteo.com/en/docs).

Specialist pages under `/advanced` retain their raster surfaces and radar tools. Generated PM2.5 surfaces are cached by day, station-data version, and boundary version. Rain surfaces use a 24-entry LRU-style cache keyed by day, 3-hour window, metric, data version, and boundary version. Daily rain-chance summaries use each point's maximum probability during the day and then average those point values across the selected area. Three-hour summaries similarly average each point's peak probability within that window.

The default metropolitan views call one consolidated forecast endpoint and one consolidated boundary endpoint instead of six province endpoints. Successful public-data responses are stored in Cloudflare Cache API with normalized cache keys: PM2.5 for 10 minutes, direct rain places for up to two hours (capped at midnight), specialist rain for 30 minutes, radar for 5 minutes, and boundaries for 7 days. Client-generated refresh values are excluded from cache keys, and Air4Thai downloads are deduplicated within each metropolitan refresh. Forecast delivery requires no persistent database. The water observation archive uses local daily journals in Next.js or the `DB` D1 binding in Cloudflare Workers.

## Current observations and water history

The overview and `/rain` include TMD radar playback, source analysis within 8 km, nearby hourly model trends and optional in-app rain notices while the page is open. Generated Bangkok artwork links to the three topics through interactive controls. Location results are not cached or persisted. See [the radar data and interaction contract](docs/RAIN_RADAR_NEARBY_TH.md).

`/api/air-observations` reads AirBKK and Air4Thai independently of the PM forecast model. Fresh readings are at most 90 minutes old. The overview summarizes one compatible agency/averaging-period group; a selected place shows an actual nearby station within 30 km. The source payload does not declare the averaging period, so the UI makes that limitation explicit and does not infer an hourly health category.

`/api/road-floods` reads BMA road and tunnel sensors, retains the published classification and centimetre depth, and excludes broken or older-than-30-minute sensors from current summaries. Coverage is Bangkok only. Road measurements, waterway levels and forecasts remain separate.

Visible pages refresh every five minutes and at Bangkok midnight; hidden pages pause fetching and catch up when shown. Existing readings remain visible during refresh with their original timestamps, and freshness is reassessed against the clock.

For local durable collection, run `npm run collect:observations -- --watch` alongside the app. This saves actual ThaiWater observations every five minutes to ignored `.data/water-history/` journals. History survives app restarts, keeps up to 90 days, deduplicates station/datum/timestamp, and never invents earlier samples. The UI exposes 24/72-hour charts, exact values and changes only when recent samples support them.

The Cloudflare entry point includes a five-minute scheduled collector, the `DB` D1 binding and migration `drizzle/0000_last_proemial_gods.sql`. Cloud collection requires deployment with the binding and scheduled trigger; configuring source files alone does not start a cloud collector. Current water readings still work if archive storage is unavailable.

## Data Sources

- **AirBKK:** current PM2.5 observations from Bangkok monitoring stations; it is observation data, not a forecast model.
- **Air4Thai (Pollution Control Department):** official PM2.5 observations used to supplement and deduplicate AirBKK stations, bias-correct metropolitan province grids, and replace AirBKK observations during an outage.
- **CAMS Global via Open-Meteo Air Quality:** model forecast used as the PM2.5 background field.
- **Open-Meteo Weather Forecast:** wind and precipitation context for PM2.5.
- **Open-Meteo Best Match and GFS:** rain model providers, queried in that order.
- **BMA GIS:** official Bangkok district boundary when available.
- **Department of Mineral Resources GIS:** official province boundaries for the five metropolitan provinces.
- **TMD RadarGIS:** observed radar and short-range nowcast image layers.
- **TMD NWP:** selectable authenticated 3 km hourly rainfall, temperature, and relative-humidity values for the first 48 hours when `TMD_NWP_TOKEN` is configured. The rain accumulation mode separately uses TMD Daily `rain` totals for all seven days. Open-Meteo supplies precipitation probability and supporting fields, and can be selected as a separate seven-day source on the rain and heat pages.
- **OpenStreetMap:** basemap tiles.

## PM2.5 Forecast Method

The default metropolitan PM2.5 forecast no longer aggregates six independently interpolated province products. It requests one 7×7 CAMS Global domain covering roughly 100–200 km around Greater Bangkok, validates AirBKK and regional Air4Thai observations, calculates station-minus-CAMS residuals, and applies an anisotropic upwind weighting that changes with forecast wind speed and direction. The corrected 54 metropolitan target points are then rendered as one continuous, boundary-clipped display surface. Individual province views retain the simpler local fallback pipeline.

The PM2.5 surface is an interpolation, not a direct measurement at every pixel or proof of a pollution source. `forecastReliabilityScore` is a heuristic based on lead time, source availability, CAMS coverage, and observation age. It is not a probability of forecast accuracy and has not been historically calibrated. The full scientific and operational manual is in `docs/WIND_AWARE_REGIONAL_PM25_MANUAL_TH.md`.

## Rain Forecast Method

Specialist rain views under `/rain/advanced` use nine boundary-aware model samples distributed inside each selected province; the metropolitan view combines all 54 points into one continuous surface and clips it to the six official boundaries. Chance mode uses TMD NWP rainfall signals only for the first 48 hours when selected, while probability percentages come from Open-Meteo; the Open-Meteo source mode exposes all seven days. Its daily probability summary uses the provider's maximum probability over time at each point, followed by a spatial mean; the highest sampled point is retained separately. Accumulation mode uses TMD Daily `rain` totals or Open-Meteo daily totals for all seven days. Regional watch tiers combine the spatial mean with the highest accumulation corroborated by at least two model points within 30 km, while an isolated maximum is shown separately. The display surface uses regularized IDW with a 3.5 km smoothing distance, the nearest 12 points within 55 km, and transparent unsupported pixels. Model sample points are visible by default so the interpolated surface does not imply district-level precision. The optional TMD RadarGIS layer is displayed separately and keeps observed frames available when the nowcast feed is temporarily incomplete.

## Data Quality / Fallback Behavior

- `live`: required inputs meet coverage/freshness criteria and supporting weather is available.
- `degraded`: a usable forecast exists, but a secondary source, hourly coverage, or freshness criterion is incomplete. `degradedReasons` explains why.
- `unavailable`: a trustworthy forecast cannot be produced. The API returns current date placeholders and no PM2.5 stations/rain points; the UI disables the heatmap and offers retry.

Every upstream request has a bounded timeout. PM2.5 `dataQuality.upstream` reports `ok`, `timeout`, or `error` for AirBKK, Air4Thai, CAMS, and weather. AirBKK remains the primary Bangkok observation source; Air4Thai supplements non-duplicate stations, replaces AirBKK during an outage, and supplies a median bias correction for province CAMS grids when fresh local stations are available. Bundled dated demo values are not used in the production failure path. A simplified province boundary may be shown when an official GIS service is unavailable, and the UI labels this boundary fallback explicitly.

## Local Development

Requirements: Node.js `>=22.13.0` and npm.

```bash
npm ci
npm run dev
```

To enable TMD NWP locally, copy `.env.example` to `.env.local` and set `TMD_NWP_TOKEN` to the OAuth access token. The token is read only by the server route and is sent in the `Authorization: Bearer` header; it is never added to a browser response or URL.

The development server uses vinext. No database, login, or external credentials are required for the read-only forecast pages, but live upstream requests require internet access.

## Testing

```bash
npm run lint
npm run test:unit
npm test
npm run build
```

Unit tests inject mock `fetch` implementations and do not call external providers. They cover timestamp parsing, station QC, IDW, CAMS coverage/extrapolation, reliability scoring, PM2.5 failures/timeouts, and rain provider/coverage failures, direct-location matching, preceding-hour accumulation, midnight rollover, exact missing/zero handling and request deduplication. `npm test` also builds and runs rendered-page regression tests.

## Deployment

Build the production bundle with `npm run build` and deploy the generated vinext application using the hosting environment configured for the repository. Configure `TMD_NWP_TOKEN` as an encrypted server-side deployment secret when TMD NWP is enabled. CDN caching is enabled on successful forecast responses with stale-while-revalidate windows; unavailable responses use `no-store`. The included CI workflow validates install, lint, tests, and build but does not deploy.

## Limitations

- PM2.5 bias correction and reliability scoring have not been validated against a historical backtest.
- IDW smooths between nearby observation/model points and can miss street-level variation; transparent gaps mean fewer than three anchors were available within the configured distance.
- CAMS and global weather models have coarser resolution than Bangkok districts.
- Rain is model output from buffered grid points, not radar and not an official district forecast.
- Upstream outages, delayed observations, and boundary fallback reduce data quality.

## Disclaimer

Forecasts are estimates for general planning only. They are not an official health advisory, emergency alert, weather warning, or substitute for announcements from Bangkok Metropolitan Administration, the Pollution Control Department, the Thai Meteorological Department, or public-health authorities. Follow official guidance when conditions may affect health or safety.
