# Environmental overview surface brief

Confirmed journey: understand the overview, select a personal area, then open the detailed map. The home route / expresses the Public Environmental Briefing system; /air, /rain and /heat keep the detailed geographic tools.

The approved refinement uses a pure white canvas with saturated emerald, blue and orange topic accents, bright tinted panels and infographics. The first viewport pairs place search with three topic anchors in reading order: rain and water, PM2.5, then heat. Source readiness and the Bangkok calendar date precede the headline.

Personal-area selection and the shared forecast date precede three complete, uninterrupted chapters. Rain and water contains the rain forecast, rain watch signals, rain map and provenance, followed by current road-flood observations and canal/river measurements. PM2.5 follows with current air observations, forecast, watch signals, map and provenance. Heat completes the page with its forecast, watch signals, map and provenance. Each forecast story carries its own exact date, cadence, unit, scope, advice and source time. PM2.5 retains its daily cadence and can name tomorrow while hourly rain and heat name today. Observation time never follows the forecast-date selector.

Select province and district, use a verified road search, or request a nearby reference through geolocation. The three stories inherit that geographic scope; the selector does not repeat numerical readings from different topics. Selecting a day or actual time updates readings and the active map; detailed routes preserve the date, hour and coordinate. Each chapter has its own map entry. Only one inline map is mounted at a time, inside its matching chapter, with no cross-topic layer tabs. From a daily chart, a visible button opens the finest available source cadence for that date. Hourly graphs keep accessible sample controls and scroll within their own plot on mobile.

PM2.5 uses seven-day proportional risk-colored bars. Rain switches between accumulation bars and probability lines on a fixed 0–100% scale. Heat compares heat-index and temperature lines on the same axis, with both readings available in the optional table. The rain chart follows 24 elapsed hours, including coarse source periods and midnight, without inventing slots. Daily totals and maxima use native disclosures only when the main chart is showing time detail. Missing values stay gaps; small nonzero values that would round to zero use a bound. Axes retain zero and source values are never interpolated for animation.

Use each feed's real cadence. Today remains missing when the selected PM date is unavailable. A nearby reference is not a sensor at the user's position. Hourly rain amounts do not use daily rain thresholds; raw temperature does not use heat-index risk bands. Rain day thresholds agree across reading, map and watch at >35 and >90 mm. The watch list displays at most two source points per environmental type and never claims confirmed incidents or official warnings.

Implementation: environment-overview.tsx, forecast-story.tsx, briefing-chart.tsx, topic-briefing.tsx, content-flow.css and app/lib/forecast-content.ts. Existing geographic, model, surveillance and advanced-route contracts in DESIGN.md remain authoritative. The overview adds no decorative generated imagery or animation dependency.

## Air and atmospheric explanation

The PM2.5 chapter now places a detailed atmospheric explanation after its daily forecast. It presents actual wind speed and circular mean direction, mixing height, accumulated rain and humidity from NOAA GFS through Open-Meteo, with daily/hourly graph controls and a real wind compass. Each selected date and geographic reference agrees with the air forecast. A regional center remains explicitly a point reference; a selected road uses a nearby model grid rather than claiming a street sensor.

The cold-wind section compares morning minimum temperature, mean sea-level pressure and the proportion of sufficiently strong northerly hours. The app's experimental rule requires all three signals together; missing evidence cannot become a reassuring verdict. Show source coverage, exact dates, actual grid and retrieval time. A local signal does not establish a Chinese cold-air outbreak or the official start of winter. Keep the TMD forecast link and the complete method disclosure.

Presentation takes the reference site's place-first summary and progressive evidence as its guide, inside the approved pure-white world. Fresh mint, blue, violet and orange distinguish atmospheric variables; the topic chapters retain their sequence. The measured compass has one 550 ms clip reveal and remains static under reduced motion. Graph lines preserve gaps; temperature and pressure disclose their expanded axes. Technical data and scientific sources are documented in docs/AIR_ATMOSPHERE_ANALYSIS_TH.md.

Water completes the rain-and-water chapter after road-flood observations, with canal/river filters, a complete station selector, measured water/bank comparison and actual archived history. Its counts and filters distinguish high/overflow from low/critical-low; stale or unassessable stations do not become safe readings. It inherits the province and ranks fresh stations near the selected reference. Selecting a station brings its detail into view with reduced-motion support. History names the actual first/last recorded timestamps and the archive's maximum retention separately. Data contracts remain in docs/WATER_DATA_SOURCES_TH.md.

## Risk and motion refinement

Keep the approved white canvas, Thai typography and colorful topic identity. Make forecast risk readable through four named planning levels, a segmented color key, and date/area-specific watch signals within each topic chapter. Preserve real values, missing states and source limitations; these signals are not official warnings.

The authored motion moment is the measured water diagram: selecting a station reveals its actual level relative to the source bank and bed datum. The source capacity percentage remains a labeled measurement, never a flood probability. Use ThaiWater's published five capacity bands only on fresh data, with neutral unknown states otherwise. Station status colors are shared by the list, detail and diagram.

Motion budget: one 650 ms graph reveal when the series changes, a 350 ms opacity update for exact readings, and the existing bounded water diagram reveal. No continuous loops or added library. Forecast selection controls retain short feedback. Reduced motion keeps final geometry with no reveal or animated scroll; the existing water pause control remains available.

Finish: inspect desktop and mobile in one batch, fix findings together, then perform the required fresh finish review and preserve the incumbent design documentation.
