---
name: BKK Air Forecast
description: A bright public environmental briefing for Bangkok and its surrounding provinces.
colors:
  briefing-emerald: "#007d58"
  briefing-emerald-hover: "#006344"
  rain-blue: "#0862d8"
  heat-orange: "#b94d00"
  watch-amber: "#915500"
  risk-red: "#bd3044"
  paper: "#ffffff"
  surface: "#ffffff"
  ink: "#173249"
  muted: "#506477"
  line: "#dbe5ee"
  soft: "#e8faf1"
  map-soft: "#edf6ff"
  map-sky: "#edf6ff"
  air-tint: "#ebfbf2"
  rain-tint: "#edf6ff"
  heat-tint: "#fff3e3"
  air-fill: "#13ac76"
  rain-fill: "#3388f4"
  heat-fill: "#f99026"
  dark-paper: "#101f29"
  dark-surface: "#172c35"
  dark-ink: "#edf5f2"
  dark-muted: "#a8bfbe"
  dark-line: "#304850"
  dark-soft: "#153d34"
  dark-map-soft: "#1b333a"
  dark-emerald: "#6dd9bb"
  dark-emerald-hover: "#8be6cd"
  dark-blue: "#8ac5ff"
  dark-orange: "#ffba73"
  dark-sky: "#17354c"
  dark-watch: "#e9c27c"
  dark-risk: "#ffa797"
  dark-on-emerald: "#10352b"
  dark-air-tint: "#153d34"
  dark-rain-tint: "#17354c"
  dark-heat-tint: "#3e2e23"
  dark-air-fill: "#24bd8a"
  dark-rain-fill: "#4697f8"
  dark-heat-fill: "#f99026"
  band-cyan: "#38bdf8"
  band-mint: "#34d399"
  band-yellow: "#facc15"
  band-apricot: "#fb923c"
  band-rose: "#f43f5e"
  band-green: "#22c55e"
  band-orange: "#f97316"
  band-red: "#dc2626"
  band-gold: "#eab308"
  dark-map-air: "#49bdb5"
  dark-map-rain: "#57a9ef"
  dark-map-heat: "#e9ab66"
typography:
  display:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "clamp(40px, 4.45vw, 64px)"
    fontWeight: 600
    lineHeight: 1.24
    letterSpacing: "-.035em"
  headline:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-.025em"
  title:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "IBM Plex Sans Thai, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
  reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "43px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-.025em"
  chart-reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.5
  bar-reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "16px"
    fontWeight: 600
  table-reading:
    fontFamily: "Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  scale: "3px"
  tab: "5px"
  date: "6px"
  control: "7px"
  action: "8px"
  bar: "9px"
  chart-day: "10px"
  field: "12px"
  map: "14px"
  reading: "18px"
  surface: "20px"
  pill: "99px"
spacing:
  compact: "8px"
  control: "12px"
  inset: "16px"
  mobile-gutter: "20px"
  gutter: "24px"
  workspace-gutter: "28px"
  surface-inset: "30px"
  section-mobile: "32px"
  section: "50px"
components:
  button-primary:
    backgroundColor: "{colors.briefing-emerald}"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.briefing-emerald-hover}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-secondary-hover:
    backgroundColor: "{colors.soft}"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 17px"
  navigation-link:
    textColor: "{colors.muted}"
  navigation-link-active:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.briefing-emerald}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
  area-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 13px"
  map-container:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  area-container:
    backgroundColor: "{colors.map-sky}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "30px"
  reading-air:
    backgroundColor: "{colors.air-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.reading}"
    padding: "22px 24px"
  reading-rain:
    backgroundColor: "{colors.rain-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.reading}"
    padding: "22px 24px"
  reading-heat:
    backgroundColor: "{colors.heat-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.reading}"
    padding: "22px 24px"
  layer-tab:
    rounded: "{rounded.tab}"
    padding: "6px 15px"
  layer-tab-air-active:
    backgroundColor: "{colors.briefing-emerald}"
    textColor: "{colors.surface}"
    rounded: "{rounded.tab}"
    padding: "6px 15px"
  layer-tab-rain-active:
    backgroundColor: "{colors.rain-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.tab}"
    padding: "6px 15px"
  layer-tab-heat-active:
    backgroundColor: "{colors.heat-orange}"
    textColor: "{colors.surface}"
    rounded: "{rounded.tab}"
    padding: "6px 15px"
  infographic-rain:
    backgroundColor: "{colors.rain-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "27px 30px 18px"
  chart-topic-rain-active:
    backgroundColor: "{colors.rain-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
