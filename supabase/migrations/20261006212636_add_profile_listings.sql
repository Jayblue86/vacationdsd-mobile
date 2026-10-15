/*
# Add route/reliever listing fields to profiles

1. Purpose
   Adds a "listing" to each user's profile so route owners and relievers can
   describe their offering and browse each other. Owners describe their route
   (size, location, pricing). Relievers describe their availability (rate,
   cities, notes). Ratings are computed from existing match_reviews.

2. New Columns on `profiles`
   - `listing_active` (boolean, default false) — whether the listing is visible to others
   - `listing_route_size` (text, null) — owner: e.g. "~80 cases, 12 stops"
   - `listing_route_location` (text, null) — owner: where the route is located
   - `listing_pricing_type` (text, null) — owner: 'fixed' or 'negotiable'
   - `listing_rate_amount` (text, null) — owner: fixed price (e.g. "$150/day") OR reliever: expected rate per day
   - `listing_willing_cities` (text, null) — reliever: comma-separated cities they'll work in
   - `listing_description` (text, null) — both: other pertinent info, free text up to 1000 chars

3. Security
   - All existing profile policies already allow authenticated users to SELECT any
     profile (needed for directory lookups) and UPDATE their own row. No new
     policies needed — the new columns inherit the same access.

4. Notes
   - `listing_pricing_type` is constrained to 'fixed' or 'negotiable' via CHECK.
   - No data loss: all new columns are nullable with safe defaults.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS listing_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_route_size text,
  ADD COLUMN IF NOT EXISTS listing_route_location text,
  ADD COLUMN IF NOT EXISTS listing_pricing_type text CHECK (listing_pricing_type IS NULL OR listing_pricing_type IN ('fixed', 'negotiable')),
  ADD COLUMN IF NOT EXISTS listing_rate_amount text,
  ADD COLUMN IF NOT EXISTS listing_willing_cities text,
  ADD COLUMN IF NOT EXISTS listing_description text CHECK (listing_description IS NULL OR length(listing_description) <= 1000);
