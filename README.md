# BKK Air Forecast

BKK Air Forecast is a Bangkok-metropolitan web application for viewing seven-day PM2.5 and rain outlooks across Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Samut Sakhon, and Nakhon Pathom. It is designed for planning and data exploration; it is not an official warning or health-advisory system.

## Features

- Seven-day PM2.5 outlook with Bangkok station observations, province model grids, and spatial IDW surfaces
- Seven-day rain outlook with 3-hour windows, probability and rain-amount views, plus a user-selectable TMD/Open-Meteo source mode
- Province selector shared across air and rain views, defaulting to the six-province metropolitan overview
- Optional TMD RadarGIS observed and 0–3 hour nowcast layers
- Optional authenticated TMD NWP rainfall mode (`TMD_NWP_TOKEN`) with an explicit Open-Meteo/GFS mode and transparent fallback status
- Explicit `live`, `degraded`, and `unavailable` data states
- Upstream timeout handling, quality-control summaries, and safe no-data behavior
- Responsive Leaflet maps with bounded surface caches

## Architecture

The application uses React 19 and vinext with file-based routes under `app/`. Server routes adapt upstream sources into stable JSON contracts. Pure PM2.5 logic lives under `app/lib/forecast/` so timestamps, quality control, interpolation, CAMS aggregation, bias correction, and reliability scoring can be tested without network access.

The browser renders Leaflet base maps and generates clipped raster IDW surfaces. Generated PM2.5 surfaces are cached by day, station-data version, and boundary version. Rain surfaces use a 24-entry LRU-style cache keyed by day, 3-hour window, metric, data version, and boundary version.

The default metropolitan views call one consolidated forecast endpoint and one consolidated boundary endpoint instead of six province endpoints. Successful public-data responses are stored in Cloudflare Cache API with normalized cache keys: PM2.5 for 10 minutes, rain for 30 minutes, radar for 5 minutes, and boundaries for 7 days. Client-generated refresh values are excluded from cache keys, and Air4Thai downloads are deduplicated within each metropolitan refresh. This design requires no D1, KV, R2, or paid add-on.

## Data Sources

- **AirBKK:** current PM2.5 observations from Bangkok monitoring stations; it is observation data, not a forecast model.
- **Air4Thai (Pollution Control Department):** official PM2.5 observations used to supplement and deduplicate AirBKK stations, bias-correct metropolitan province grids, and replace AirBKK observations during an outage.
- **CAMS Global via Open-Meteo Air Quality:** model forecast used as the PM2.5 background field.
- **Open-Meteo Weather Forecast:** wind and precipitation context for PM2.5.
- **Open-Meteo Best Match and GFS:** rain model providers, queried in that order.
- **BMA GIS:** official Bangkok district boundary when available.
- **Department of Mineral Resources GIS:** official province boundaries for the five metropolitan provinces.
- **TMD RadarGIS:** observed radar and short-range nowcast image layers.
- **TMD NWP:** selectable authenticated 3 km hourly rainfall values for the first 48 hours when `TMD_NWP_TOKEN` is configured. Open-Meteo supplies probability fields, fills missing periods, and extends the outlook to seven days. Users can switch to a separate Open-Meteo-only seven-day mode from the rain page.
- **OpenStreetMap:** basemap tiles.

## PM2.5 Forecast Method

The default metropolitan PM2.5 forecast no longer aggregates six independently interpolated province products. It requests one 7×7 CAMS Global domain covering roughly 100–200 km around Greater Bangkok, validates AirBKK and regional Air4Thai observations, calculates station-minus-CAMS residuals, and applies an anisotropic upwind weighting that changes with forecast wind speed and direction. The corrected 54 metropolitan target points are then rendered as one continuous, boundary-clipped display surface. Individual province views retain the simpler local fallback pipeline.

The PM2.5 surface is an interpolation, not a direct measurement at every pixel or proof of a pollution source. `forecastReliabilityScore` is a heuristic based on lead time, source availability, CAMS coverage, and observation age. It is not a probability of forecast accuracy and has not been historically calibrated. The full scientific and operational manual is in `docs/WIND_AWARE_REGIONAL_PM25_MANUAL_TH.md`.

## Rain Forecast Method

Rain values come from nine boundary-aware model samples distributed inside each selected province; the metropolitan view combines all 54 points into one continuous surface and clips it to the six official boundaries. When configured, three concurrent server-side TMD NWP point requests per province supply 3 km hourly rainfall amounts for the first 48 hours and are mapped to the nearest display samples; Open-Meteo supplies precipitation probability, fills missing TMD periods, and extends the outlook to seven days. Hourly values are aggregated into eight 3-hour windows per day. Point probabilities remain local to their samples, while province and metropolitan summaries use the spatial mean for each 3-hour window and report the day's highest area-mean window. This prevents one isolated 100% value from being described as 100% for the whole province or metropolitan region. The display surface uses regularized IDW with a 3.5 km smoothing distance, the nearest 12 points within 55 km, and transparent unsupported pixels. The optional TMD RadarGIS layer is displayed separately and keeps observed frames available when the nowcast feed is temporarily incomplete.

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

Unit tests inject mock `fetch` implementations and do not call external providers. They cover timestamp parsing, station QC, IDW, CAMS coverage/extrapolation, reliability scoring, PM2.5 failures/timeouts, and rain provider/coverage failures. `npm test` also builds and runs rendered-page regression tests.

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
