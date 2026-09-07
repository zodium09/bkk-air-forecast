# Bangkok environmental map workspace

The home page opens the interactive map dashboard immediately. Air, rain and heat share a location inspector, visible province/provider filters, date/time controls and an interactive trend chart. The default appearance is midnight navy, with teal for air, blue for rain, and amber for heat. A saved light-theme preference is respected across pages.

## Interaction and data

- On desktop, the map and time controls fill the first viewport below the header and filters. Charts and location details follow below in normal page flow. The mouse wheel scrolls the page over the embedded map; full-map mode enables wheel zoom. Mobile retains its existing layout.
- `/air`, `/rain`, and `/heat` share a persistent Leaflet map. Changing a layer preserves the selected location and matching forecast day. Existing specialist tools remain at each route's `/advanced` page.
- IDW is the default forecast display for all three layers. Point forecasts and measured air observations remain separate modes. IDW uses at least three neighbors within 50 km, at most twelve neighbors, power 1.55 and 3.5 km smoothing. Only verified province/district polygons are filled; missing support remains transparent. Smooth display does not imply higher source resolution.
- Clicking an arbitrary supported position reads IDW at that coordinate. Clicking a source marker reads that source point. The inspector, timeline and time comparison use the same selected values. Probability differences are percentage points.
- Rain switches between probability and accumulated millimeters. Heat switches between heat index and air temperature. PM2.5 retains the source's daily cadence; rain and heat expose only their supplied daily and three-hour periods.
- The legend highlights both surface cells and points. The display menu controls point labels, satellite imagery, IDW opacity and weather motion.
- Weather motion is illustrative: ambient particles for air, falling strokes for rain, rising wisps for heat. It is clipped to geographic/data coverage, is not radar or an observed wind field, and does not animate missing values. Rain uses accumulated rainfall to avoid showing falling rain for a zero-rain cell. Motion stops during map movement, is throttled to about 30 fps, and respects reduced-motion settings and the user's toggle.
- At widths up to 780 px (1024 px for touch devices), the first viewport prioritizes province/source filters, layer selection, map, date/time selectors and the keyboard time slider. The trend chart and location details follow below. Map height responds to the small viewport height; search and display settings expand on demand. Landscape phones use a compact, horizontal time-control row.
- On touch phones, one finger scrolls the story over the embedded map; tapping still selects a coordinate or marker, and zoom controls remain available. Full-map exploration enables map dragging and hides surrounding sections without replacing the map. The expand control or Escape restores the previous scroll position and keyboard focus.
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

Unit coverage checks observation/model separation, true zero and unavailable values, temporal alignment, metric distinctions, year boundaries, polygon holes, bounded IDW, and raster sampling. Server-rendering checks cover the home page, the semantic map → forecast → location story order, all shared workspaces and preserved specialist tools. Browser checks exercise dark/light themes, spatial selection, stable map identity across layer and timeline changes, weather controls, reduced motion, touch scrolling and upstream error recovery. QA captures are in the ignored `output/playwright/` directory.

Validated on September 6, 2026: 66 unit tests and 26 rendered-page checks pass; Next.js and Cloudflare builds pass; lint and TypeScript checks pass. Browser flows also verified opacity, legend emphasis, visible changing animation frames, URL restoration, measurement timestamps, geographic names, full-map exploration, saved display preferences, and 375 × 667 / 375 × 812 layouts. District boundaries use the existing BMA endpoint with a 20-second upstream timeout and verified snapshot fallback.

Mobile story validation also covers 320 × 667, 390 × 844 touch emulation, and 1280 × 720 / 1440 × 1000 desktop layouts against the production build. Verified one-finger page scrolling over the embedded map, touch panning in full-map mode, selection, keyboard search, daily arrow/Home/End navigation, risk labels and colors, section focus, full-map focus restoration, light/dark themes, and reduced-motion playback controls.
