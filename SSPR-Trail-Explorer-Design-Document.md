# SSPR Trail Explorer -- Design Requirements & Build Plan

**Project**: SSPR Maintenance Field Tool & GIS Learning Application
**Author**: dhall
**Created**: February 14, 2026
**Status**: Phase 1 MVP In Progress

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Target Audience](#2-target-audience)
3. [Design Philosophy](#3-design-philosophy)
4. [Technology Stack](#4-technology-stack)
5. [Architecture](#5-architecture)
6. [Data Sources](#6-data-sources)
7. [Supabase Database Schema](#7-supabase-database-schema)
8. [Map Layer System](#8-map-layer-system)
9. [AI Integration -- GIS Field Coach](#9-ai-integration----gis-field-coach)
10. [Lesson Curriculum (12 Lessons)](#10-lesson-curriculum-12-lessons)
11. [Project File Structure](#11-project-file-structure)
12. [UI/UX Design](#12-uiux-design)
13. [Phased Build Plan](#13-phased-build-plan)
14. [Reference Architecture -- Wine Catalog App](#14-reference-architecture----wine-catalog-app)
15. [Open Data Sources & APIs](#15-open-data-sources--apis)
16. [Prompts for Future Development](#16-prompts-for-future-development)

---

## 1. Project Vision

Build a web application that teaches foundational GIS concepts through hands-on ecological exploration of the South Suburban Parks and Recreation District (SSPR) in Denver, Colorado. The app uses real trail, park, and ecosystem data from a district that contains:

- **880 acres** of natural open space (South Platte Park)
- **300+ wildlife species** including 200+ bird species
- The **only unchannelized section of the South Platte River** in metro Denver
- **14 major trails** traversing multiple watersheds
- **174 parks and facilities** spanning three counties
- **Carson Nature Center** -- a professional ecological education facility

The field worker learns GIS not as abstract technology, but as the essential toolkit for understanding why maintenance problems recur where they do, and for making the case for smarter resource allocation.

---

## 2. Target Audience

**Primary user**: An SSPR Parks & Recreation maintenance field worker who responds to citizen requests for trail and facility maintenance.

**Assumptions about the user**:
- Responds daily to citizen requests: graffiti removal, snow/ice clearing, parking lot repair, water erosion fixes, trail surface issues, fallen trees, damaged signage, and safety hazards
- No prior GIS training but high spatial intuition -- knows the trail system by heart from daily work
- Primary device: smartphone in the field; occasionally desktop/tablet for end-of-day review
- Motivated by doing their job better and understanding *why* problems recur where they do
- Wants practical tools first, learning second -- but is genuinely curious about spatial patterns

**Learning approach**: Job-first, GIS-second. Every feature must help them do their job. GIS learning happens as a natural byproduct of using the tool well. When they log an erosion report near Bear Creek, the app can surface "Did you know? This is called a riparian zone -- buffer analysis explains why erosion clusters here."

---

## 3. Design Philosophy

### Core Principles

1. **Job-first, GIS-second**: Every feature must help the field worker do their job. GIS learning happens as a byproduct of using the tool effectively. Maintenance reporting, work queue management, and route planning are primary; GIS lessons are integrated, not bolted on.

2. **Real data, real place**: All exercises use authentic SSPR spatial data. The user walks these trails every day and can immediately verify what they see on the map against what they observe in the field.

3. **Mobile-first**: Thumb-reachable controls, GPS-located actions, camera integration, offline awareness. The app must be usable one-handed while standing on a muddy trail next to an erosion washout.

4. **Field context triggers learning**: When the user performs maintenance actions, the app surfaces contextual GIS micro-lessons ("Field Tips"). Logging an erosion report near a creek teaches riparian buffers. Toggling layers teaches spatial analysis. The user's daily work IS GIS data collection.

5. **Maintenance as spatial data**: Every work order completed becomes a data point. Over time, patterns emerge that teach spatial analysis organically. The user's maintenance history becomes a heatmap, a seasonal trend chart, and a budget justification tool.

---

## 4. Technology Stack

This project mirrors the architecture of the existing wine catalog app at `/Users/dhall/Desktop/wine catalog/wine-catalog-app/`, adapted for GIS functionality.

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 16 (App Router) | Proven pattern from wine catalog; server components + API routes |
| Hosting | Vercel | Zero-config deployment for Next.js |
| Database | Supabase (Postgres + PostGIS) | PostGIS provides production-grade spatial queries; Supabase client pattern matches wine app |
| AI | Claude via `@anthropic-ai/sdk` | Same integration pattern as wine sommelier, repurposed as GIS Lab TA |
| Mapping | React Leaflet v5 | Most widely-used open-source web mapping library |
| Spatial (client) | Turf.js | Client-side spatial analysis (measurements, buffers, intersections) |
| Spatial (server) | PostGIS | Server-side spatial queries via Supabase RPCs |
| Styling | Tailwind CSS | Same as wine catalog, with ecological color palette |
| Basemaps | OSM, ArcGIS World Topo, Esri Satellite | Free tile services covering terrain, imagery, and street context |

### Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.74.0",
  "@supabase/supabase-js": "^2.95.3",
  "@turf/turf": "^7.3.4",
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0",
  "@types/leaflet": "^1.9.0",
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "typescript": "^5"
}
```

> **Note**: The project uses Tailwind v4 (CSS-based `@theme` config in globals.css) rather than the Tailwind v3 JS config mentioned in some sections. Next.js 16 + React 19 are used instead of the originally planned Next.js 15 + React 18.

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 5. Architecture

### High-Level Data Flow

```
[Browser]
  |-- React Leaflet MapView (dynamic import, ssr: false)
  |     |-- Tile layers from OSM / ArcGIS / Esri
  |     |-- GeoJSON overlay layers from Supabase PostGIS
  |     |-- Client-side spatial analysis via Turf.js
  |
  |-- LessonPanel sidebar
  |     |-- Lesson content (static JSON definitions)
  |     |-- Progress tracking via Supabase lesson_progress table
  |
  |-- ChatWidget (AI Lab TA)
  |     |-- POST /api/chat
  |           |-- Anthropic SDK -> Claude
  |           |-- System prompt includes SSPR feature context + current lesson
  |           |-- Returns text with [[Feature Name|id]] clickable references
  |
  |-- Maintenance Issue Forms
        |-- POST /api/maintenance
        |-- Supabase PostGIS (GEOGRAPHY point + attributes)
        |-- Photo upload to Supabase Storage
```

### Key Technical Decisions

1. **React Leaflet requires `ssr: false`**: Leaflet depends on browser `window` object. A `MapWrapper.tsx` component uses Next.js `dynamic()` import to load the map client-side only.

2. **PostGIS over client-side spatial**: While Turf.js handles simple measurements, all significant spatial queries (buffers, intersections, nearest neighbor) run server-side in PostGIS via Supabase `.rpc()` calls. This teaches the student that real GIS systems use spatial databases.

3. **GeoJSON as interchange format**: All spatial data moves between Supabase and the frontend as GeoJSON FeatureCollections. PostGIS functions like `ST_AsGeoJSON()` produce this format natively.

4. **Supabase client singleton**: Follows the exact pattern from the wine catalog's `lib/supabase.ts`.

---

## 6. Data Sources

### Primary: SSPR District Map (PDF)

Source: `/Users/dhall/Downloads/DistrictMap.pdf` (Published August 18, 2025)

Extracted data:
- 14 named major trails with lengths and grid references
- 174 numbered parks, open spaces, and facilities with grid references and categories
- Trail network connections and mileage markers
- Municipal and county boundaries
- Waterway network (South Platte River, Big Dry Creek, Little Dry Creek, Bear Creek, Dutch Creek, Marcy Gulch, High Line Canal)
- District boundary polygon
- Reservoir locations (Chatfield, McLellan, South Platte Park, Cooley Lake, Ketring Lake, Marston Lake, Bowles Lake, Centennial Lake)

### Major Trails (from PDF)

| Letter | Trail Name | Length | Grid |
|--------|-----------|--------|------|
| A | Bear Creek Trail | 1.6 mi | E-1 to F-1 |
| B | Big Dry Creek Trail (North) | 2.5 mi | F-3 |
| C | Big Dry Creek Trail (South) | 2.1 mi | I-5 |
| D | Centennial Link Trail | 5.7 mi | K-4 to G-5 |
| E | Columbine Trail | 2.6 mi | D-6 |
| F | Cook Creek Regional Trail | 1.9 mi | L-9 to L-8 |
| G | Happy Canyon Regional Trail | 1.9 mi | M-10 |
| H | High Line Canal Trail | 9.0 mi | G-7 |
| I | Lee Gulch Trail | 4.6 mi | E-5 to H-6 |
| J | Little Dry Creek Trail | 2.4 mi | J-5 |
| K | Littleton Community Trail | 2.7 mi | F-5 to F-3 |
| L | Mary Carter Greenway Trail | 8.5 mi | E-7 |
| M | Railroad Spur / Mineral Ave Trail | 2.5 mi | D-6 to F-6 |
| N | Willow Creek Trail | 7.0 mi | K-5 |

### Ecological Context (Real)

- **South Platte Park**: 880 acres, 300+ wildlife species, only unchannelized South Platte in Denver metro. Five fishable lakes. 4-5 mi natural surface trails + 2.5 mi paved Greenway.
- **Carson Nature Center**: Professional ecological education (NAI-certified staff). Live animal exhibits, interactive River Table recreating 1965 flood. School field trips, family programs.
- **Bear Creek corridor**: Active trail study by SSPR + City of Sheridan + Arapahoe County Open Spaces (Lowell Blvd to South Platte River/Mary Carter Greenway).
- **South Platte River**: Part of EPA's Urban Waters Federal Partnership. Active riparian restoration, habitat restoration, wildfire risk reduction, sediment load reduction.
- **High Line Canal**: Historic 71-mile irrigation canal, now a recreational trail and critical urban wildlife corridor.
- **Chatfield State Recreation Area**: Major ecological area at district edge; adjacent to Chatfield Reservoir.

### External Data (Phase 4)

- **Denver Open Data**: Parks polygons via REST API (`denvergov.org/opendata`) -- CC BY 3.0
- **Arapahoe County Open Data**: Trails and open space layers (`arapahoe-open-data-arapahoegov.hub.arcgis.com`)
- **Denver Geospatial Hub**: (`opendata-geospatialdenver.hub.arcgis.com`)
- **ArcGIS World Topographic Map**: Basemap tile service (item `6d2e47ca47774d4ab28443fa90a157dd`)
- **USGS National Map**: Elevation contours and hydrology (NHD)
- **National Land Cover Database (NLCD)**: Land use/land cover classification
- **OpenStreetMap**: Additional trail data via Overpass API

---

## 7. Supabase Database Schema

### Enable PostGIS

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### trails

```sql
CREATE TABLE trails (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  letter_code CHAR(1),
  length_miles NUMERIC,
  surface TEXT,
  difficulty TEXT,
  grid_start TEXT,
  grid_end TEXT,
  watershed TEXT,
  riparian_proximity TEXT,
  habitat_corridor BOOLEAN DEFAULT FALSE,
  description TEXT,
  geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX trails_geo_idx ON trails USING GIST (geometry);
```

### parks

```sql
CREATE TABLE parks (
  id TEXT PRIMARY KEY,
  map_number INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  -- Categories: park, open_space, rec_center, pool, tennis, golf,
  -- trailhead, garden, dog_park, school_park, nature_center,
  -- fishing, sports_complex, batting_cages, bmx, pickleball
  ecological_class TEXT,
  -- Ecological: natural_area, riparian, wetland, upland, urban_green, built
  amenities TEXT[],
  grid_ref TEXT,
  area_acres NUMERIC,
  description TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX parks_location_idx ON parks USING GIST (location);
CREATE INDEX parks_boundary_idx ON parks USING GIST (boundary);
```

### waterways

```sql
CREATE TABLE waterways (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,           -- river, creek, canal, reservoir, lake, gulch
  stream_order INTEGER,
  watershed TEXT,
  geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX waterways_geo_idx ON waterways USING GIST (geometry);
```

### boundaries

```sql
CREATE TABLE boundaries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,           -- district, municipal, county
  geometry GEOGRAPHY(POLYGON, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX boundaries_geo_idx ON boundaries USING GIST (geometry);
```

### maintenance_issues

```sql
CREATE TABLE maintenance_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  trail_id TEXT REFERENCES trails(id),
  park_id TEXT REFERENCES parks(id),
  category TEXT NOT NULL,
  -- graffiti, snow_ice, parking_lot, erosion, trail_surface,
  -- vegetation, signage, infrastructure, trash_dumping, safety
  severity TEXT NOT NULL,        -- low, medium, high, critical
  status TEXT DEFAULT 'reported', -- reported, assigned, in_progress, resolved
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  assigned_to TEXT,
  reporter TEXT,
  source TEXT DEFAULT 'citizen',  -- citizen, field_entry, simulated, ai_suggested
  field_notes TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX issues_location_idx ON maintenance_issues USING GIST (location);
CREATE INDEX issues_status_idx ON maintenance_issues (status);
CREATE INDEX issues_severity_idx ON maintenance_issues (severity);
CREATE INDEX issues_category_idx ON maintenance_issues (category);
```

### lesson_progress

```sql
CREATE TABLE lesson_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id INTEGER NOT NULL UNIQUE,
  status TEXT DEFAULT 'not_started',  -- not_started, in_progress, completed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  quiz_score INTEGER,
  quiz_total INTEGER,
  exercise_completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### PostGIS RPC Functions

```sql
-- Find parks within radius of a point (meters)
CREATE OR REPLACE FUNCTION nearby_parks(lat FLOAT, lng FLOAT, radius_meters FLOAT)
RETURNS SETOF parks AS $$
  SELECT * FROM parks
  WHERE ST_DWithin(location, ST_Point(lng, lat)::geography, radius_meters);
$$ LANGUAGE sql;

-- Create riparian buffer around a waterway
CREATE OR REPLACE FUNCTION riparian_buffer(target_waterway_id TEXT, buffer_meters FLOAT)
RETURNS JSON AS $$
  SELECT ST_AsGeoJSON(ST_Buffer(geometry::geometry, buffer_meters / 111320.0))::json
  FROM waterways WHERE id = target_waterway_id;
$$ LANGUAGE sql;

-- Find maintenance issues near a trail
CREATE OR REPLACE FUNCTION issues_near_trail(target_trail_id TEXT, buffer_meters FLOAT)
RETURNS SETOF maintenance_issues AS $$
  SELECT mi.* FROM maintenance_issues mi
  JOIN trails t ON t.id = target_trail_id
  WHERE ST_DWithin(mi.location, t.geometry, buffer_meters);
$$ LANGUAGE sql;

-- Return all trails as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION trails_geojson()
RETURNS JSON AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(geometry)::json,
        'properties', json_build_object(
          'id', id, 'name', name, 'letter_code', letter_code,
          'length_miles', length_miles, 'surface', surface,
          'difficulty', difficulty, 'watershed', watershed
        )
      )
    ), '[]'::json)
  ) FROM trails;
$$ LANGUAGE sql;

-- Return all parks as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION parks_geojson()
RETURNS JSON AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(location)::json,
        'properties', json_build_object(
          'id', id, 'name', name, 'map_number', map_number,
          'category', category, 'ecological_class', ecological_class,
          'grid_ref', grid_ref, 'area_acres', area_acres
        )
      )
    ), '[]'::json)
  ) FROM parks;
$$ LANGUAGE sql;

-- Find all features within a drawn polygon
CREATE OR REPLACE FUNCTION features_in_polygon(geojson_polygon TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'parks', (SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
              FROM parks p
              WHERE ST_Within(p.location::geometry,
                    ST_GeomFromGeoJSON(geojson_polygon))),
    'trails_count', (SELECT COUNT(*)
              FROM trails t
              WHERE ST_Intersects(t.geometry::geometry,
                    ST_GeomFromGeoJSON(geojson_polygon)))
  );
$$ LANGUAGE sql;
```

---

## 8. Map Layer System

### Basemaps (radio toggle -- one active at a time)

| Basemap | Source | Best For | Auth |
|---------|--------|----------|------|
| OpenStreetMap | OSM | Street context, facility labels | None |
| ArcGIS World Topo | ArcGIS (dhall711) | Topographic contours, terrain analysis | API key |
| Esri World Imagery | ArcGIS (dhall711) | Satellite/aerial vegetation analysis | API key |
| Mapbox Outdoors | Mapbox (dhall711) | Trail-focused terrain with hillshade | Token |
| Mapbox Satellite Streets | Mapbox (dhall711) | High-res satellite with road labels | Token |

### Overlay Layers (checkbox toggle -- multiple active)

| Layer | Geometry | Styling | Lesson Relevance |
|-------|----------|---------|-----------------|
| District Boundary | Polygon | Semi-transparent green fill, dashed border | L1, L5 |
| Trail Network | LineString | Color-coded by trail name, labeled | L4, L7 |
| Parks & Facilities | Point | Category icons (nature, water, built) | L3, L7 |
| Waterways | LineString | Blue, width weighted by stream order | L4, L8 |
| Municipal Boundaries | Polygon | Dashed gray outlines | L5 |
| Maintenance Issues | Point | Severity-colored circles (green/yellow/orange/red) | L9, L10 |
| Riparian Buffers | Polygon | Semi-transparent teal, generated dynamically | L8 |
| Disturbance Heatmap | Raster-like | Gradient heat visualization | L9 |

---

## 9. AI Integration -- GIS Field Coach

### Persona

The AI acts as a **GIS Field Coach** -- a knowledgeable senior colleague who understands both GIS fundamentals and maintenance operations. It talks like a coworker, not a professor. When the user describes field situations ("the trail is washed out near the creek"), the Coach translates to GIS terminology and explains why the spatial concepts matter for their work.

This replaces the "Wine Sommelier" from the wine catalog app with identical technical implementation but different system prompt and persona.

### API Route Pattern

File: `app/api/chat/route.ts`

Identical pattern to the wine catalog:
1. Receives `{ message, messages (conversation history), mapContext }` via POST
2. Builds system prompt with SSPR feature data + current lesson + maintenance context
3. Calls Claude via `@anthropic-ai/sdk`
4. Parses `[[Feature Name|feature-id]]` references from response
5. Returns `{ reply, featureReferences }` -- references become clickable links that highlight features on the map

### System Prompt Template

```
You are a GIS Field Coach -- a knowledgeable senior colleague helping an SSPR
maintenance field worker learn GIS foundations through their daily job.

Your user:
- Works for SSPR responding to citizen maintenance requests: graffiti, snow/ice,
  parking lot repair, erosion fixes, trail surface, vegetation, signage, infrastructure
- Uses a mobile device in the field
- Has no prior GIS training but knows the trail system intimately
- Wants to understand GIS because it helps them do their job better

You have expertise in:
- GIS fundamentals (coordinate systems, spatial analysis, field data collection)
- Maintenance operations (work order management, resource allocation, seasonal patterns)
- Environmental context (watershed hydrology, erosion mechanics, freeze-thaw cycles)

{trails_context}
{parks_context}
{waterways_context}
{maintenance_issues_context}

Current lesson: {lesson_number} - {lesson_title}
Active map layers: {visible_layers}
Selected feature: {selected_feature}

Communication style:
- Talk like a senior colleague, not a professor. Plain language first, then GIS terms.
- Translate field language to GIS terminology and explain why terminology matters
- Give practical advice connecting GIS concepts to daily maintenance work
- Format feature references as [[Display Name|feature-id]] for map highlighting
- After answering, suggest a practical "Field Tip" they can apply on their next call
- Keep responses concise -- they're reading on a phone in the field
```

### AI-Enhanced Features

| Feature | Description | Lesson Connection |
|---------|------------|-------------------|
| Lesson Companion | Context-aware explanations based on maintenance actions and map interactions | All lessons |
| "Field Tip" | AI suggests practical GIS insight applicable to the user's next work call | All lessons |
| Natural Language Spatial Query | "Show me erosion reports near waterways" translates to PostGIS query + map highlight | L8, L11 |
| Field-to-GIS Translator | User describes field situation, Coach translates to GIS terminology | All lessons |
| Pattern Spotter | AI identifies maintenance patterns in the user's data ("erosion clusters near creeks in spring") | L9 |
| Work Context | References the user's actual maintenance data and seasonal trends | All lessons |

---

## 10. Lesson Curriculum (12 Lessons)

### Structure per Lesson

Each lesson contains five sections, rendered as distinct UI tabs in the LessonPanel sidebar:

1. **GIS Tab** -- GIS concept explanation (what and why)
2. **Field Tab** -- "Why This Matters for Your Job" (connecting GIS to maintenance work)
3. **Exercise Tab** -- Step-by-step hands-on map exercise (3-6 numbered steps with map actions)
4. **Vocab Tab** -- 6-8 key terms with concise definitions
5. **Quiz Tab** -- 3 multiple choice questions testing both GIS understanding and field application

After the quiz, the AI Field Coach generates a **ThinkPrompt** -- a discussion question encouraging deeper spatial reasoning about their work.

### Lesson Details

#### Lesson 1: GIS as Your Field Toolkit

- **GIS**: Layers, features, attributes, spatial data, spatial analysis
- **Field**: Layers = different views of your work area. Toggle trails vs. maintenance reports vs. waterways to see where problems cluster. Your daily observations are spatial data.
- **Exercise**: Toggle all SSPR layers on/off. Turn off trails to see what information disappears. View waterways only, then add trails to see intersection zones where erosion concentrates.
- **Vocabulary**: GIS, layer, feature, attribute, spatial data, spatial analysis

#### Lesson 2: Finding the Problem -- Coordinates, GPS & Navigation

- **GIS**: Coordinate systems, WGS84, GPS, location accuracy
- **Field**: Coordinates turn vague citizen reports ("somewhere on the trail") into navigable locations. Your phone's GPS captures coordinates automatically when you file reports.
- **Exercise**: Move mouse across map watching coordinate display. Navigate to Carson Nature Center by coordinates. Compare coordinates across the district. Discuss GPS precision for maintenance reporting.
- **Vocabulary**: CRS, WGS84, latitude, longitude, GPS, location accuracy

#### Lesson 3: Logging What You Find -- Points, Attributes & Reporting

- **GIS**: Point geometry, attribute tables, classification, symbology, data quality
- **Field**: Every maintenance report is a point feature with attributes (GPS location, category, severity, description, photo, date, reporter). Standardized classification enables analysis. Your reports are the data.
- **Exercise**: Explore SSPR parks as point features. Inspect attributes via popups. Compare different categories. Understand how classification by type (graffiti, erosion, snow) enables filtering, counting, and pattern analysis.
- **Vocabulary**: Point feature, attribute table, classification, symbology, data quality, standardized classification

#### Lesson 4: Following the Trail -- Lines, Distances & Networks

- **GIS**: Polylines, distance measurement, network connectivity, linear referencing, watershed
- **Field**: Trail lines are your daily workspace. "0.3 miles south of the trailhead" is linear referencing. Trail-waterway crossings are highest-risk zones for post-storm damage. Waterway networks predict your workload.
- **Exercise**: View trails and waterways together. Trace the South Platte River and identify confluences. Find the Mary Carter Greenway running alongside the river. Identify trail-waterway crossings as priority inspection points.
- **Vocabulary**: Polyline, linear referencing, network, connectivity, confluence, trail segment, watershed

#### Lesson 5: Zones and Boundaries -- Polygons & Jurisdiction

- **GIS**: Polygon geometry, area/perimeter calculation, spatial containment, overlay
- **Field**: Park polygons define your responsibility. "Is this pothole in our jurisdiction or the county's?" Polygon containment queries answer that. Larger parks require more maintenance resources per acre of edge.
- **Exercise**: Examine park boundary polygons. Calculate areas. Compare South Platte Park (880 acres) to pocket parks. Identify which polygons border municipal boundaries (jurisdiction questions).
- **Vocabulary**: Polygon, area, perimeter, spatial containment, jurisdiction, overlay

#### Lesson 6: Reading the Terrain -- Raster Data, Slope & Aspect

- **GIS**: Raster vs. vector, basemap tiles, DEM, slope, aspect
- **Field**: Slope predicts erosion. North-facing aspects hold snow longer. Satellite imagery shows conditions you can't see from the trail. Switching basemaps gives you different field intelligence.
- **Exercise**: Switch basemaps (topo vs. satellite). Observe how terrain drives drainage. Note north-facing slopes where snow/ice persists. Identify steep areas prone to erosion.
- **Vocabulary**: Raster, DEM, resolution, slope, aspect, contour, drainage

#### Lesson 7: Making Sense of Your Data -- Styling & Visualization

- **GIS**: Thematic mapping, graduated symbols, categorical colors, legend design
- **Field**: Style maintenance reports by severity (red=urgent) or category (blue=water, orange=surface). A well-styled map tells your supervisor the story in 5 seconds. Visual hierarchy determines what gets attention.
- **Exercise**: View maintenance issues color-coded by severity. Switch to category-based styling. Create a map view that communicates "where we need resources" at a glance.
- **Vocabulary**: Thematic map, graduated symbol, categorical symbol, legend, visual hierarchy, choropleth

#### Lesson 8: Finding Root Causes -- Buffer Analysis & Spatial Queries

- **GIS**: Buffer analysis, spatial queries (within, intersects, contains), proximity
- **Field**: Erosion clusters within 50m of waterways. Graffiti clusters within 200m of parking lots. Buffer analysis reveals these spatial patterns. Understanding root causes = smarter resource allocation.
- **Exercise**: Create riparian buffers around waterways. Query which maintenance issues fall within buffers. Identify infrastructure near waterways that needs extra attention. Discover spatial patterns in issue distribution.
- **Vocabulary**: Buffer, riparian zone, spatial query, proximity, setback, buffer analysis

#### Lesson 9: Spotting Trends -- Heatmaps, Clustering & Seasonal Patterns

- **GIS**: Heatmaps, point density, clustering, kernel density estimation, temporal analysis
- **Field**: Your maintenance history as a heatmap. Seasonal patterns. "We always get erosion reports on Bear Creek in April" -- now you can prove it with data. Cluster analysis finds problem zones.
- **Exercise**: View maintenance issues as a heatmap. Identify disturbance clusters. Overlay with waterways to understand spatial drivers. Discuss seasonal patterns (snow in winter, erosion in spring, graffiti year-round).
- **Vocabulary**: Hotspot, kernel density, cluster, spatial pattern, temporal analysis, seasonal trend

#### Lesson 10: Your Phone is a GIS -- GPS Data Collection Best Practices

- **GIS**: GPS-based data collection, attribute forms, data quality, metadata, QA/QC
- **Field**: GPS data collection best practices. Photo documentation. Standardized forms. Your daily work generates valuable spatial data. Good data quality = better analysis = better budget decisions.
- **Exercise**: Report a maintenance issue using the QuickReport form. Use GPS to auto-locate. Fill standardized attributes. Take a photo. Discuss what makes a high-quality field report vs. a useless one.
- **Vocabulary**: Field survey, GPS waypoint, metadata, data quality, QA/QC, standardized form

#### Lesson 11: Making the Case -- Overlay Analysis for Budget Requests

- **GIS**: Multi-criteria analysis, weighted overlay, suitability modeling, decision support
- **Field**: Overlay analysis for budget requests. "Here's where we need resources and here's the spatial data that proves it." Combine issue density + waterway proximity + trail usage into priority maps.
- **Exercise**: Combine maintenance issue density + waterway proximity + trail length into a weighted overlay. Generate a maintenance priority map. Identify the top 5 areas needing investment and explain why using spatial evidence.
- **Vocabulary**: Multi-criteria analysis, weighted overlay, suitability model, decision support, priority mapping

#### Lesson 12: The Bigger Picture -- Regional Data & Infrastructure Management

- **GIS**: WFS/WMS services, REST APIs, data interoperability, metadata standards
- **Field**: County GIS data, USGS hydrology, weather overlays. Your maintenance data connects to regional infrastructure management. Professional GIS systems combine many data sources.
- **Exercise**: Pull Denver Open Data into the map. Overlay USGS hydrology. Discuss how your maintenance data fits into the broader regional GIS infrastructure. Explore metadata -- provenance and limitations.
- **Vocabulary**: WFS, WMS, metadata, interoperability, data provenance, open data

---

## 11. Project File Structure

```
sspr-trail-explorer/
  app/
    page.tsx                       # Main app (lesson sidebar + map + chat)
    layout.tsx                     # Root layout with metadata
    globals.css                    # Tailwind + ecological theme
    api/
      chat/route.ts                # Claude GIS Lab TA
      spatial/route.ts             # PostGIS spatial query proxy
      maintenance/route.ts         # Issue CRUD
  components/
    Map/
      MapView.tsx                  # Leaflet map (client component)
      MapWrapper.tsx               # next/dynamic wrapper (ssr: false)
      BasemapSelector.tsx          # OSM / Topo / Satellite toggle
      LayerControl.tsx             # Overlay layer toggles
      FeaturePopup.tsx             # Click-to-inspect with ecological context
    Layers/
      TrailLayer.tsx               # Trail polylines (color-coded)
      ParkLayer.tsx                # Park markers (category icons)
      WaterwayLayer.tsx            # Streams/rivers/canals (blue, weighted)
      BoundaryLayer.tsx            # District + municipal boundaries
      MaintenanceLayer.tsx         # Issue markers (severity colors)
      BufferLayer.tsx              # Dynamic riparian buffer polygons
      HeatmapLayer.tsx             # Disturbance density heatmap
    Lessons/
      LessonPanel.tsx              # Sidebar: lesson content + progress
      LessonNav.tsx                # Lesson list with completion status
      ConceptCard.tsx              # "GIS Concept" explanation block
      EcologyCard.tsx              # "Why This Matters for Ecology" block
      ExercisePrompt.tsx           # Step-by-step hands-on exercise
      VocabularyList.tsx           # Key terms with definitions
      QuizCheckpoint.tsx           # Knowledge check questions
      ThinkPrompt.tsx              # AI-generated ecological thinking prompt
    Maintenance/
      IssueForm.tsx                # Report issue (GPS + photo + form)
      IssueDetail.tsx              # View issue with ecological context
      IssueFilter.tsx              # Filter by category/severity/status
    ChatWidget.tsx                 # AI Lab TA chat panel
    FilterSidebar.tsx              # Layer controls + spatial filters
  lib/
    supabase.ts                    # Supabase client singleton
    types.ts                       # TypeScript type definitions
    trailService.ts                # Trail CRUD via Supabase
    parkService.ts                 # Park CRUD via Supabase
    maintenanceService.ts          # Maintenance issue service
    lessonService.ts               # Lesson progress tracking
    spatialService.ts              # PostGIS RPC wrappers
    lessons.ts                     # 12 lesson content definitions
  data/
    geojson/                       # Seed GeoJSON files
      trails.geojson
      parks.geojson
      waterways.geojson
      district_boundary.geojson
      municipal_boundaries.geojson
    seed/
      maintenance-issues.json      # Simulated ecological disturbance data
      lesson-content.json          # Lesson definitions (if not in lessons.ts)
  public/
    markers/                       # Custom map marker icons by category
    logo.png                       # App logo
  .env.local                       # Environment variables
  package.json
  tailwind.config.js
  next.config.js
  tsconfig.json
```

---

## 12. UI/UX Design

### Color Palette (Tailwind theme)

```javascript
colors: {
  'trail-green': '#2d6a4f',       // Primary actions, headers
  'trail-green-dark': '#1b4332',  // Hover states, sidebar background
  'trail-gold': '#d4a373',        // Accent, progress indicators
  'trail-earth': '#6b4226',       // Secondary text
  'trail-water': '#219ebc',       // Water features, links
  'eco-riparian': '#52b788',      // Riparian zone highlights
  'severity-low': '#4ade80',      // Green
  'severity-medium': '#facc15',   // Yellow
  'severity-high': '#fb923c',     // Orange
  'severity-critical': '#ef4444', // Red
}
```

### Layout

The layout adapts between desktop and mobile to support both office review and field use.

**Desktop (md+ breakpoint):**
1. **Left Sidebar** (collapsible): LessonPanel with lesson navigation, current lesson content, progress tracker. During free exploration, this becomes the layer/filter controls.
2. **Center**: Full-width interactive map (React Leaflet)
3. **Bottom-right floating**: AI Field Coach ChatWidget (expandable panel)

**Mobile (field use):**
1. **Bottom Navigation Bar** with 4 tabs: **Map** / **Report** / **Tasks** / **Learn**
   - **Map tab**: Full-screen map with floating controls (layer toggles, basemap selector)
   - **Report tab**: QuickReport form -- GPS auto-locate, category picker (big tap targets), severity, photo capture, notes
   - **Tasks tab**: WorkQueue -- open maintenance issues sorted by proximity to current location
   - **Learn tab**: LessonPanel content adapted for mobile vertical scroll
2. All interactive elements are minimum **44x44px** for field use with gloves
3. AI Field Coach ChatWidget accessible from all tabs via floating button

### Mobile-First Design Principles

- **Thumb-reachable controls**: Primary actions in the bottom 40% of the screen
- **GPS auto-fill**: Location is captured automatically when creating reports
- **Camera integration**: Photo capture directly from the Report form
- **Large tap targets**: Minimum 44x44px for all buttons and controls (field use with gloves)
- **High contrast**: Text and icons readable in direct sunlight
- **Offline awareness**: Clear indicators when connectivity is limited (future enhancement)

---

## 13. Phased Build Plan

### Phase 1: Foundation + Maintenance Core (MVP)

**Goal**: Working map with SSPR data, AI Field Coach, maintenance reporting, work queue, mobile navigation, and first 4 lessons with field-framed curriculum.

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Scaffold Next.js 16 project with Tailwind v4, Supabase client, Anthropic SDK, React Leaflet | Done |
| 1.2 | Create Supabase project, enable PostGIS, run schema SQL for all tables | Pending |
| 1.3 | Create GeoJSON seed data for 14 trails, 174 parks, waterways, and district boundary | Done (174/174 parks) |
| 1.4 | Import seed data into Supabase PostGIS tables | Pending |
| 1.5 | Build MapView component (dynamic import, ssr: false) with 5 basemap options | Done |
| 1.6 | Build overlay layers: TrailLayer (with labels), ParkLayer, WaterwayLayer, BoundaryLayer | Done |
| 1.7 | Build FeaturePopup for click-to-inspect with attribute display | Done (inline in layers) |
| 1.8 | Build AI Field Coach chat (/api/chat route + ChatWidget) with maintenance-focused persona | Done |
| 1.9 | Build LessonPanel framework (sidebar, exercise map actions, ThinkPrompt, quiz) | Done |
| 1.10 | Implement Lessons 1-4 with maintenance-framed curriculum and field exercises | Done |
| 1.11 | Rewrite types, lessons, and AI prompt for field worker persona | Done |
| 1.12 | Create 75 simulated maintenance issue seed data (graffiti, snow, erosion, etc.) | Done |
| 1.13 | Build QuickReport component (mobile GPS + camera + category picker) | Done |
| 1.14 | Build WorkQueue component (open issues sorted by proximity) | Done |
| 1.15 | Build mobile bottom navigation bar (Map / Report / Tasks / Learn) | Done |
| 1.16 | Build FieldTip contextual learning component with trigger system | Done |
| 1.17 | Build MaintenanceLayer for map + enable layer toggle | Done |
| 1.18 | Responsive layout adjustments for thumb-reachable field use | Done |

### Phase 2: Spatial Analysis + Field Intelligence

**Goal**: PostGIS spatial queries, buffer analysis, advanced maintenance analytics, and Lessons 5-8.

| Task | Description |
|------|-------------|
| 2.1 | Create PostGIS RPC functions (nearby_parks, riparian_buffer, issues_near_trail, nearby_issues) |
| 2.2 | Build /api/spatial route to proxy PostGIS RPCs |
| 2.3 | Build maintenance issue CRUD API (/api/maintenance route) connected to Supabase |
| 2.4 | Migrate seed data to Supabase PostGIS tables |
| 2.5 | Build BufferLayer for dynamic riparian buffer visualization |
| 2.6 | Add Turf.js client-side measurements (distances to nearest waterway, trail segment lengths) |
| 2.7 | Implement Lessons 5-8 content and exercises (zones, terrain, styling, buffer analysis) |

### Phase 3: AI Analysis + Advanced Field Tools

**Goal**: AI pattern analysis, heatmap visualization, photo upload, offline support, and Lessons 9-10.

| Task | Description |
|------|-------------|
| 3.1 | Photo upload to Supabase Storage with URL saved to maintenance_issues.photo_url |
| 3.2 | AI maintenance analysis -- Claude analyzes issue patterns, suggests priority zones |
| 3.3 | Build HeatmapLayer (leaflet-heat plugin) for maintenance density visualization |
| 3.4 | Seasonal trend analysis view (issues by month, category breakdown) |
| 3.5 | Implement Lessons 9-10 content and exercises (trends, GPS best practices) |

### Phase 4: Regional Integration + Decision Support

**Goal**: External data feeds, overlay analysis for budget requests, complete curriculum.

| Task | Description |
|------|-------------|
| 4.1 | Integrate Denver Open Data REST API (parks polygons) |
| 4.2 | Integrate Arapahoe County Open Data Hub |
| 4.3 | Pull USGS National Hydrography Dataset (NHD) for enhanced hydrology |
| 4.4 | Build weighted overlay analysis tool for maintenance priority mapping |
| 4.5 | Implement Lessons 11-12 content and exercises (budget case, regional data) |

---

## 14. Reference Architecture -- Wine Catalog App

The wine catalog app at `/Users/dhall/Desktop/wine catalog/wine-catalog-app/` provides the exact architectural patterns to follow:

| Wine Catalog File | Trail Explorer Equivalent | Purpose |
|-------------------|--------------------------|---------|
| `lib/supabase.ts` | `lib/supabase.ts` | Supabase client singleton with typed interfaces |
| `lib/wineService.ts` | `lib/trailService.ts`, `parkService.ts`, `maintenanceService.ts` | Database CRUD with snake_case/camelCase conversion |
| `lib/types.ts` | `lib/types.ts` | TypeScript interfaces for all data models |
| `app/api/chat/route.ts` | `app/api/chat/route.ts` | Claude API integration with domain-specific context |
| `components/ChatWidget.tsx` | `components/ChatWidget.tsx` | Chat UI with clickable entity references |
| `components/FilterSidebar.tsx` | `components/FilterSidebar.tsx` + `Lessons/LessonPanel.tsx` | Sidebar with controls and filters |
| `app/page.tsx` | `app/page.tsx` | Main page assembling all components |
| `app/layout.tsx` | `app/layout.tsx` | Root layout with metadata |
| `tailwind.config.js` | `tailwind.config.js` | Custom theme colors |

### Key Patterns to Replicate

1. **Supabase client**: `createClient(url, anonKey)` singleton in `lib/supabase.ts`
2. **Service layer**: Each service file maps DB snake_case to frontend camelCase (see `wineService.ts` `dbToWine()` / `wineToDb()`)
3. **Claude API route**: POST handler that builds system prompt with domain data, calls `anthropic.messages.create()`, parses `[[Name|id]]` references
4. **Chat widget**: Fixed/floating panel with message history, loading state, suggested prompts, and clickable entity references
5. **URL-synced state**: Filters and view state encoded in URL search params for shareability

---

## 15. Open Data Sources & APIs

| Source | URL | Data Available | Format | License |
|--------|-----|---------------|--------|---------|
| Denver Open Data | `denvergov.org/opendata` | Parks polygons, recreation areas | SHP, KML, REST API | CC BY 3.0 |
| Denver Geospatial Hub | `opendata-geospatialdenver.hub.arcgis.com` | 250+ geospatial datasets | Various | CC BY 3.0 |
| Arapahoe County GIS | `gis.arapahoegov.com` | Trails, open spaces, parcel data | SHP, Download portal | Public |
| Arapahoe County Open Data | `arapahoe-open-data-arapahoegov.hub.arcgis.com` | 100+ county GIS layers | ArcGIS Hub | Public |
| ArcGIS World Topo | `arcgisonline.com` (item 6d2e47ca47774d4ab28443fa90a157dd) | Topographic basemap tiles | WMTS | Free for non-commercial |
| USGS National Map | `apps.nationalmap.gov` | Elevation, hydrology (NHD), land cover (NLCD) | Various | Public domain |
| OpenStreetMap | `openstreetmap.org` | Street/trail data, POIs | Overpass API | ODbL |
| SSPR Official | `ssprd.org` | District maps, trail info, facility data | PDF, Web | Public |

---

## 16. Prompts for Future Development

Use these prompts to continue building and iterating on the project in future Cursor sessions. Each prompt references this design document and the wine catalog for architectural context.

---

### Phase 1 Build Prompts

**Scaffold the project:**
```
I'm building the SSPR Trail Explorer app. Reference the design document at
~/Desktop/SSPR-Trail-Explorer-Design-Document.md and the wine catalog app
at ~/Desktop/wine catalog/wine-catalog-app/ for architectural patterns.

Scaffold a new Next.js 15 project at ~/Desktop/sspr-trail-explorer with:
- Same package structure as the wine catalog (Next.js 15, Tailwind, Supabase, Anthropic SDK)
- Add react-leaflet, @turf/turf, and @types/leaflet
- Set up the ecological Tailwind color palette from the design doc
- Create the project file structure (app/, components/, lib/, data/ directories)
- Create lib/supabase.ts and lib/types.ts following the wine catalog patterns
- Set up .env.local template
```

**Create the Supabase schema:**
```
Reference the SSPR Trail Explorer design document at
~/Desktop/SSPR-Trail-Explorer-Design-Document.md, section 7 (Database Schema).

Generate the complete SQL migration file for Supabase including:
- PostGIS extension
- All 6 tables (trails, parks, waterways, boundaries, maintenance_issues, lesson_progress)
- All spatial indexes
- All PostGIS RPC functions
- Row-level security policies for public read access

I'll run this in the Supabase SQL editor.
```

**Build the seed data:**
```
Reference the SSPR Trail Explorer design document at
~/Desktop/SSPR-Trail-Explorer-Design-Document.md (sections 6 and 7) and the
SSPR District Map PDF at ~/Downloads/DistrictMap.pdf.

Create GeoJSON seed files in data/geojson/ for:
- trails.geojson: All 14 major trails with real coordinates along their actual paths,
  plus ecological attributes (watershed, riparian_proximity, habitat_corridor)
- parks.geojson: All 174 parks/facilities as points with real coordinates,
  map numbers, categories, and ecological classifications
- waterways.geojson: South Platte River, Big Dry Creek, Little Dry Creek,
  Bear Creek, Dutch Creek, Marcy Gulch, High Line Canal with real coordinates
- district_boundary.geojson: SSPR district boundary polygon

Use the trail lengths, grid references, and street/landmark references from the
PDF to place coordinates accurately. Use OpenStreetMap/satellite imagery to
trace actual paths.
```

**Build the map:**
```
Reference the SSPR Trail Explorer design document at
~/Desktop/SSPR-Trail-Explorer-Design-Document.md (sections 8 and 11) and
the wine catalog at ~/Desktop/wine catalog/wine-catalog-app/ for component patterns.

Build the interactive map system:
1. MapView.tsx -- client component with React Leaflet, centered on SSPR district
2. MapWrapper.tsx -- next/dynamic wrapper with ssr: false
3. BasemapSelector.tsx -- toggle between OSM, ArcGIS Topo, Esri Satellite
4. LayerControl.tsx -- checkbox toggles for overlay layers
5. TrailLayer, ParkLayer, WaterwayLayer, BoundaryLayer -- each rendering
   GeoJSON from Supabase with the ecological styling described in the design doc
6. FeaturePopup.tsx -- click-to-inspect showing feature attributes

Load data from Supabase using the service layer pattern from the wine catalog.
```

**Build the AI Lab TA:**
```
Reference the SSPR Trail Explorer design document at
~/Desktop/SSPR-Trail-Explorer-Design-Document.md (section 9) and the wine
catalog's /api/chat/route.ts and ChatWidget.tsx for the exact implementation pattern.

Build the AI GIS Lab Teaching Assistant:
1. app/api/chat/route.ts -- same pattern as wine sommelier but with the
   ecological GIS system prompt from the design doc. Load SSPR trail/park
   data as context. Parse [[Feature Name|id]] references.
2. components/ChatWidget.tsx -- same UI as wine catalog chat but with
   trail-green theme and GIS-relevant suggested prompts like:
   - "What GIS concepts am I using right now?"
   - "Why do riparian buffers matter?"
   - "Explain the ecology of South Platte Park"
```

**Build the lesson system:**
```
Reference the SSPR Trail Explorer design document at
~/Desktop/SSPR-Trail-Explorer-Design-Document.md (section 10) for full
lesson content and section 11 for component structure.

Build the lesson framework:
1. lib/lessons.ts -- define all 12 lessons with their concept, ecology,
   exercise steps, vocabulary, and quiz questions
2. LessonPanel.tsx -- sidebar showing current lesson with progress bar
3. LessonNav.tsx -- lesson list with completion indicators
4. ConceptCard, EcologyCard, ExercisePrompt, VocabularyList, QuizCheckpoint
   components as described in the design doc
5. lib/lessonService.ts -- track progress in Supabase lesson_progress table
6. Implement Lessons 1-4 with their full content

The lesson exercises should interact with the map -- e.g., Lesson 1's exercise
toggles layers, Lesson 2 shows coordinates on click, Lesson 3 filters park markers.
```

---

### Phase 2 Build Prompts

**Spatial analysis backend:**
```
Reference the SSPR Trail Explorer design document (section 7, PostGIS RPCs).

Implement the spatial analysis system:
1. Create all PostGIS RPC functions in Supabase (nearby_parks, riparian_buffer,
   issues_near_trail, trails_geojson, parks_geojson, features_in_polygon)
2. Build lib/spatialService.ts wrapping each RPC in a typed function
3. Build app/api/spatial/route.ts as a query proxy
4. Build BufferLayer.tsx to render dynamic riparian buffers on the map
5. Add Turf.js distance/area measurements to FeaturePopup

Test with: "Create a 100m riparian buffer around Bear Creek and show
which parks fall within it."
```

**Maintenance system:**
```
Reference the SSPR Trail Explorer design document (sections 7 and 11).

Build the maintenance tracking system:
1. lib/maintenanceService.ts (CRUD for maintenance_issues table, same
   pattern as wineService.ts)
2. app/api/maintenance/route.ts (POST/GET/PATCH endpoints)
3. components/Maintenance/IssueForm.tsx (report with location, category,
   severity, description, photo placeholder)
4. components/Maintenance/IssueDetail.tsx
5. components/Maintenance/IssueFilter.tsx
6. components/Layers/MaintenanceLayer.tsx (severity-colored markers)
7. Generate 50-80 simulated maintenance issues spread across SSPR trails
   and parks with realistic ecological categories (erosion near waterways,
   invasive species in riparian zones, trail surface damage on slopes)
```

**Lessons 5-8:**
```
Reference the SSPR Trail Explorer design document (section 10, Lessons 5-8).

Implement Lessons 5 through 8 with full content and interactive exercises:
- Lesson 5 (Polygons): Park boundary area calculation, edge-to-area ratios
- Lesson 6 (Raster): Basemap switching exercise, terrain observation
- Lesson 7 (Styling): Dynamic layer styling controls, ecological visualization
- Lesson 8 (Riparian Buffers): PostGIS ST_Buffer exercise on Bear Creek
  and South Platte, spatial query results displayed on map

Each lesson exercise should directly manipulate the map and use
the spatial query infrastructure built in the previous task.
```

---

### Phase 3 Build Prompts

**Field collection + AI analysis:**
```
Reference the SSPR Trail Explorer design document (section 13, Phase 3).

Add field data collection and AI analysis:
1. GPS-based issue reporting using browser Geolocation API with accuracy display
2. Photo upload to Supabase Storage with URL saved to maintenance_issues.photo_url
3. Mobile-friendly IssueForm that works well on phones in the field
4. AI analysis endpoint: Send maintenance issue clusters to Claude for
   pattern analysis -- "Why are erosion issues concentrating near the
   Bear Creek / South Platte confluence?"
5. HeatmapLayer using leaflet-heat for disturbance density visualization
6. Implement Lessons 9-10 with field survey simulation exercises
```

---

### Phase 4 Build Prompts

**External data integration:**
```
Reference the SSPR Trail Explorer design document (sections 15 and 10, Lessons 11-12).

Integrate external ecological data:
1. Denver Open Data REST API -- pull parks polygons, overlay on map
2. Arapahoe County trails data from their ArcGIS Hub
3. USGS NHD hydrology data for enhanced waterway detail
4. Build a weighted overlay analysis tool: combine riparian buffers +
   disturbance density + habitat area + waterway proximity into a
   conservation priority layer with adjustable weights
5. Implement Lessons 11-12 with overlay analysis and external data exercises
```

---

### Enhancement Prompts (Post-MVP)

**Add user authentication:**
```
Reference the SSPR Trail Explorer and add Supabase Auth:
- Email/password signup and login
- Protect lesson_progress and maintenance_issues with RLS policies
  so each user has their own progress and can see all issues but only edit their own
- Show user's submitted issues in their profile
- Track which lessons each user has completed
```

**Add species observation layer:**
```
Extend the SSPR Trail Explorer with a species observation system:
- New Supabase table: species_observations (point geometry, species_name,
  count, date, observer, habitat_type, photo_url)
- Pull recent observations from iNaturalist API for the SSPR bounding box
- Display as a map layer with species icons
- AI Lab TA can answer "What species have been observed near Bear Creek?"
- Ties into Lesson 3 (point data) and Lesson 12 (external data)
```

**Add watershed delineation:**
```
Extend the SSPR Trail Explorer with watershed analysis:
- Use USGS Watershed Boundary Dataset (WBD) to show HUC boundaries
  overlapping the SSPR district
- Add stream order classification to waterways
- Build a watershed statistics panel: drainage area, stream length,
  number of confluences, land use composition
- Ties into Lesson 4 (stream networks) and Lesson 11 (overlay analysis)
```

**Add seasonal/temporal analysis:**
```
Add time-aware features to the SSPR Trail Explorer:
- Seasonal layer that changes trail/park styling by month
  (spring wildflowers, summer drought risk, fall foliage, winter closures)
- Temporal slider for maintenance issues (show how disturbance patterns
  change across seasons)
- AI Lab TA incorporates seasonal ecology in responses
- New lesson: "Temporal GIS -- How Ecosystems Change Through Time"
```

**Add print/export for class assignments:**
```
Add academic export features:
- Export current map view as a styled PDF with legend, scale bar, and
  north arrow (suitable for turning in as a lab assignment)
- Export lesson quiz results and exercise completion as a progress report
- Export maintenance issue analysis as a formatted report with maps and
  statistics (simulates a professional ecological assessment deliverable)
```

**Improve AI with RAG (retrieval-augmented generation):**
```
Enhance the AI Lab TA with RAG capabilities:
- Index the design document, SSPR facility data, and lesson content
  into vector embeddings (use Supabase pgvector)
- When the student asks a question, retrieve relevant context chunks
  before sending to Claude
- This allows the AI to give more specific answers about individual
  parks, trails, and ecological features without stuffing the entire
  dataset into the system prompt
```

---

## Appendix: Key Coordinates

| Feature | Latitude | Longitude |
|---------|----------|-----------|
| SSPR District Center (approx.) | 39.5950 | -104.9880 |
| Carson Nature Center | 39.5963 | -105.0139 |
| South Platte Park (center) | 39.5940 | -105.0140 |
| Chatfield Reservoir | 39.5340 | -105.0730 |
| Bear Creek Trail (west end) | 39.6440 | -105.0250 |
| High Line Canal / Cherry Hills | 39.6310 | -104.9450 |
| Family Sports Center | 39.6050 | -104.8770 |
| Lone Tree Recreation Center | 39.5420 | -104.8870 |

## Appendix: SSPR Park Facility Categories

From the district map, facilities fall into these categories (useful for ecological classification):

- Recreation Centers (4): Buck, Goodson, Lone Tree, Sheridan
- Golf Courses (4): Family Sports, Littleton Golf & Tennis, Lone Tree Golf, South Suburban Golf
- Outdoor Pools (4): Ben Franklin, Cook Creek, Harlow, Holly
- Tennis Courts (12 locations)
- Skate Parks (4): Cornerstone, Harmony, Promise, Sheridan Community
- Dog Parks (2): Family Sports, South Suburban Sports Complex
- Botanical/Display Gardens (5): Cornerstone, Gallup Gardens, Hudson Gardens, War Memorial Rose Garden, David A. Lorenz Regional Park
- Fishing Sites (2): David A. Lorenz Regional Park, Wynetka Ponds
- Nature Centers (1): Carson Nature Center
- BMX Tracks (1): David A. Lorenz Regional Park
- Pickleball Courts (2): SSIA, Southpark
- Trailheads with Parking (multiple, marked on map)

---

## Appendix: Accounts & Service Credentials

All accounts are active as of February 14, 2026. API keys should be stored in `.env.local` (never committed to git).

| Service | Account / URL | Username | Purpose | Free Tier Limits |
|---------|--------------|----------|---------|-----------------|
| **GitHub** | [github.com/dhall711](https://github.com/dhall711) | dhall711 | Source control, Vercel integration | Unlimited public repos |
| **Supabase** | [supabase.com/dashboard/org/sxuudaazpvaesypykdou](https://supabase.com/dashboard/org/sxuudaazpvaesypykdou) | dhall | PostGIS database, storage, auth | 1GB storage, PostGIS included |
| **Vercel** | [vercel.com/dhall711s-projects](https://vercel.com/dhall711s-projects) | dhall711 | Next.js hosting, serverless functions | 1M invocations/mo, 5min timeout |
| **Claude API** | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | dhall | AI Lab Teaching Assistant | Pay-per-use (~$1/mo estimated) |
| **ArcGIS** | [dhall711.maps.arcgis.com](https://dhall711.maps.arcgis.com/home/user.html) | dhall711 | Topographic basemap tiles, geocoding | 2M basemap tiles/mo |
| **USGS EarthExplorer** | [ers.cr.usgs.gov](https://ers.cr.usgs.gov/) | dhall711@gmail.com | DEM elevation data, NHD hydrology, NLCD land cover | Unlimited public data downloads |
| **Mapbox** | [console.mapbox.com](https://console.mapbox.com/) | dhall711 | Premium basemap styles, vector tiles, 3D terrain | ~10K map views/mo (Leaflet) |

### Environment Variables Template

```bash
# .env.local -- DO NOT COMMIT TO GIT

# Supabase (get from Supabase dashboard > Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Anthropic Claude (get from platform.claude.com/settings/keys)
ANTHROPIC_API_KEY=sk-ant-...

# ArcGIS (get from developers.arcgis.com > API Keys)
NEXT_PUBLIC_ARCGIS_API_KEY=AAPK...

# Mapbox (get from console.mapbox.com > Account > Access tokens)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

### Basemap Tile URLs (updated with auth)

```javascript
// OpenStreetMap -- no auth required
`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

// ArcGIS World Topographic -- requires API key
`https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_API_KEY}`

// Esri World Imagery -- requires API key
`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_API_KEY}`

// Mapbox Satellite Streets -- requires token
`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`

// Mapbox Outdoors (terrain-focused) -- requires token
`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
```

---

*This document is the single source of truth for the SSPR Trail Explorer project. Reference it in all future development prompts to maintain consistency.*
