# Product

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
