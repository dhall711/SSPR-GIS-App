# SSPR Trail Explorer

A mobile-first field maintenance tool with embedded GIS learning, built for South Suburban Parks and Recreation (SSPR) district field workers near Denver, Colorado.

**Live:** Deployed on Vercel

## What It Does

- **Report issues** from the field — snap a photo, AI auto-identifies the problem, GPS/EXIF auto-fills location
- **Manage work queue** with sorting by proximity, severity, or date; export to CSV/GeoJSON
- **Track issue lifecycle** from reported → assigned → in progress → resolved
- **Analyze patterns** with seasonal trends, priority zones, and weighted overlay analysis
- **Learn GIS fundamentals** through 12 interactive lessons tied to daily maintenance scenarios
- **Visualize data** with thematic maps, heatmaps, riparian buffers, and regional data overlays
- **AI Field Coach** (Claude) answers spatial questions, analyzes photos, and provides pattern analysis

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + PostGIS) |
| Mapping | React Leaflet v5, Leaflet |
| Spatial Analysis | Turf.js (client), PostGIS (server) |
| AI | Anthropic Claude (chat, vision, analysis) via `@anthropic-ai/sdk` |
| Heatmap | leaflet.heat |
| EXIF | exifr (photo GPS/timestamp extraction) |
| Markdown | react-markdown (AI chat formatting) |
| Hosting | Vercel |

## Features

### Maintenance System
- **Quick Report** — photo-first workflow: snap a photo, AI Vision identifies category/severity/description, EXIF extracts GPS coordinates and timestamp, all fields auto-populated
- **AI Photo Analysis** — Claude Vision analyzes maintenance photos and returns category, severity, title, description, safety risk, likely cause, recommended action, equipment needed, effort estimate, and environmental context
- **Work Queue** — sortable by proximity/severity/date, filterable by status/category, drilldown from analytics
- **Issue Detail** — full view with status workflow, field notes, map navigation
- **Data Export** — export filtered or full dataset as CSV (Excel/Sheets) or GeoJSON (QGIS/ArcGIS)

### Analytics & Decision Support
- **Stats Dashboard** — KPI cards, seasonal trend charts, monthly distribution, category × season heatmap
- **Interactive Drilldowns** — tap any KPI, status bar, severity bar, category bar, season card, or heatmap cell to filter the work queue
- **Priority Zones** — weighted overlay analysis combining issue density, waterway proximity, severity, and recurrence into maintenance priority zones
- **Adjustable Weights** — drag sliders to reweight the priority analysis for different scenarios (safety audit, spring flood prep, general budget request)

### Map & Spatial
- 5 basemaps (OSM, Topo, Satellite, Mapbox Outdoors, Mapbox Satellite HD)
- 11 overlay layers organized into three groups:
  - **SSPR Layers** — trails, parks, waterways, district boundary
  - **Maintenance** — issues, riparian buffers, disturbance heatmap, priority zones
  - **Regional Data** — regional parks (Denver + Arapahoe County), USGS hydrology (NHD)
- Live data from Supabase PostGIS with local JSON fallback
- External data lazy-loaded from Denver Open Data, Arapahoe County, and USGS APIs
- Turf.js nearest-waterway distance in maintenance popups
- Trail/park popups show nearby issue counts
- Map fly-to when selecting issues
- Riparian buffer visualization via PostGIS `ST_Buffer`

### External Data Integration (Phase 4)
- **Denver Open Data** — parks polygons via ArcGIS REST API (CC BY 3.0)
- **Arapahoe County Open Data** — parks & public spaces from ArcGIS Hub
- **USGS National Hydrography Dataset** — streams, rivers, canals with stream order, styled by type (perennial/intermittent/canal)

### GIS Learning
- **12 lessons** covering:
  1. Layers & Overlays
  2. Coordinates & Projections
  3. Points & Attributes
  4. Lines & Networks
  5. Polygons & Area Analysis
  6. Terrain & Slope
  7. Thematic Mapping & Visualization
  8. Buffer Analysis & Spatial Queries
  9. Heatmaps, Clustering & Seasonal Patterns
  10. GPS Data Collection Best Practices
  11. Weighted Overlay for Budget Requests
  12. Regional Data & Professional GIS Infrastructure
- Interactive exercises that manipulate the map
- Vocabulary, quizzes with scoring
- Progress tracking persisted to Supabase

