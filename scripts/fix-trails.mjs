/**
 * Fetches real trail geometry from OpenStreetMap Overpass API
 * and generates an updated trails.json with accurate coordinates.
 */

import { readFileSync, writeFileSync } from 'fs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const BBOX = '39.52,-105.08,39.67,-104.85';

// Map our trail IDs to OSM name queries
const TRAIL_QUERIES = [
  { id: 'mary-carter-greenway', osmName: 'Mary Carter Greenway Trail', bbox: BBOX },
  { id: 'bear-creek', osmName: 'Bear Creek Trail', bbox: '39.63,-105.06,39.66,-104.99' },
  { id: 'highline-canal', osmName: 'High Line Canal Trail', bbox: '39.55,-105.02,39.65,-104.93' },
  { id: 'lee-gulch', osmName: 'Lee Gulch Trail', bbox: '39.57,-105.02,39.60,-104.95' },
  { id: 'willow-creek', osmName: 'Willow Creek Trail', bbox: '39.53,-104.95,39.60,-104.88' },
  { id: 'little-dry-creek', osmName: 'Little Dry Creek Trail', bbox: '39.57,-104.97,39.60,-104.91' },
  { id: 'big-dry-creek-north', osmName: 'Big Dry Creek Trail', bbox: '39.60,-105.03,39.64,-104.98' },
  { id: 'columbine', osmName: 'Columbine Trail', bbox: '39.56,-105.06,39.60,-105.02' },
  { id: 'centennial-link', osmName: 'Centennial Link Trail', bbox: '39.58,-105.01,39.62,-104.90' },
  { id: 'railroad-spur', osmName: 'Mineral Avenue Trail', bbox: '39.57,-105.04,39.58,-104.96' },
  { id: 'cook-creek', osmName: 'Cook Creek', bbox: '39.52,-104.91,39.56,-104.87' },
  { id: 'happy-canyon', osmName: 'Happy Canyon Trail', bbox: '39.52,-104.89,39.55,-104.85' },
  { id: 'littleton-community', osmName: 'Littleton Community Trail', bbox: '39.58,-105.02,39.63,-104.99' },
];

async function fetchTrailGeom(osmName, bbox) {
  const query = `[out:json][timeout:30];way["highway"]["name"="${osmName}"](${bbox});out geom;`;
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const data = await resp.json();
  return data.elements || [];
}

function mergeWaySegments(elements) {
  // Extract ordered coordinate arrays from each way
  const segments = elements
    .filter(el => el.type === 'way' && el.geometry)
    .map(el => el.geometry.map(pt => [pt.lon, pt.lat]));
  
  if (segments.length === 0) return [];
  if (segments.length === 1) return segments[0];
  
  // Greedy merge: start with first segment, find closest endpoint to continue
  const used = new Set();
  let merged = [...segments[0]];
  used.add(0);
  
  while (used.size < segments.length) {
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestReverse = false;
    let bestPrepend = false;
    
    const head = merged[0];
    const tail = merged[merged.length - 1];
    
    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;
      const seg = segments[i];
      const segHead = seg[0];
      const segTail = seg[seg.length - 1];
      
      // tail -> segHead (append, no reverse)
      let d = dist(tail, segHead);
      if (d < bestDist) { bestDist = d; bestIdx = i; bestReverse = false; bestPrepend = false; }
      // tail -> segTail (append, reverse)
      d = dist(tail, segTail);
      if (d < bestDist) { bestDist = d; bestIdx = i; bestReverse = true; bestPrepend = false; }
      // head -> segTail (prepend, no reverse)
      d = dist(head, segTail);
      if (d < bestDist) { bestDist = d; bestIdx = i; bestReverse = false; bestPrepend = true; }
      // head -> segHead (prepend, reverse)
      d = dist(head, segHead);
      if (d < bestDist) { bestDist = d; bestIdx = i; bestReverse = true; bestPrepend = true; }
    }
    
    if (bestIdx === -1) break;
    used.add(bestIdx);
    
    let seg = segments[bestIdx];
    if (bestReverse) seg = [...seg].reverse();
    
    if (bestPrepend) {
      merged = [...seg, ...merged];
    } else {
      merged = [...merged, ...seg];
    }
  }
  
  return merged;
}

function dist(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2);
}

function simplifyLine(coords, maxPoints = 40) {
  if (coords.length <= maxPoints) return coords;
  // Douglas-Peucker-like: just uniformly sample
  const step = (coords.length - 1) / (maxPoints - 1);
  const result = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

async function main() {
  // Load existing trails.json for properties
  const existing = JSON.parse(readFileSync('./data/geojson/trails.json', 'utf-8'));
  const propsByID = {};
  for (const f of existing.features) {
    propsByID[f.properties.id] = f.properties;
  }
  
  const updatedFeatures = [];
  
  for (const tq of TRAIL_QUERIES) {
    console.log(`Fetching ${tq.id} (OSM: "${tq.osmName}")...`);
    
    let coords = [];
    try {
      const elements = await fetchTrailGeom(tq.osmName, tq.bbox);
      console.log(`  Found ${elements.filter(e=>e.type==='way').length} way segments`);
      
      if (elements.length > 0) {
        coords = mergeWaySegments(elements);
        console.log(`  Merged: ${coords.length} points`);
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
    
    // If we got real data, simplify and use it; otherwise keep existing
    if (coords.length >= 2) {
      const simplified = simplifyLine(coords, 40);
      console.log(`  Simplified to ${simplified.length} points`);
      
      // Round to 6 decimal places
      const rounded = simplified.map(c => [
        Math.round(c[0] * 1000000) / 1000000,
        Math.round(c[1] * 1000000) / 1000000,
      ]);
      
      const props = propsByID[tq.id] || { id: tq.id, name: tq.osmName };
      updatedFeatures.push({
        type: 'Feature',
        id: tq.id,
        properties: props,
        geometry: { type: 'LineString', coordinates: rounded },
      });
    } else {
      console.log(`  No OSM data, keeping existing coordinates`);
      const existingFeature = existing.features.find(f => f.properties.id === tq.id);
      if (existingFeature) {
        updatedFeatures.push(existingFeature);
      }
    }
    
    // Be polite to the API
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Also include any trails not in our query list
  for (const f of existing.features) {
    if (!TRAIL_QUERIES.some(tq => tq.id === f.properties.id)) {
      updatedFeatures.push(f);
    }
  }
  
  const output = {
    type: 'FeatureCollection',
    features: updatedFeatures,
  };
  
  writeFileSync('./data/geojson/trails.json', JSON.stringify(output, null, 2));
  console.log(`\nWrote ${updatedFeatures.length} trails to data/geojson/trails.json`);
}

main().catch(console.error);
