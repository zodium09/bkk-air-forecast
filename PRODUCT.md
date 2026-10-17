# Product

## Current direction — October 15, 2026

The primary product is a public tool for people following rain, flooding evidence, and basin conditions across the Chao Phraya system: Ping, Wang, Yom, Nan, Sakae Krang, Pasak, and the middle/lower Chao Phraya. It offers two modes over the same observations and definitions: a short general summary and a detailed station/map/history workspace. A user's primary job is to decide which basin and measured station to monitor next, and to inspect the original evidence and time of that reading. Air quality and heat remain secondary topics. The user-confirmed direction here supersedes the older equal-weight air/rain/heat briefing and automatic-location-first entry described below; those paragraphs document earlier implementation decisions until their routes are migrated.

Release claims must distinguish measured rain, measured river level, daily reservoir reports, radar, model forecast, and an official bulletin. Station water level or capacity is never a flood-depth map, travel-time estimate, or official warning. Missing and stale readings cannot mean safe or zero. Scope starts at the whole basin; location permission is optional. Basin, station, and mode must survive a share link and browser history. See [the content contract](docs/HYDRO_CONTENT_CONTRACT_2026_10_15_TH.md) and [implementation plan](docs/SOL_OVERHAUL_HANDOFF_2026_10_15_TH.md).

## Register

product

## Users

People who live, commute, work, study, or plan outdoor activity in the Chao Phraya basin and Greater Bangkok and need a quick, location-aware view of PM2.5, rain and heat forecasts, plus current water observations and upstream context. Their primary job is to understand current conditions and the next seven days, while being able to distinguish observations, model forecasts, spatial estimates, and degraded data.

## Product Purpose

BKK Air Forecast combines air-quality observations with atmospheric and weather models to provide planning-oriented PM2.5, rain and heat outlooks. The default scope includes the actual Chao Phraya basin polygon plus the original six metropolitan provinces. Added provinces cover only their portion within the basin. Success means users can identify days, areas, and time windows worth monitoring, understand forecast uncertainty and data freshness, and know when to defer to official public-health or weather warnings.

## Water Observation Extension

The overview includes recent published canal and river levels in the primary scope. A separate upstream strip tracks station rainfall, water levels and dated daily reservoir inflow/release in Ping, Wang, Yom, Nan, Sakae Krang and Pasak. These source measurements retain agency, timestamp, unit, vertical datum and freshness; they remain distinct from the seven-day forecast. Upstream context does not imply full detailed service in those basins, flood routing or a measurement for every neighborhood. See docs/CHAO_PHRAYA_COVERAGE_TH.md.

## Brand Personality

Trustworthy, precise, and calm. The product should communicate technical evidence in approachable Thai, make uncertainty visible, and avoid alarmist or falsely authoritative language.

## Anti-references

- An official emergency-warning interface or health-advisory system.
- A weather map that implies pixel-level or district-level precision unsupported by the source data.
- A dashboard that hides source freshness, degraded inputs, model limitations, or fallback boundaries.
- A decorative command-center aesthetic that competes with the map and the decisions users need to make.

## Design Principles

- Show provenance, freshness, model status, and uncertainty beside every forecast.
- Separate observations, model output, and spatial interpolation in both language and interaction.
- Help users answer where, when, and how confident before exposing technical detail.
- Fail safely: remove misleading layers, explain the reason, and offer recovery when trustworthy data is unavailable.
- Preserve a calm, legible interface under time pressure, on small screens, and for users with different visual abilities.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Do not rely on color alone for risk or status; retain visible keyboard focus, semantic labels, and reduced-motion behavior. Thai copy and key values must remain readable at 200% text zoom and on mobile touch targets.


## Location and water topic — October 3, 2026

Automatically request browser location on the public entry pages, use the nearest supported public reference and retain manual choice on denial or unavailable location. The browser permission remains required. Do not continuously track or persist the user coordinates in browser storage. Explicit topic-link coordinates and manual selection take precedence over a pending automatic fix.

Rain and water have separate navigation and content ownership. /rain explains radar and precipitation forecasts; /water explains current station water levels, road observations, recorded history and upstream context. No water forecast is inferred from rain. The overview summarizes both as separate chapters. Selected-point maps and observation lists share an 8 km radius. Geographic lists and maps start compact and can be expanded without losing the total counts. Street maps use OpenFreeMap with provider attribution and a functional raster fallback.


## October 4, 2026 detailed topic reading

The user asks to read more of each topic continuously, with less collapsed primary content. Overview rain, water, air and heat chapters now remain visible, with topic jump links. Daily forecasts and selected upstream basin details are visible without disclosure clicks. Large geography lists and technical methods can remain optional. Charts show metric names, units, sample values and time labels; rain amount and probability use separate plots. River capacity and reservoir storage use source percentages, distinct from risk probabilities and MSL water readings. Windy rain radar supplements TMD and retains its own native legend, source time and playback controls.

## October 4, 2026 tide and rain timing

Water also includes official hourly tide predictions for four lower-river/coastal reference stations, aligned with hourly precipitation forecasts at those public station coordinates. A transparent three-hour watch filter highlights rain coinciding with relatively high predicted water; it does not forecast inundation depth or assign a flood probability. Current nearby water/road observations remain separate and retain their own timestamps even when a future tide date is selected. Automatic station choice is bounded, upstream locations receive only lower-river context, and annual tide facts expire rather than repeating into a new year. See docs/TIDE_RAIN_ANALYSIS_TH.md.

## October 14, 2026 interactive dashboard revision

The user requests a more colorful, expressive interface with fewer repeated summaries and a stronger focus on interactive charts, dashboard cards and maps. Water now orders current situation cards, a visible shared water/road map, tide/rain timing, station detail, road detail and upstream context. Cards filter the shared map; the selected water point opens that exact station's recorded detail. The map replaces the repeated observation maps and station count banners on this route. Forecast chapters in the overview each use one geographic watch map, retaining daily scope labels separately from hourly charts. Primary charts and readings remain visible; repeated explanations and source-link lists move into optional disclosures with concise source/time information still visible. Bright topic colors communicate navigation, while source risk colors retain their existing meaning. Motion responds to selection and data changes, supports a pause control and respects reduced motion.
