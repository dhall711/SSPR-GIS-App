# SSPR Trail Explorer

A mobile-first field maintenance tool with embedded GIS learning, built for South Suburban Parks and Recreation (SSPR) district field workers.

## What It Does

- **Report issues** from the field with GPS location, category, severity, and photos
- **Manage work queue** with sorting by proximity, severity, or date
- **Track issue lifecycle** from reported -> assigned -> in progress -> resolved
- **Learn GIS fundamentals** through 8 interactive lessons tied to daily maintenance scenarios
- **Visualize data** with thematic maps, heatmaps, and riparian buffer analysis
- **AI Field Coach** (Claude) answers spatial questions and provides pattern analysis

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + PostGIS) |
| Mapping | React Leaflet v5, Leaflet |
| Spatial Analysis | Turf.js (client), PostGIS (server) |
| AI | Anthropic Claude via `@anthropic-ai/sdk` |
| Heatmap | leaflet.heat |
| Hosting | Vercel |

## Features

### Maintenance System
- **Quick Report** -- mobile-optimized form with GPS capture, camera, category/severity pickers
- **Work Queue** -- sortable/filterable list with proximity calculation (Haversine)
- **Issue Detail** -- full view with status workflow, field notes, map navigation
- **Stats Dashboard** -- KPI cards, 7-day trend, breakdowns by status/severity/category

### Map & Spatial
- 5 basemaps (OSM, Topo, Satellite, Mapbox Outdoors, Mapbox Satellite HD)
- 8 overlay layers (trails, parks, waterways, boundary, issues, heatmap, riparian buffers)
- Live data from Supabase PostGIS with local JSON fallback
- Turf.js nearest-waterway distance in maintenance popups
- Trail/park popups show nearby issue counts
- Map fly-to when selecting issues
- Riparian buffer visualization via PostGIS `ST_Buffer`

### GIS Learning
- 8 lessons covering: layers, coordinates, points/attributes, lines/networks, polygons, terrain, thematic mapping, buffer analysis
- Interactive exercises that manipulate the map
- Vocabulary, quizzes with scoring, AI-generated reflection questions
- Progress tracking persisted to Supabase

### AI Integration
- GIS Field Coach chat with conversation memory
- Cluster analysis endpoint for pattern recognition
- Contextual field tips triggered by user actions

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

### Optional (for premium basemaps)

```
NEXT_PUBLIC_ARCGIS_API_KEY=AAPK...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

### Database Setup

1. Create a Supabase project
2. Run `supabase/001_schema.sql` in the SQL Editor (creates tables, indexes, RLS, RPCs)
3. Run `node supabase/seed.mjs` to populate with SSPR trail/park/waterway data and simulated maintenance issues

## Project Structure

```
app/
  api/
    chat/         -- AI Field Coach endpoint
    analyze/      -- AI cluster analysis endpoint
    maintenance/  -- Issue CRUD (GET/POST/PATCH)
    spatial/      -- PostGIS GeoJSON + spatial query proxy
    progress/     -- Lesson progress persistence
  page.tsx        -- Main app shell (mobile-first layout)

components/
  Map/            -- MapView, MapWrapper, BasemapSelector, LayerControl, CoordinateDisplay
  Layers/         -- TrailLayer, ParkLayer, WaterwayLayer, BoundaryLayer, MaintenanceLayer, HeatmapLayer, BufferLayer
  Maintenance/    -- QuickReport, WorkQueue, IssueDetail, StatsPanel
  Lessons/        -- LessonPanel (concept, field, exercise, vocab, quiz tabs)
  ChatWidget, FieldTip, MobileNav

lib/
  types.ts        -- All TypeScript interfaces
  lessons.ts      -- 8 lesson definitions with full content
  mapConfig.ts    -- Map center, basemaps, colors, severity colors
  supabase.ts     -- Supabase client singleton
  spatialService.ts -- PostGIS RPC wrappers + Supabase CRUD
  maintenanceService.ts -- In-memory issue service (API layer)

data/
  geojson/        -- trails.json, parks.json, waterways.json, district_boundary.json
  seed/           -- maintenance-issues.json (75 simulated issues)

supabase/
  001_schema.sql  -- Complete PostGIS schema
  002_fix_rls_for_seed.sql -- RLS insert policies for seeding
  seed.mjs        -- Node.js seed script
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

## License

Private -- SSPR internal use.