---

# Design System: BKK Air Forecast

## October 1, 2026 briefing revision

This revision prioritizes the current environmental briefing, three numeric summaries with daily mini charts, planning signals and the seven-day outlook. Personal-area selection, geographic exploration and current water observations follow. The canvas is pale blue (`#f7faff`) with teal air charts (`#00866b`), blue rain charts (`#2679d6`) and amber heat charts (`#be531e`). Saved light/dark preferences remain supported. These changes supersede the older layout descriptions below.

- `/` provides the overview; `/rain` combines rainfall forecasts and current canal/river observations; `/air` focuses on PM2.5; `/heat` exposes air temperature and heat index through visible metric controls. Topic routes show a written verdict, exact source period, numeric reading, interactive chart, time controls and then the map. Advanced routes and forecast methods remain available.
- The default follows the Bangkok clock, including hourly rain and heat where supplied. PM2.5 keeps its daily cadence and explicitly labels the nearest available forecast when today's period is absent. Choosing a day switches to daily aggregates; choosing a rain-chart hour uses that exact date/hour across supported feeds. Topic links retain deliberate selections; default links continue following the clock. A visible return-to-current-time control restores this behavior.
- Mini charts and the seven-day infographic remain daily, even when the numeric briefing shows an hourly period. Missing periods stay missing; valid zero remains zero. Chart axes include zero. Water measurements always retain their station time, independently of the forecast selector.
- Source changes animate a short chart draw/bar rise and numeric transition. Inspection moves the cursor without replaying chart entry motion. Existing water diagrams animate when the station changes. Reduced motion removes these spatial effects. Time-strip selection scrolls only its horizontal container, preserving the user's vertical reading position.
- Shared implementation: `briefing-chart.tsx`, `topic-briefing.tsx`, `briefing.css`, and the current-period value helper in `app/lib/environment-overview.ts`. Isolated browser fixtures live only in ignored `output/playwright/`; production routes retain real provider data and explicit failure states.

Validation: Next.js and Cloudflare production builds, lint and TypeScript checks pass. All 115 unit checks and 30 rendered-route checks pass. Browser review covers desktop and 390px mobile layouts, light/dark themes, chart time selection, current-time reset, temperature switching and water station presentation. The live preview was also checked against the real forecast providers.

## Overview

**Creative North Star: "The Public Environmental Briefing"**

A bright white reading environment makes environmental evidence approachable in Thai. Saturated emerald, blue and orange identify air, rain and heat, with pale topic tints giving each daily reading and infographic a clear home. The interface remains precise: freshness, uncertainty, units and written verdicts sit beside the numbers.

Thai headings and prose carry the explanation; measured Manrope numerals make comparable values easy to scan. Three scale panels introduce the daily picture, while a proportional seven-day chart makes time selection tangible. The real geographic preview, chart and readings share the same selected day and personal area. Light is the default appearance; an explicit saved dark choice is respected across pages.

**Key Characteristics:**

- White canvas with emerald, blue and orange topic accents and bright tinted panels.
- Thai-first typography with tabular numerals and labeled proportional forecast bars.
- Segmented threshold scales and explicit missing-data gaps.
- Coordinated dates, topics and geographic context across readings, chart and map.
- Visible freshness, provenance and unavailable states beside the data.

## Colors

White surfaces and dark blue ink support the saturated topic colors; each topic has a darker text/action tone, a brighter identity fill and a pale container tint. Forecast bars use the existing shared risk colors rather than topic fills.

### Primary

- **Briefing Emerald** identifies air, primary actions, active navigation and keyboard focus. **Air Fill** and **Air Tint** carry the air panel and infographic. The deeper hover tone belongs to the primary action.

### Secondary

- **Rain Blue**, **Rain Fill** and **Rain Tint** identify rain controls, bars, map headers and containers. Blue also carries search and explanatory icons.

### Tertiary

- **Heat Orange**, **Heat Fill** and **Heat Tint** identify heat. **Watch Amber** and **Risk Red** carry written priority distinctions.
- **Band Cyan**, **Band Mint**, **Band Yellow**, **Band Apricot**, **Band Rose**, **Band Green**, **Band Orange**, **Band Red** and **Band Gold** are the actual shared legend colors used by segmented scales. Their thresholds come from the selected metric's legend, not the topic palette.

### Neutral

