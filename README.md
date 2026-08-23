# BKK Air Forecast

BKK Air Forecast is a Bangkok-metropolitan web application for viewing seven-day PM2.5 and rain outlooks across Bangkok, Nonthaburi, Pathum Thani, Samut Prakan, Samut Sakhon, and Nakhon Pathom. It is designed for planning and data exploration; it is not an official warning or health-advisory system.

## Features

- Seven-day PM2.5 outlook with Bangkok station observations, province model grids, and spatial IDW surfaces
- Seven-day rain outlook with 3-hour windows, probability and rain-amount views
- Province selector shared across air and rain views, defaulting to Bangkok
- Optional TMD RadarGIS observed and 0–3 hour nowcast layers
- Explicit `live`, `degraded`, and `unavailable` data states
- Upstream timeout handling, quality-control summaries, and safe no-data behavior
- Responsive Leaflet maps with bounded surface caches

## Architecture

The application uses React 19 and vinext with file-based routes under `app/`. Server routes adapt upstream sources into stable JSON contracts. Pure PM2.5 logic lives under `app/lib/forecast/` so timestamps, quality control, interpolation, CAMS aggregation, bias correction, and reliability scoring can be tested without network access.

The browser renders Leaflet base maps and generates clipped raster IDW surfaces. Generated PM2.5 surfaces are cached by day, station-data version, and boundary version. Rain surfaces use a 24-entry LRU-style cache keyed by day, 3-hour window, metric, data version, and boundary version.

## Data Sources

- **AirBKK:** current PM2.5 observations from Bangkok monitoring stations; it is observation data, not a forecast model.
- **CAMS Global via Open-Meteo Air Quality:** model forecast used as the PM2.5 background field.
- **Open-Meteo Weather Forecast:** wind and precipitation context for PM2.5.
- **Open-Meteo Best Match and GFS:** rain model providers, queried in that order.
- **BMA GIS:** official Bangkok district boundary when available.
- **Department of Mineral Resources GIS:** official province boundaries for the five metropolitan provinces.
- **TMD RadarGIS:** observed radar and short-range nowcast image layers.
- **OpenStreetMap:** basemap tiles.

## PM2.5 Forecast Method

AirBKK records are validated, freshness-filtered, deduplicated, and checked using a global median absolute deviation sanity screen with nearby-station corroboration. CAMS hourly forecasts are aggregated into daily values at nine anchors and spatially interpolated using inverse-distance weighting (IDW). The current AirBKK–CAMS difference supplies a bounded bias correction that decays with lead time.

The PM2.5 surface is an interpolation, not a direct measurement at every pixel. `forecastReliabilityScore` is a heuristic based on lead time, source availability, CAMS coverage, and observation age. It is not a probability of forecast accuracy and has not been historically calibrated.

## Rain Forecast Method

Rain values come from nine model grid points covering the selected province. Hourly model values are aggregated into eight 3-hour windows per day and then summarized for the province. The map interpolates those nine grid-point forecasts with IDW. The optional TMD RadarGIS layer is displayed separately from the model forecast.

## Data Quality / Fallback Behavior

- `live`: required inputs meet coverage/freshness criteria and supporting weather is available.
- `degraded`: a usable forecast exists, but a secondary source, hourly coverage, or freshness criterion is incomplete. `degradedReasons` explains why.
- `unavailable`: a trustworthy forecast cannot be produced. The API returns current date placeholders and no PM2.5 stations/rain points; the UI disables the heatmap and offers retry.

Every upstream request has a bounded timeout. PM2.5 `dataQuality.upstream` reports `ok`, `timeout`, or `error` for AirBKK, CAMS, and weather. AirBKK bias correction is used only for Bangkok; the five neighbouring provinces are explicitly labelled as CAMS-only model grids. Bundled dated demo values are not used in the production failure path. A simplified province boundary may be shown when an official GIS service is unavailable, and the UI labels this boundary fallback explicitly.

## Local Development

Requirements: Node.js `>=22.13.0` and npm.

```bash
npm ci
npm run dev
```

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

Build the production bundle with `npm run build` and deploy the generated vinext application using the hosting environment configured for the repository. CDN caching is enabled on successful forecast responses with stale-while-revalidate windows; unavailable responses use `no-store`. The included CI workflow validates install, lint, tests, and build but does not deploy.

## Limitations

- PM2.5 bias correction and reliability scoring have not been validated against a historical backtest.
- IDW smooths between sparse observation/model points and can miss street-level variation.
- CAMS and global weather models have coarser resolution than Bangkok districts.
- Rain is model output from nine grid points, not radar and not an official district forecast.
- Upstream outages, delayed observations, and boundary fallback reduce data quality.

## Disclaimer

Forecasts are estimates for general planning only. They are not an official health advisory, emergency alert, weather warning, or substitute for announcements from Bangkok Metropolitan Administration, the Pollution Control Department, the Thai Meteorological Department, or public-health authorities. Follow official guidance when conditions may affect health or safety.