### AI Integration
- **GIS Field Coach** — chat with conversation memory, markdown-formatted responses, contextual feature links
- **Photo Analysis** — Claude Vision analyzes maintenance issue photos and auto-populates report forms
- **Cluster Analysis** — pattern recognition endpoint for spatial/temporal trend identification
- **Field Tips** — contextual micro-lessons triggered by user actions (GPS capture, layer toggles, report submission)

### Mobile & UX
- Mobile-first layout with bottom navigation (Map, Report, Tasks, Stats, Learn)
- Desktop layout with header navigation (Report, Tasks, Stats, Field Coach) and collapsible lesson sidebar
- Safe area support for notch/Dynamic Island devices
- Home button resets entire app state to default view
- Touch targets ≥44px for field use with gloves

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
# Fill in your keys (see below)

# Run development server
npm run dev
```

### Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### Optional

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Server-side photo uploads
NEXT_PUBLIC_ARCGIS_API_KEY=AAPK...        # Premium basemaps
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...        # Mapbox basemaps
```

### Database Setup

1. Create a Supabase project with PostGIS extension enabled
2. Run `supabase/001_schema.sql` in the SQL Editor (creates tables, indexes, RLS, RPCs)
3. Run `node supabase/seed.mjs` to populate with SSPR trail/park/waterway data and simulated maintenance issues

## Project Structure

```
app/
  api/
    analyze-photo/  -- Claude Vision photo analysis
    chat/           -- AI Field Coach endpoint
    analyze/        -- AI cluster analysis endpoint
    external/       -- Denver/Arapahoe/USGS data proxy
    maintenance/    -- Issue CRUD (GET/POST/PATCH)
    spatial/        -- PostGIS GeoJSON + spatial query proxy
    progress/       -- Lesson progress persistence
    upload/         -- Photo upload to Supabase Storage
  page.tsx          -- Main app shell (responsive layout)

components/
  Map/              -- MapView, MapWrapper, BasemapSelector, LayerControl,
                       CoordinateDisplay, PriorityControl
  Layers/           -- TrailLayer, ParkLayer, WaterwayLayer, BoundaryLayer,
                       MaintenanceLayer, HeatmapLayer, BufferLayer,
                       RegionalParksLayer, NHDHydrologyLayer, PriorityZonesLayer
  Maintenance/      -- QuickReport, WorkQueue, IssueDetail, StatsPanel
  Lessons/          -- LessonPanel (concept, field, exercise, vocab, quiz tabs)
  ChatWidget, FieldTip, MobileNav

lib/
  types.ts               -- All TypeScript interfaces
  lessons.ts             -- 12 lesson definitions with full content
  mapConfig.ts           -- Map center, basemaps, colors, layer defaults
  supabase.ts            -- Supabase client singleton
  spatialService.ts      -- PostGIS RPC wrappers
  maintenanceService.ts  -- Maintenance issue CRUD
  externalDataService.ts -- Denver/Arapahoe/USGS API clients

data/
  geojson/        -- trails.json, parks.json, waterways.json, district_boundary.json
  seed/           -- maintenance-issues.json (75 simulated issues)

supabase/
  001_schema.sql              -- Complete PostGIS schema
  002_fix_rls_for_seed.sql    -- RLS insert policies
  003_fix_geometries.sql      -- Geometry fixes
  seed.mjs                    -- Node.js seed script
```

## Maintenance Categories

| Category | Description |
|----------|------------|
| Graffiti / Vandalism | Tagging, vandalism on structures |
| Snow / Ice | Accumulation, ice patches, freeze-thaw |
| Parking Lot | Potholes, drainage, striping, ADA |
| Erosion / Washout | Trail washout, bank erosion, drainage |
| Trail Surface | Cracking, root heave, ponding |
| Vegetation | Overgrowth, fallen trees, sight-lines |
| Signage | Damaged, missing, faded signs |
| Infrastructure | Benches, railings, bridges, fences |
| Trash / Dumping | Illegal dumping, overflowing bins |
| Safety Hazard | Broken glass, unstable ground, flooding |

## Build Phases

- **Phase 1** — MVP: Map layers, maintenance reporting, AI chat, lessons 1-8
- **Phase 2** — Field tools: Photo uploads, work queue, GPS, mobile nav
- **Phase 3** — Analytics: Seasonal trends, stats drilldowns, heatmaps, lessons 9-10
- **Phase 4** — Regional integration: Denver/Arapahoe/USGS data, weighted overlay priority analysis, lessons 11-12
- **Enhancements** — AI photo analysis, EXIF extraction, data export, desktop navigation parity, seasonal drilldowns

## License

Private — SSPR internal use.