- **White Canvas** and **White Surface** are pure white. **Emerald Soft** marks general active/hover context; the personal-area group uses **Map Sky**. The detailed workspace's soft color follows its environmental layer.
- **Ink**, **Muted** and **Line** carry primary reading, supporting evidence and quiet dividers. Missing values use muted text rather than a safe-status color.
- The overview's dark theme uses its corresponding dark paper, surface, ink, muted, line, topic tints, fills and brighter topic accents. Its **Dark Emerald Soft** and the detailed workspace's **Dark Map Soft** are separate implemented values. Overview primary actions use **Dark On Emerald**; selected overview topic tabs use the dark paper tone for text. The detailed workspace's existing important dark-theme overrides apply **Dark Map Air**, **Dark Map Rain** and **Dark Map Heat** to the consumed accent variable; those values are distinct from the overview's dark accents.

**The Topic and Risk Rule.** Topic fills identify data types; segmented scale colors and written verdicts retain their separate threshold meanings.

**The Evidence Color Rule.** A colored reading must retain its written status and source context; unavailable data must remain distinct from zero.

**The Stable Risk Hue Rule.** Selecting a forecast bar adds an ink outline while preserving the bar's risk color.

## Typography

**Display and Body Font:** IBM Plex Sans Thai, with a sans-serif fallback.
**Numeral and Brand Font:** Manrope, with a sans-serif fallback.

The pairing balances readable Thai explanations with compact, steady numbers. The overview and shared map workspace use this identity; retained specialist and surveillance surfaces keep their existing implementation and contracts.

### Hierarchy

- **Display:** the frontmatter's fluid Thai heading, medium-heavy weight and compact line height. At the intermediate breakpoint it becomes 49px; phones use clamp(39px, 9.5vw, 56px).
- **Headline:** section headings use the headline role, reducing to 25px on phones.
- **Title:** environmental topic labels use the title role. Selected-area headings use 23px at weight 500; the unselected-area prompt uses 24px.
- **Body:** the page uses the body role. Introductory prose is 16px with 1.85 line height, reducing to 14px with 1.8 line height on phones. Source explanations use 13px and an 85ch maximum measure.
- **Label:** compact control labels use the label role; secondary timestamps and units can be smaller within evidence groups. Do not reuse those metadata sizes for explanatory paragraphs.
- **Reading:** daily panels use the reading role, reducing to 40px on phones. The selected chart value uses the chart-reading role, reducing to 42px on phones; bars carry the bar-reading role. Table values use the table-reading role; local readings use 26px, reducing to 24px on phones. Units remain Thai body type.

**The Reading Pair Rule.** Keep every number visually attached to its unit, forecast period and interpretation.

## Layout

Use a centered reading frame with normal page scrolling. The overview frame is at most 1200px wide, with a minimum 24px gutter; phone gutters become 20px and narrow screens below 360px use 16px. The detailed workspace expands to 1400px, with 28px desktop insets and smaller mobile map insets. Its map height follows the viewport and retains the interpreted place list below it.

Wide screens pair explanatory copy with a bounded map and arrange the three tinted daily panels in equal columns with an 18px gap. Personal-area controls and evidence form a two-column group. At 780px, these become sequential single-column sections; panel gaps become 14px. Intermediate adjustments begin at 1080px. Coarse-pointer detailed workspaces use the mobile composition through 1024px.

The forecast chart retains a 620px plot inside its own horizontal scroller. A selected day that leaves the visible area scrolls back into view after a date or topic change, smoothly by default and instantly with reduced motion. The optional numeric table keeps its 780px minimum width inside a separate scroller on phones, with its row heading anchored.

Large sections use the recorded section spacing, reducing to the mobile section spacing on phones. Map tools, time controls, geographic context and legends retain separate rows outside the detailed canvas. The overview's specific journey is recorded in [.impeccable/overview-brief.md](.impeccable/overview-brief.md).

## Elevation & Depth

