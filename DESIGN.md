# Bangkok environmental map workspace

The home page opens the interactive map dashboard immediately. Air, rain and heat share a location inspector, visible province/provider filters, date/time controls and an interactive trend chart. The default appearance is midnight navy, with teal for air, blue for rain, and amber for heat. A saved light-theme preference is respected across pages.

## Interaction and data

- At all screen sizes, a large map and time controls come first, followed by a continuous place list in normal page flow. The mouse wheel scrolls the page over the embedded map; full-map mode enables wheel zoom. Touch users can pan the map immediately and use the place-list shortcut to move directly to the readable summaries.
- `/air`, `/rain`, and `/heat` share a persistent Leaflet map. Changing a layer preserves the selected location and matching forecast day. Existing specialist tools remain at each route's `/advanced` page.
- The primary workspace displays only colored IDW dots for all three layers. A static catalog anchors 487 points to actual named roads (453) or interior khwaeng/tambon positions (34), spatially matched to BMA/DMR subdistrict polygons. Every address includes the locality, district and province. Overview scales show 79 district references; zoom level 10 reveals all localities. The list always includes all supported geographic targets and selection zooms to street level. IDW uses at least three neighbors within 50 km, at most twelve neighbors, power 1.55 and 3.5 km smoothing. Missing support produces no colored dot and an explicit unavailable list reading. Road names improve orientation without implying finer forecast resolution or values for the whole district.
- Clicking a supported position reads IDW at that coordinate. Clicking a colored dot reads the same estimate shown in its place-list row. The inspector, timeline and time comparison use those selected values. Probability differences are percentage points. Observation and raster tools remain available in specialist pages.
- Rain switches between probability and accumulated millimeters. Heat switches between heat index and air temperature. PM2.5 retains the source's daily cadence. Rain and heat expose provider-supplied hourly values alongside daily and three-hour aggregates. Hourly values retain zeros and missing data; daily-only TMD rain products never present supporting Open-Meteo hourly data as hourly TMD rainfall.
- The legend emphasizes colored dots. The primary display menu controls geographic names, satellite imagery, provider and metric; it offers no area fill or weather motion. Specialist pages retain their illustrative weather motion and raster controls.
- The large map responds to viewport height, with the readable list continuing below it. Layer tabs, province selection, the selected-location reading, legend, timeline and navigation occupy separate rows outside the canvas. Map tools occupy a 44–48 px side strip; no reading cards, legend, search results or detail sheets cover the map.
- Touch users can pan immediately. Full-map exploration hides the header, timeline and navigation while preserving the map and its selected location. Escape or the side-strip exit control restores the standard layout. Safe-area insets and dynamic viewport height support phone browser chrome.
- The place list is visible by default and has a direct text search, forecast period, value, plain-language verdict, next step and map-selection control. Forecast signals sort first, with missing readings last and explicitly counted. Search, settings, trend, location details and combined area watch remain on-demand views. Phones show a separate scrollable page; desktop shows a side panel beside the map. The map remains mounted.
- Area watch loads all three environmental feeds when opened, groups threshold-based forecast signals by named province or source area, and shows location, value, actual forecast period, explanation and provenance. Selecting a row sets its map layer, time and location. PM2.5 uses daily thresholds; daily rainfall thresholds never apply to hourly rainfall or probability. Missing feeds and dates remain explicitly incomplete. Forecast signals are not verified incidents or official alerts; the list links to the TMD warning page.
- Keyboard users can select daily or three-hour periods with arrow keys, Home and End, operate the native time slider, and navigate search results with arrows and Enter. All controls retain visible focus. Section links move reading focus to their destination. Reduced-motion preferences stop forecast playback and use instant section navigation.
- Geographic labels use verified BMA/DMR feature names, with district names disclosed at closer zoom levels and collision avoidance. Display preferences are remembered locally; precise location is not stored in preference storage.

## Dashboard revision — September 7, 2026

- Daily aggregates and three-hour samples have separate chart/slider sequences. Hover inspects a chart value; click, touch or keyboard selection updates the same map time. Missing values break the line instead of drawing a continuous forecast across gaps.
- Province and weather source are first-class filters and persist in the URL. Provider and rain metric are included in request/cache identities. TMD chance uses the supplied two-day horizon; accumulation requests TMD Daily. Live TMD daily products do not expose fabricated three-hour periods. PM2.5 retains its observation/model source contract.
- Source provenance identifies the actual provider and explicitly labels TMD fallback. The local live-data check returned Open-Meteo seven-day rain and TMD-requested fallback (TMD not configured).
- Validation for this revision: 71 unit tests, 26 rendered-page tests, TypeScript, lint, Next.js production build and Cloudflare build. Responsive CSS was reviewed; browser/device interaction testing was not run in this revision.

