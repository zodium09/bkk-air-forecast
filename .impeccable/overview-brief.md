# Environmental overview surface brief

Confirmed journey: understand the overview, select a personal area, then open the detailed map. The home route / expresses the Public Environmental Briefing system; /air, /rain and /heat keep the detailed geographic tools.

The approved refinement uses a pure white canvas with saturated emerald, blue and orange topic accents, bright tinted daily panels and infographics. The first viewport pairs the daily briefing and place search with a real selected-day map preview. Source readiness and the Bangkok calendar date precede the headline. The map's topic-tinted header, colored top edge and subtle resting shadow establish it as an interactive geographic entry point.

Three daily scale panels present PM2.5, accumulated rain and peak heat index with units, written verdicts, actual source status and timestamps. Their segmented scales use the genuine metric legends; topic colors identify the feed and do not replace threshold interpretation. A missing value removes the scale marker, remains an em dash and keeps its unavailable explanation.

The personal-area section follows: select province and district, use a verified road search, or request a nearby reference point through geolocation. Then explore the seven-day proportional bar chart, capped source watch signals and source explanations. Chart, map and hero topic controls coordinate the environmental type. Selecting a day through a bar, previous/next button, map date or optional numeric table updates all three readings and the map; detailed routes preserve that day and the selected coordinate.

The chart's labeled daily bars use an axis that includes zero. Missing dates retain dashed explicit gaps, while true zero remains numeric. Mobile users can scroll the plot horizontally; selecting an offscreen date automatically brings it into view. Risk colors remain stable when a day is selected; an ink outline marks selection. Geometry updates without a height tween, and reduced motion changes automatic scrolling to instant. The three-topic numeric table is a native optional disclosure below the chart.

Use real daily readings only. Today remains missing when the PM model starts tomorrow; explain that boundary explicitly. A nearby geographic reference is not a sensor at the user's position. The watch list displays at most two source points per environmental type and never claims confirmed incidents or official warnings.

Implementation: app/components/intelligence/environment-overview.tsx, forecast-infographic.tsx, overview.css, map-workspace.tsx, briefing-workspace.css, and app/lib/environment-overview.ts. The overview adds no decorative generated imagery. Existing source, model, surveillance and advanced-route contracts in DESIGN.md remain authoritative.

The water extension uses the same white canvas and blue information palette. After the forecast chart, a dedicated current-observation section offers canal/river filters, a real station selector, measured water and bank comparison, source agency, reading time and location links. It inherits the selected province and prioritizes fresh stations near a selected public area reference. Water measurements do not change with the forecast date, and are never interpolated. Mobile shows three quick station choices plus the complete native selector; selecting a station brings its detail into view with reduced-motion support. The overview watch list uses accumulated daily rain, retaining probability as supplementary information on detailed tools. Data contracts are recorded in docs/WATER_DATA_SOURCES_TH.md.

## Risk and motion refinement

Keep the approved white canvas, Thai typography and colorful topic identity. Make forecast risk readable through four named planning levels, a segmented color key, and a date/area-specific on-page signal summary. Preserve real values, missing states and source limitations; these signals are not official warnings.

The authored motion moment is the measured water diagram: selecting a station reveals its actual level relative to the source bank and bed datum. The source capacity percentage remains a labeled measurement, never a flood probability. Use ThaiWater's published five capacity bands only on fresh data, with neutral unknown states otherwise. Station status colors are shared by the list, detail and diagram.

Motion budget: a bounded 650 ms water-fill reveal and one short surface sweep on station/data changes; no continuous loops, timers, canvas or added library. Forecast colors and selection controls use 150–220 ms feedback. Reduced motion keeps final geometry and color feedback with no spatial animation. The user can pause infographic motion on the page.

Finish: inspect desktop and mobile in one batch, fix findings together, then perform the required fresh finish review and preserve the incumbent design documentation.
