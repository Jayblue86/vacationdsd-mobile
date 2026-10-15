/*
# Allow browsing active listings

1. Purpose
   The Matchmaker "Listings" tab needs to let authenticated users read other
   users' profiles when those profiles have listing_active = true. The existing
   select_own_profile policy only allows reading your own row.

2. Security Changes
   - New SELECT policy `select_active_listings` on `profiles`:
     authenticated users can SELECT any profile where listing_active = true.
   - This is intentionally narrow: inactive/private profiles remain visible
     only to their owner. The listing fields (route size, location, pricing,
     willing cities, description) are only meaningful when the owner has
     opted in by setting listing_active = true.
*/

DROP POLICY IF EXISTS "select_active_listings" ON profiles;
CREATE POLICY "select_active_listings"
ON profiles FOR SELECT
TO authenticated
USING (listing_active = true);
