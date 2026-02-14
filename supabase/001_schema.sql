-- =============================================================
-- SSPR Trail Explorer -- Complete Schema Migration
-- Run this in Supabase Dashboard > SQL Editor
-- =============================================================

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================
-- 2. Core tables
-- =============================================================

-- Trails (14 major trails)
CREATE TABLE IF NOT EXISTS trails (
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
CREATE INDEX IF NOT EXISTS trails_geo_idx ON trails USING GIST (geometry);

-- Parks & Facilities (174 parks)
CREATE TABLE IF NOT EXISTS parks (
  id TEXT PRIMARY KEY,
  map_number INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  ecological_class TEXT,
  amenities TEXT[],
  grid_ref TEXT,
  area_acres NUMERIC,
  description TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  boundary GEOGRAPHY(POLYGON, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parks_location_idx ON parks USING GIST (location);
CREATE INDEX IF NOT EXISTS parks_boundary_idx ON parks USING GIST (boundary);

-- Waterways (rivers, creeks, canals)
CREATE TABLE IF NOT EXISTS waterways (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  stream_order INTEGER,
  watershed TEXT,
  geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS waterways_geo_idx ON waterways USING GIST (geometry);

-- District & municipal boundaries
CREATE TABLE IF NOT EXISTS boundaries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  geometry GEOGRAPHY(POLYGON, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS boundaries_geo_idx ON boundaries USING GIST (geometry);

-- Maintenance issues (field worker reports)
CREATE TABLE IF NOT EXISTS maintenance_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  trail_id TEXT REFERENCES trails(id),
  park_id TEXT REFERENCES parks(id),
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT DEFAULT 'reported',
  title TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  assigned_to TEXT,
  reporter TEXT,
  source TEXT DEFAULT 'citizen',
  field_notes TEXT,
  ai_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS issues_location_idx ON maintenance_issues USING GIST (location);
CREATE INDEX IF NOT EXISTS issues_status_idx ON maintenance_issues (status);
CREATE INDEX IF NOT EXISTS issues_severity_idx ON maintenance_issues (severity);
CREATE INDEX IF NOT EXISTS issues_category_idx ON maintenance_issues (category);

-- Lesson progress tracking
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id INTEGER NOT NULL UNIQUE,
  status TEXT DEFAULT 'not_started',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  quiz_score INTEGER,
  quiz_total INTEGER,
  exercise_completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- 3. Row Level Security (public read, authenticated write)
-- =============================================================

ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE waterways ENABLE ROW LEVEL SECURITY;
ALTER TABLE boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

-- Public read access for all spatial data
CREATE POLICY "Public read trails" ON trails FOR SELECT USING (true);
CREATE POLICY "Public read parks" ON parks FOR SELECT USING (true);
CREATE POLICY "Public read waterways" ON waterways FOR SELECT USING (true);
CREATE POLICY "Public read boundaries" ON boundaries FOR SELECT USING (true);
CREATE POLICY "Public read issues" ON maintenance_issues FOR SELECT USING (true);
CREATE POLICY "Public read progress" ON lesson_progress FOR SELECT USING (true);

-- Public write for maintenance issues (no auth required for MVP)
CREATE POLICY "Public insert issues" ON maintenance_issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update issues" ON maintenance_issues FOR UPDATE USING (true);

-- Public write for lesson progress (no auth required for MVP)
CREATE POLICY "Public insert progress" ON lesson_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update progress" ON lesson_progress FOR UPDATE USING (true);

-- =============================================================
-- 4. PostGIS RPC Functions
-- =============================================================

-- Find parks within radius of a point (meters)
CREATE OR REPLACE FUNCTION nearby_parks(lat FLOAT, lng FLOAT, radius_meters FLOAT)
RETURNS SETOF parks AS $$
  SELECT * FROM parks
  WHERE ST_DWithin(location, ST_Point(lng, lat)::geography, radius_meters);
$$ LANGUAGE sql STABLE;

-- Find maintenance issues within radius of a point (meters)
CREATE OR REPLACE FUNCTION nearby_issues(lat FLOAT, lng FLOAT, radius_meters FLOAT)
RETURNS SETOF maintenance_issues AS $$
  SELECT * FROM maintenance_issues
  WHERE ST_DWithin(location, ST_Point(lng, lat)::geography, radius_meters)
  ORDER BY ST_Distance(location, ST_Point(lng, lat)::geography);
$$ LANGUAGE sql STABLE;

-- Create riparian buffer around a waterway (returns GeoJSON polygon)
CREATE OR REPLACE FUNCTION riparian_buffer(target_waterway_id TEXT, buffer_meters FLOAT)
RETURNS JSON AS $$
  SELECT ST_AsGeoJSON(ST_Buffer(geometry::geometry, buffer_meters / 111320.0))::json
  FROM waterways WHERE id = target_waterway_id;
$$ LANGUAGE sql STABLE;

-- Find maintenance issues near a trail
CREATE OR REPLACE FUNCTION issues_near_trail(target_trail_id TEXT, buffer_meters FLOAT)
RETURNS SETOF maintenance_issues AS $$
  SELECT mi.* FROM maintenance_issues mi
  JOIN trails t ON t.id = target_trail_id
  WHERE ST_DWithin(mi.location, t.geometry, buffer_meters);
$$ LANGUAGE sql STABLE;

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
          'difficulty', difficulty, 'watershed', watershed,
          'riparian_proximity', riparian_proximity,
          'habitat_corridor', habitat_corridor,
          'description', description
        )
      )
    ), '[]'::json)
  ) FROM trails;