## Artwork

The generated Bangkok night panorama frames the home page and workspace header. It does not replace the geographic basemap. Existing topic illustrations are retained for continuity.

- Tool: built-in ImageGen, new image generation; no reference image supplied.
- Original: `public/bangkok-night-v2.png`
- Web asset: `public/bangkok-night-v2.webp`, quality 83.
- The original generated file is preserved. Image content is decorative, with CSS placement and a dark scrim to maintain text contrast.

### Generation prompt

```text
Use case: photorealistic-natural
Asset type: original landscape website background for a Bangkok environmental map app, approximately 2:1 aspect ratio
Primary request: Create one beautiful cinematic Bangkok riverside skyline at blue hour turning to night, seen from an elevated viewpoint over the Chao Phraya River. Recognizable modern Bangkok skyline silhouettes rise through humid atmospheric haze, with a subtle MahaNakhon-like stepped tower among the city buildings. A gracefully curving river leads from the lower foreground toward the distant center-right skyline. Moody layered monsoon clouds give the scene drama without any disaster.
Style/medium: premium atmospheric architectural photography with a subtle photoreal illustration finish, natural believable city scale and rich fine detail.
Composition/framing: very wide panoramic landscape; skyline in the lower half, river reflecting lights toward the lower right; deep navy upper and left negative space for website text, quiet shadow detail in the left third. Layered depth from near riverbanks to distant hazy towers. This is the artwork only, not a UI mockup.
Lighting/mood: serene, beautiful, humid tropical night, soft cyan-blue reflections on water, restrained warm amber building and riverside lights, dramatic cloud volume, balanced exposure dark enough behind website content without losing the city detail.
Color palette: deep midnight navy, smoky blue, desaturated teal cyan, restrained small amber highlights.
Constraints: generate only one image; no text, labels, logos, watermark, UI, icons, charts, false data overlays, lightning, disaster, excessive neon, cartoon clouds, or pasted flat gradients.
```

## Verification

Unit coverage checks observation/model separation, true zero and unavailable values, hourly alignment, cadence separation, named-area watch thresholds, metric distinctions, year boundaries, polygon holes, bounded IDW, and raster sampling. Server-rendering checks cover map-first controls, on-demand detail views, all shared workspaces and preserved specialist tools. Browser checks exercise dark/light themes, spatial selection, hourly changes, named-area lists, full-map mode, search, responsive layouts and upstream error recovery. QA artifacts are in the ignored `output/playwright/` directory.

Validated on September 6, 2026: 66 unit tests and 26 rendered-page checks pass; Next.js and Cloudflare builds pass; lint and TypeScript checks pass. Browser flows also verified opacity, legend emphasis, visible changing animation frames, URL restoration, measurement timestamps, geographic names, full-map exploration, saved display preferences, and 375 × 667 / 375 × 812 layouts. District boundaries use the existing BMA endpoint with a 20-second upstream timeout and verified snapshot fallback.

Mobile story validation also covers 320 × 667, 390 × 844 touch emulation, and 1280 × 720 / 1440 × 1000 desktop layouts against the production build. Verified one-finger page scrolling over the embedded map, touch panning in full-map mode, selection, keyboard search, daily arrow/Home/End navigation, risk labels and colors, section focus, full-map focus restoration, light/dark themes, and reduced-motion playback controls.

## September 26, 2026 map-first update

The primary workspace uses `map-first.css` and displays colored IDW dots with a continuous interpreted place list. `map-places.json` contains the public road/locality catalog, source timestamps, attribution and ODbL license; `scripts/update-map-places.mjs` regenerates it from actual OSM road vertices and official subdistrict polygons without runtime reverse geocoding. Individual surrounding provinces show their tambon references immediately; Bangkok and the metro overview use district references at wide scales. Address captions stay outside the map and disappear in full-map mode, with a small selected-road label retained beside the dot. The map, list and combined area watch use the same geographic references and IDW estimates, reusing distances across hours while selecting available neighbors separately. Watch groups use the geographic district even when the road name mentions another province. Weather API points include optional hourly fields without changing daily and three-hour response fields. Automated checks cover geographic coverage, address disambiguation, overview selection, IDW alignment, actual cadence, zero and missing values, rainfall-period semantics and unavailable support. Browser QA uses isolated fixtures outside the production application when live providers are inaccessible.

The dot/list revision passes 81 unit tests and 27 rendered-page checks, lint, Next.js and Cloudflare builds. Browser checks cover 320 × 667 and 390 × 844 mobile layouts, 1440 × 900 desktop, list search and map selection, hourly and metric changes, source status, and full-map mode. Live PM2.5, rain and heat feeds were also checked; the PM2.5 provider reported degraded source availability explicitly.
