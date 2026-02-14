-- Run this in Supabase SQL Editor to allow seeding via anon key
-- These policies allow public inserts for initial data load.
-- You can tighten these later when you add authentication.

CREATE POLICY "Public insert trails" ON trails FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert parks" ON parks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert waterways" ON waterways FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert boundaries" ON boundaries FOR INSERT WITH CHECK (true);