Topic tints and fine dividers establish most grouping. The resting map preview has a subtle shadow (0 8px 32px #1732490b), a colored top border and a topic-tinted heading. Daily panels and the chart rely on their tints and shapes. The search-result popover uses 0 12px 34px rgba(25, 61, 70, .18) to communicate an open floating layer; map dots use a small 0 1px 3px #193d4633 shadow for legibility on tiles.

**The Quiet Surface Rule.** Use topic tints and dividers for evidence, a subtle lift for the geographic preview, and floating depth for transient search controls.

## Shapes

Compact controls retain modest corners: layer tabs use the tab radius, day shortcuts use the date radius, selectors and area chips use the control radius, primary actions use the action radius, and search uses the field radius. Daily panels use the reading radius; map, personal-area and infographic groups use the surface radius. Topic buttons and current navigation use the pill radius. Chart bars round their top corners with the bar radius; day hit areas use the chart-day radius. The detailed map, timeline and status retain the map radius at their outer top and bottom corners.

## Components

### Buttons

Primary actions are solid emerald with white text, the frontmatter's action radius and padding, and a 48px minimum height. Their hover background transitions over .18s. Secondary location and refresh controls are outlined with a 44px minimum height. Text links use emerald or contextual topic color and underline on hover. Focus throughout the overview is a 3px emerald outline with a 4px offset; chart day buttons move that outline inward by 2px. Disabled loading buttons show a waiting cursor and .55 opacity; chart step buttons use .4 opacity and the default cursor at date boundaries. Reduced-motion preferences remove transitions and animation.

### Topic selection, chips and navigation

Hero topic pills, chart topic pills and map tabs coordinate the selected environmental type. Topic selection changes both the infographic and preview; the panel's trend action also moves reading focus to the chart. Active chart pills and map tabs use their topic's darker color with contrasting text. Current section navigation is an emerald-tinted pill. Area chips remain white outlined actions, growing from a 40px desktop minimum to 44px on phones. Compact topic controls retain their implemented 40px minimum; that value is not a system-wide touch-target recommendation.

### Daily scale panels

Each of the three panels has its topic tint, an 18px corner radius and a 4px top border in the brighter topic fill. Desktop padding is 22px 24px, changing to 20px 18px at the intermediate breakpoint and 20px on phones. The large number is paired with a written verdict, source state, timestamp, trend action and detailed-route link.

The genuine segmented scale uses the shared legend's colors and thresholds. Segment widths represent threshold spans on the displayed scale: PM2.5 extends to 100+, accumulated rain to 120+ and heat index to 60+. A triangular marker locates an available value and is clamped to the displayed range; missing data removes the marker and dims the track to .35 opacity. The scale is decorative to assistive technology because the value and written verdict provide the reading.

Each daily panel also pairs its value with a four-level forecast planning meter. Its named levels are low, moderate, high and very high (ต่ำ, ปานกลาง, สูง, สูงมาก), using the existing mint, yellow, apricot and rose legend colors. An unavailable reading is explicitly unassessable and has no selected level.

### Map and personal-area containers

The white map frame uses the surface radius and subtle resting shadow. Its header follows the selected topic tint and fill. The preview has a 283px desktop canvas and 260px phone canvas; geographic selection increases a point's size and border weight. A horizontal date strip changes the same selected day as the readings and chart. Full-map links carry the selected day and coordinate. Personal-area controls sit in a pale blue group, followed by the three local readings.

### Interactive seven-day infographic

Native day buttons are proportional forecast bars with numeric labels, date labels and a selected-day dot. The dynamic axis includes zero and retains negative values; bar height is determined by the forecast value and that axis. The plot is 180px high. Bars use the existing four-level planning risk colors; selection retains that hue and adds a 2px ink outline. A labeled risk key and a compact named meter explain the selected value. A true zero retains its numeric label; a missing period has no bar and displays a dashed gap with an em dash and “ไม่มีข้อมูล”. Users can select a day even when that topic has no reading.

Selecting a bar, a map date or an optional table header updates all three readings, the map and the detailed-route dates together. The chart's previous/next controls are circular 44px buttons, disabled at the available date boundaries. The selected bar automatically becomes visible in the horizontal scroller. Height changes apply immediately so a moving bar cannot imply a false intermediate forecast; color feedback transitions over .18s. Reduced motion removes that transition and uses instant selected-day scrolling.

The native disclosure below the chart optionally reveals the three-topic numeric table. Selected table headers are emerald and selected cells use the soft tint. Missing readings remain distinct from true zero in both chart and table.

### Forecast planning signals

The on-page signal summary is specific to the selected forecast day and public area reference, or to the mean of available forecast points when no area is selected. It names the highest known planning level and links each environmental type to its matching detailed route. Missing types remain visible and explicitly unassessable; partial data does not imply low risk. These are model-based planning signals, not official alerts or verified incidents, and a regional mean may hide a stronger local reading.

The four levels reuse the existing placeReading thresholds: daily PM2.5 is low at ≤25, moderate at >25–37.5, high at >37.5–75 and very high above 75 µg/m³; 24-hour rain is low at zero, moderate at >0–35.5, high at >35.5–90 and very high above 90 mm; daily maximum heat index is low below 33, moderate from 33 to below 42, high from 42 to below 52 and very high at ≥52°C. The native criteria disclosure retains units and periods beside these planning rules.

### Inputs and source evidence

Search is a white outlined field with a 54px desktop input, a 52px phone input and 16px phone text. Its six-result popover includes place and address context, hover highlighting, keyboard navigation and visible focus. Province and district selectors use native controls with a 46px minimum height. Main navigation has 44px links and scrolls horizontally on phones.

Watch signals remain continuous rows with source area, value, unit and written status. Source disclosures use native details and summary elements with separators; expanded content exposes provider, update time, method and limitations.

## Do's and Don'ts

### Do:

- Do retain source status, actual timestamps and forecast periods beside comparable readings.
- Do distinguish saturated topic identity from the scale's threshold colors and written risk verdicts.
- Do use Thai-first prose, tabular readings and labeled bars with an axis that includes zero.
- Do coordinate selected dates and topics across readings, chart, map and detailed links.
- Do preserve visible keyboard focus, selected-day visibility and reduced-motion behavior.
- Do distinguish observations, model forecasts, spatial estimates and missing data.

### Don't:

- Don't present missing values as zero, borrow a reading from another day, or invent observations.
- Don't treat topic fills or bar height as a substitute for risk labels and source limitations.
- Don't describe source watch signals as verified incidents or official warnings.
- Don't imply that a named road or map dot proves street-level forecast resolution.
- Don't allow decorative imagery or nested cards inside the daily panels to compete with evidence.

## Interaction and data

The home page is now the environmental overview. `/air`, `/rain` and `/heat` retain the detailed map workspace, with a shared location inspector, visible province/provider filters, date/time controls and an interactive trend chart. The following map and model contracts continue to apply to those detailed routes.


### Surveillance workspace refinement — 2026-09-16

- Surveillance keeps the product navy/teal/amber identity. Use a quiet horizontal summary rail and flat evidence groups rather than nested KPI cards.
- Use readable Thai body text, 44px interactive controls, explicit focus indicators and reduced-motion support. Desktop pairs an operations column with evidence; mobile puts the event queue before the map.
- Filters, counts and print report share the same scope. Empty results offer a reset. Marker selection uses event identity; provincial centroids do not imply affected polygons.
- Always show synthetic status and fixed fixture reference time. Acknowledgements are revision-scoped, session-only and never change event lifecycle.


- On `/air`, `/rain` and `/heat` at all screen sizes, a large map and time controls come first, followed by a continuous place list in normal page flow. The mouse wheel scrolls the page over the embedded map; full-map mode enables wheel zoom. Touch users can pan the map immediately and use the place-list shortcut to move directly to the readable summaries.
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

The generated Bangkok night panorama belongs to the previous home-page and workspace-header design. Its assets and generation record are retained; the current environmental overview uses a live geographic preview. The artwork does not replace a geographic basemap. Existing specialist topic illustrations are retained for continuity.

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

## October 1, 2026 overview revision verification

The overview revision passes the Next.js production build, Cloudflare build, lint and TypeScript checks, plus 126 unit tests and 32 rendered-page tests. Browser checks verify no page overflow at 390px, a tomorrow selection updating the preview, keyboard search selecting Sukhumvit/Khlong Toei and carrying the exact daily date and coordinates to `/rain`, province changes clearing the personal-area selection, and aborted upstream requests showing missing data with retry instead of false zeros. Theme persistence, exact matching rain values, full-map mode and Escape focus restoration also pass. Settled production captures cover the 1440px desktop and 390px mobile overview, dark theme, and both detailed-map viewports in `output/playwright/`.

The independent finish review found one search accessibility issue. The final native search input, instruction reference and ordinary result buttons correct that issue; ArrowDown/Escape closes results and restores input focus. The reviewer inspected all seven recaptured views, scored the single finding resolved, and returned `ship` for that scoped verdict. Screen-reader and 200% text-zoom testing were not performed. The Impeccable context and detector launchers failed or hung; no detector pass is claimed.

### White-canvas infographic refinement — October 1, 2026

The approved colorful refinement passes lint, the Next.js production build, the Cloudflare build, 128 unit tests and 32 rendered-page tests (160 total). Settled live-data browser checks verify that selecting tomorrow updates all three readings, the map and detailed link; the Sukhumvit public point's 3 mm chart value matches its personal-area reading; keyboard selection of the last day scrolls the chart to 302px and leaves the active day visible; and widths of 320px, 390px, 900px and 1440px have no page overflow. Today's unavailable PM2.5 period is an explicit chart gap, not a false zero. The checked browser reported no errors.

Final production captures are in output/playwright/: color-desktop-final.png, color-mobile-final.png, color-desktop-viewport.png, color-desktop-chart-final.png, color-mobile-chart-final.png and color-mobile-dark-final.png. The independent reviewer found the visual, interaction and data implementation matched the approved refinement; its only remaining finding was the stale documentation addressed by this synchronization. No detector, screen-reader, 200% text-zoom, color-vision simulation or cross-browser pass is claimed.


## Water observation extension

The overview now adds current canal and river station observations after the seven-day forecast chart. This is an ordinary extension of the approved white/topic system: it reuses the rain-blue information role, map-sky surface, ink, muted, line and existing focus tokens; it introduces no palette replacement. Native canal/river filters and a complete station selector accompany quick station rows, a measured-level/bank comparison diagram, measurement timestamps, producer agency and geographic links. Mobile keeps three quick station rows and brings selected detail into view; reduced motion uses instant scrolling.

Water is station evidence from ThaiWater, distinct from model forecasts and source watch signals. MSL and station-gauge readings retain their respective datum; only fresh MSL measurements with a supplied MSL bank are compared. Negative levels, real zeros and centimetre differences remain visible. Stale readings are labelled, expired/future/invalid readings show unavailable state, and missing water never becomes zero. Province/nearby-reference selection filters or ranks actual stations without interpolating an area-level water reading. The detailed contracts and official sources are in [docs/WATER_DATA_SOURCES_TH.md](docs/WATER_DATA_SOURCES_TH.md).

The overview uses accumulated daily rainfall consistently in its summaries, chart and watch list. Probability-only watch signals remain available in detailed tooling; the default shared watch contract is preserved.

### Water capacity and finite motion refinement

Water status uses the published source storage_percent only on fresh, usable measurements: ≤10% critical-low, >10–30% low, >30–70% normal, >70–100% high and >100% overflow. The percentage is source evidence, not flood probability, and is never computed when missing. Without a usable capacity percentage, a compatible fresh MSL water/bank comparison can signal that the bank is reached; being below the bank alone leaves the planning risk unknown. The same status color accompanies the station row, selected evidence and valid diagram.

The vertical diagram uses actual source water, bank and ground levels in the same MSL datum when the ground is below the bank and the water is at or above the ground. Otherwise the compatible water/bank comparison uses its horizontal fallback. Stale, expired or invalid-future observations do not create a current capacity signal or diagram. The diagram does not interpolate levels or depict a future trend.

The measured geometry receives one 650ms clip reveal and one 900ms stroke sweep, using cubic-bezier(.16,1,.3,1), when the station or observation timestamp changes. The pause control and reduced-motion preference show the final static geometry with animation disabled. There is no loop or added animation dependency.

The scoped finish passes 137 unit tests and 32 rendered-page tests (169 total), lint, Next.js and Cloudflare builds. Supplied browser checks cover date synchronization, 17 fresh attention-filtered stations at test time, stale station ID 5 (คลองมหาสวัสดิ) remaining unknown with no capacity or diagram, aborted water fetch showing cannot-assess with retry, pause disabling animation, and a running reveal at 100ms that is finished by 850ms. Reduced motion disables animation; 1440px and 390px layouts have no page overflow and the checked desktop browser reports no errors. The fresh finish reviewer returned ship with no material fixes and measured contrast of 4.65–7.70 in its reviewed combinations. No screen-reader, 200% text-zoom, cross-browser or detector pass is claimed.

Final captures are in output/playwright/: risk-desktop-summary-final.png, risk-desktop-chart-final.png, risk-desktop-water-final.png, risk-mobile-summary-final.png, risk-mobile-chart-final.png, risk-mobile-water-final.png and risk-mobile-dark-final.png.

## October 2, 2026 topic content and chart revision

The overview uses shared personal-area and forecast-date controls before complete topic chapters: rain and water, PM2.5, then heat. The rain chapter finishes its forecast, watch, map and source information before road-flood and canal/river observations; only then does the air chapter begin. Air keeps observations, forecast, watch, map and source information together, and heat follows the same topic grouping. White surfaces and emerald/blue/orange identities remain. Every reading labels its own source period; a nearest available daily PM forecast can be tomorrow while hourly rain and heat are today. Current station readings do not change with forecast-date selection.

PM2.5 retains seven-day risk-colored bars. Rain exposes amount bars and a probability line on a fixed percentage axis; heat compares heat index with air temperature on the same axis and in the optional data table. Each day can open the finest source time detail. Daily and hourly charts retain actual source indices, midnight, missing values and zero. Next-period rain plots span 24 elapsed hours rather than a fixed number of coarse samples. Very small nonzero values remain distinct from zero. Probability, hourly rain totals and raw air temperature do not inherit incompatible daily-rain or heat-index risk criteria.

Road counts use a proportional distribution with an explicit unavailable group. Water summary controls split high/overflow from low/critical-low stations and retain an assessed-coverage count. Station history describes the actual archived range and maximum retention separately. Forecast charts receive one bounded 650 ms reveal, and exact numbers use a short opacity update; reduced motion disables both. No animation dependency was added.

The revision passes lint, Next.js production build and TypeScript, Cloudflare build, 158 unit tests and 32 rendered-page tests (190 total). Browser verification covers `/`, `/air`, `/rain`, `/heat`, metric switching, source dates, area-coordinate links, time/map synchronization, low-water filtering, dark theme and reduced motion. Desktop and mobile captures are in output/playwright/content-*.png. The scope does not include a new external alert dispatch or deployment.

### Sequential topic chapters

The overview follows rain → water on roads → canals/rivers → PM2.5 → heat without inserting another topic's readings between them. The introduction provides three topic anchors. Area selection carries scope to each chapter without mixing numerical summaries above the chapters. Each chapter contains its own watch signals, provenance and map entry; the selected inline map stays inside its matching chapter and only one map is mounted at a time. Road observations show the full available attention list before water details. Rendered-page assertions check chapter order and ownership of forecasts, observations, watch signals, maps and sources.

This grouping passes lint, Next.js production build and TypeScript, Cloudflare build, and all 32 rendered-page checks. Live browser inspection at 1440 × 1000 and 390 × 844 confirms topic anchors, contiguous chapter boundaries, switching the single map between all three chapters, and Khlong Toei coordinates in each detailed-topic link. Both viewports have no page overflow; dark theme and reduced-motion menu feedback also pass. The checked browser reports no errors. Captures are in output/playwright/topic-order-*.png. The existing unit suite was not rerun for this layout-only grouping.

## PM2.5 atmospheric analysis and cold-wind outlook

The air chapter adds a place/date-specific atmospheric explanation immediately after its PM2.5 forecast. A circular speed-weighted wind compass, source-backed daily/hourly graphs and four colored factor controls expose wind, mixing height, rainfall and humidity. The cold-wind section presents northerly-hour share, morning-temperature change and sea-level-pressure change as separate evidence, with an experimental combined rule and an official TMD forecast link. These explanatory factors do not recalibrate the incumbent PM2.5 model or claim a causal source attribution. Missing inputs remain missing.

The NOAA GFS feed is independent of the PM, rain and heat models. Its exact units, Bangkok-local hours, accepted coverage, upstream grid and retrieval time are visible or recorded. Rain aggregation retains the preceding-hour convention and requires a full calendar day. The adapter bounds coordinates, shares canonical regional references, deduplicates concurrent calls, and limits memory and edge cache lifetime to 15 minutes or Bangkok midnight. It provides no fabricated fallback weather. Detailed contracts and primary sources are in [docs/AIR_ATMOSPHERE_ANALYSIS_TH.md](docs/AIR_ATMOSPHERE_ANALYSIS_TH.md).

The overview preserves its white background and contiguous rain/water → air → heat chapters, with brighter mint/blue/orange accents and violet for rain in the atmospheric comparison. Typography, semantic controls, touch targets, dark-theme support and exact source values remain. The wind arrow receives a single bounded 550 ms clip reveal; reduced motion disables it. Pressure and morning-temperature graphs explicitly label their expanded vertical axes.

Validation passes lint, TypeScript and the Next.js/Cloudflare builds, 167 unit tests and 32 rendered-page checks (199 total). Live browser checks at 1440 × 1000 and 390 × 844 cover factor selection, 24 hourly samples and internal scrolling, Phra Nakhon selection, date synchronization with PM and detailed-map links, pressure-graph switching, dark/light themes and reduced motion. The October 8 pressure reading of 1,012.6 hPa and wind reading of 5 km/h match their returned API values at display precision. Both viewports have no page overflow, and the checked browser reports no errors. Captures are in output/playwright/air-*-final.png. No new dependency, deployment or independent model calibration is included.

## October 2, 2026 nearby rain radar and illustrated entry

The rain chapter and `/rain` add actual TMD RadarGIS images, observed/nowcast controls, source timestamps, image opacity and frame playback. Radar remains tied to the current source period independently of the selected forecast date. A selected public reference or map point receives the source's 8 km location analysis and the four nearest actual Open-Meteo hourly provider points. The interface separates radar rate (mm/h), hourly totals and probability; true zero remains an empty bar and missing values remain unavailable. Source location analysis has no timestamp of its own, so catalog freshness is a gate rather than a claim that both results share the same snapshot. The full contract is in [docs/RAIN_RADAR_NEARBY_TH.md](docs/RAIN_RADAR_NEARBY_TH.md).

An optional watch shows an in-app alert while the page is open. Dismissing a result suppresses the same area/message on subsequent refreshes. It does not dispatch background or external notifications. Playback waits for each actual image to load, stops when the document is hidden and disables automatic motion for reduced-motion preferences. Nearby hourly bars and topic selection use bounded transform transitions without adding an animation dependency.

The overview uses “พื้นที่ของฉัน” and “ดูพื้นที่ของฉัน”. An Imagegen-created transparent Bangkok canal illustration introduces the three topic chapters through native selectable buttons and a contextual anchor. The original generated artwork was optimized to a 353 KB WebP and is labeled as an illustration, separate from environmental readings. Existing white surfaces, Thai typography and topic colors remain, with matching dark-theme tokens.

Validation passes lint, the Next.js production build and TypeScript, the Cloudflare build, 174 unit tests and 32 rendered-page checks (206 total). Live browser checks cover actual TMD location results, area selection, hourly values, observed/nowcast switching, playback, opacity, interactive topic selection, light/dark themes, 390px mobile and 1280px desktop layouts without page overflow. A separate local fixture explicitly labeled as synthetic verifies positive alerts, dismissal, repeated-result suppression and re-enabling the watch; it is excluded from the production application. Reduced motion was reviewed in code, without a new browser preference-emulation pass. Captures are in `output/playwright/weather-home-final.png` and `output/playwright/rain-radar-final.png`.

## October 2, 2026 important-event briefing

The overview now starts with a current-period briefing before its illustrated introduction. It ranks source-classified road flooding, high/overflow and low water, source-reported orange/red PM2.5, selected-point TMD rain analysis and heat forecasts for the current interval. The current hour takes precedence over a broader heat window; daily maxima and future dates do not stand in for current conditions. Native topic links open the corresponding detail chapter. Five compact coverage rows keep unavailable, stale and unclassified inputs visible.

The selected public reference limits summary points to 8 km, while the unselected view follows the chosen province or metro scope. Summary and detail components share live resources on the overview without duplicate observation requests. In-page notifications are opt-in, update while the page is open, suppress unchanged timestamps and react to new categories, increasing counts in the highest category, greater severity, changed scope and recurrence after resolution. Dismissal and disabling clear pending notifications. No synthetic surveillance data, external notification delivery or deployment is added. The contract is in [docs/IMPORTANT_EVENTS_TH.md](docs/IMPORTANT_EVENTS_TH.md).

The design reuses white surfaces, semantic topic icons, rose attention tint, native controls and dark-theme tokens. Rows have a bounded hover transition and alerts receive a 200 ms transform reveal, both disabled for reduced motion. Radar camera changes are immediate so replacing an image during rapid area changes cannot leave an image subscribed to a queued zoom animation; actual radar frame playback remains available.

Validation passes lint, TypeScript, Next.js and Cloudflare builds, 181 unit tests and 32 rendered-page checks (213 total). Live browser inspection verifies source counts, opt-in alerts, dismissal without repeated-snapshot alerts, area scope, stable summary readings while tomorrow is selected, 1280px/1440px desktop and 390px mobile without page overflow, and light/dark themes. The radar zoom callback failure found during area switching was corrected and the rapid-switch regression in a fresh tab reports no console errors. Measured text contrast on the attention tint is 5.21–13.02:1. Captures are in `output/playwright/important-events-desktop-final.png` and `output/playwright/important-events-mobile-final.png`. Reduced motion was reviewed in code; no new screen-reader, browser preference-emulation or cross-browser pass is claimed.
