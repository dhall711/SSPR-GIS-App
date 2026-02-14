/**
 * Seed Supabase with SSPR spatial data.
 *
 * Usage:
 *   node supabase/seed.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * in .env.local (reads them automatically).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Read env ──────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(root, ".env.local");
  const content = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Load GeoJSON files ────────────────────────────────────
function loadJSON(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), "utf-8"));
}

const trails = loadJSON("data/geojson/trails.json");
const parks = loadJSON("data/geojson/parks.json");
const waterways = loadJSON("data/geojson/waterways.json");
const boundary = loadJSON("data/geojson/district_boundary.json");
const issues = loadJSON("data/seed/maintenance-issues.json");

// ── Helper: convert GeoJSON geometry to WKT ───────────────
function pointToWKT(coords) {
  return `SRID=4326;POINT(${coords[0]} ${coords[1]})`;
}

function lineToWKT(coords) {
  const pts = coords.map((c) => `${c[0]} ${c[1]}`).join(", ");
  return `SRID=4326;LINESTRING(${pts})`;
}

function polygonToWKT(coords) {
  // coords is an array of rings; first ring is the exterior
  const rings = coords.map((ring) => {
    const pts = ring.map((c) => `${c[0]} ${c[1]}`).join(", ");
    return `(${pts})`;
  });
  return `SRID=4326;POLYGON(${rings.join(", ")})`;
}

// ── Seed functions ────────────────────────────────────────

async function seedTrails() {
  console.log(`Seeding ${trails.features.length} trails...`);
  const rows = trails.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    letter_code: f.properties.letterCode,
    length_miles: f.properties.lengthMiles,
    surface: f.properties.surface,
    difficulty: f.properties.difficulty,
    grid_start: f.properties.gridStart,
    grid_end: f.properties.gridEnd,
    watershed: f.properties.watershed,
    riparian_proximity: f.properties.riparianProximity,
    habitat_corridor: f.properties.habitatCorridor,
    description: f.properties.description,
    geometry: lineToWKT(f.geometry.coordinates),
  }));

  const { error } = await supabase.from("trails").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("  Error seeding trails:", error.message);
  } else {
    console.log(`  ✓ ${rows.length} trails inserted`);
  }
}

async function seedParks() {
  console.log(`Seeding ${parks.features.length} parks...`);
  // Supabase has a max payload, so batch in chunks of 50
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < parks.features.length; i += batchSize) {
    const batch = parks.features.slice(i, i + batchSize);
    const rows = batch.map((f) => ({
      id: f.properties.id,
      map_number: f.properties.mapNumber || null,
      name: f.properties.name,
      category: f.properties.category,
      ecological_class: f.properties.ecologicalClass,
      amenities: f.properties.amenities || [],
      grid_ref: f.properties.gridRef,
      area_acres: f.properties.areaAcres || null,
      description: f.properties.description,
      location: pointToWKT(f.geometry.coordinates),
    }));

    const { error } = await supabase.from("parks").upsert(rows, { onConflict: "id" });
    if (error) {
      console.error(`  Error seeding parks batch ${i}:`, error.message);
    } else {
      inserted += rows.length;
    }
  }
  console.log(`  ✓ ${inserted} parks inserted`);
}

async function seedWaterways() {
  console.log(`Seeding ${waterways.features.length} waterways...`);
  const rows = waterways.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    type: f.properties.type,
    stream_order: f.properties.streamOrder || null,
    watershed: f.properties.watershed,
    geometry: lineToWKT(f.geometry.coordinates),
  }));

  const { error } = await supabase.from("waterways").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("  Error seeding waterways:", error.message);
  } else {
    console.log(`  ✓ ${rows.length} waterways inserted`);
  }
}

async function seedBoundaries() {
  console.log(`Seeding ${boundary.features.length} boundaries...`);
  const rows = boundary.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    type: f.properties.type,
    geometry: polygonToWKT(f.geometry.coordinates),
  }));

  const { error } = await supabase.from("boundaries").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("  Error seeding boundaries:", error.message);
  } else {
    console.log(`  ✓ ${rows.length} boundaries inserted`);
  }
}

async function seedMaintenanceIssues() {
  console.log(`Seeding ${issues.features.length} maintenance issues...`);
  const batchSize = 25;
  let inserted = 0;

  for (let i = 0; i < issues.features.length; i += batchSize) {
    const batch = issues.features.slice(i, i + batchSize);
    const rows = batch.map((f) => ({
      location: pointToWKT(f.geometry.coordinates),
      trail_id: f.properties.trailId || null,
      park_id: f.properties.parkId || null,
      category: f.properties.category,
      severity: f.properties.severity,
      status: f.properties.status,
      title: f.properties.title,
      description: f.properties.description,
      photo_url: f.properties.photoUrl || null,
      reported_at: f.properties.reportedAt,
      resolved_at: f.properties.resolvedAt || null,
      assigned_to: f.properties.assignedTo || null,
      reporter: f.properties.reporter,
      source: f.properties.source,
      field_notes: f.properties.fieldNotes || null,
      ai_analysis: f.properties.aiAnalysis || null,
    }));

    const { error } = await supabase.from("maintenance_issues").insert(rows);
    if (error) {
      console.error(`  Error seeding issues batch ${i}:`, error.message);
    } else {
      inserted += rows.length;
    }
  }
  console.log(`  ✓ ${inserted} maintenance issues inserted`);
}

// ── Run ───────────────────────────────────────────────────

async function main() {
  console.log("=== SSPR Trail Explorer - Supabase Seed ===");
  console.log(`URL: ${supabaseUrl}`);
  console.log("");

  // Order matters: trails & parks first (foreign key refs from issues)
  await seedTrails();
  await seedParks();
  await seedWaterways();
  await seedBoundaries();
  await seedMaintenanceIssues();

  console.log("");
  console.log("=== Seed complete! ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