$$ LANGUAGE sql STABLE;

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
          'grid_ref', grid_ref, 'area_acres', area_acres,
          'description', description
        )
      )
    ), '[]'::json)
  ) FROM parks;
$$ LANGUAGE sql STABLE;

-- Return all waterways as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION waterways_geojson()
RETURNS JSON AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(geometry)::json,
        'properties', json_build_object(
          'id', id, 'name', name, 'type', type,
          'stream_order', stream_order, 'watershed', watershed
        )
      )
    ), '[]'::json)
  ) FROM waterways;
$$ LANGUAGE sql STABLE;

-- Return maintenance issues as GeoJSON FeatureCollection (with optional status filter)
CREATE OR REPLACE FUNCTION issues_geojson(filter_status TEXT DEFAULT NULL)
RETURNS JSON AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', id,
        'geometry', ST_AsGeoJSON(location)::json,
        'properties', json_build_object(
          'id', id, 'title', title, 'category', category,
          'severity', severity, 'status', status,
          'description', description, 'reported_at', reported_at,
          'resolved_at', resolved_at, 'assigned_to', assigned_to,
          'reporter', reporter, 'source', source,
          'field_notes', field_notes, 'trail_id', trail_id,
          'park_id', park_id
        )
      )
    ), '[]'::json)
  ) FROM maintenance_issues
  WHERE filter_status IS NULL OR status = filter_status;
$$ LANGUAGE sql STABLE;

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
                    ST_GeomFromGeoJSON(geojson_polygon))),
    'issues_count', (SELECT COUNT(*)
              FROM maintenance_issues mi
              WHERE ST_Within(mi.location::geometry,
                    ST_GeomFromGeoJSON(geojson_polygon)))
  );
$$ LANGUAGE sql STABLE;

-- Get issue statistics summary
CREATE OR REPLACE FUNCTION issue_stats()
RETURNS JSON AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'by_status', json_build_object(
      'reported', COUNT(*) FILTER (WHERE status = 'reported'),
      'assigned', COUNT(*) FILTER (WHERE status = 'assigned'),
      'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress'),
      'resolved', COUNT(*) FILTER (WHERE status = 'resolved')
    ),
    'by_severity', json_build_object(
      'critical', COUNT(*) FILTER (WHERE severity = 'critical'),
      'high', COUNT(*) FILTER (WHERE severity = 'high'),
      'medium', COUNT(*) FILTER (WHERE severity = 'medium'),
      'low', COUNT(*) FILTER (WHERE severity = 'low')
    ),
    'by_category', (
      SELECT json_object_agg(category, cnt)
      FROM (SELECT category, COUNT(*) as cnt FROM maintenance_issues GROUP BY category) sub
    )
  ) FROM maintenance_issues;
$$ LANGUAGE sql STABLE;

-- =============================================================
-- 5. Updated_at trigger
-- =============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintenance_issues_updated_at
  BEFORE UPDATE ON maintenance_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lesson_progress_updated_at
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
