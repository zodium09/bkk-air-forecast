# Bangkok environmental map workspace

The home page introduces current air observations and today's rain and heat forecasts. Each topic opens a full-screen map with a shared location inspector and forecast timeline. The default appearance is midnight navy, with teal for air, blue for rain, and amber for heat. A saved light-theme preference is respected across pages.

## Interaction and data

- `/air`, `/rain`, and `/heat` share a persistent Leaflet map. Changing a layer preserves the selected location and matching forecast day. Existing specialist tools remain at each route's `/advanced` page.
- IDW is the default forecast display for all three layers. Point forecasts and measured air observations remain separate modes. IDW uses at least three neighbors within 50 km, at most twelve neighbors, power 1.55 and 3.5 km smoothing. Only verified province/district polygons are filled; missing support remains transparent. Smooth display does not imply higher source resolution.
- Clicking an arbitrary supported position reads IDW at that coordinate. Clicking a source marker reads that source point. The inspector, timeline and time comparison use the same selected values. Probability differences are percentage points.
- Rain switches between probability and accumulated millimeters. Heat switches between heat index and air temperature. PM2.5 retains the source's daily cadence; rain and heat expose only their supplied daily and three-hour periods.
- The legend highlights both surface cells and points. The display menu controls point labels, satellite imagery, IDW opacity and weather motion.
- Weather motion is illustrative: ambient particles for air, falling strokes for rain, rising wisps for heat. It is clipped to geographic/data coverage, is not radar or an observed wind field, and does not animate missing values. Rain uses accumulated rainfall to avoid showing falling rain for a zero-rain cell. Motion stops during map movement, is throttled to about 30 fps, and respects reduced-motion settings and the user's toggle.
- At narrow widths the inspector becomes a three-level bottom sheet. Search expands on demand, leaving space for map exploration. Theme switching, source provenance, comparison and time navigation remain available at 375 px.
- Full-map exploration hides the surrounding panels without replacing the map. The expand control or Escape restores the workspace. Mobile map tools form three compact paired rows.
- Geographic labels use verified BMA/DMR feature names, with district names disclosed at closer zoom levels and collision avoidance. Display preferences are remembered locally; precise location is not stored in preference storage.

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

Unit coverage checks observation/model separation, true zero and unavailable values, temporal alignment, metric distinctions, year boundaries, polygon holes, bounded IDW, and raster sampling. Server-rendering checks cover the home page, all shared workspaces and preserved specialist tools. Browser checks exercise dark/light themes, spatial selection, stable map identity across layer and timeline changes, weather controls, reduced motion, mobile disclosure and upstream error recovery. QA captures are in the ignored `output/playwright/` directory.

Validated on September 6, 2026: 66 unit tests and 26 rendered-page checks pass; Next.js and Cloudflare builds pass; lint and TypeScript checks pass. Browser flows also verified opacity, legend emphasis, visible changing animation frames, URL restoration, measurement timestamps, geographic names, full-map exploration, saved display preferences, and 375 × 667 / 375 × 812 layouts. District boundaries use the existing BMA endpoint with a 20-second upstream timeout and verified snapshot fallback.
