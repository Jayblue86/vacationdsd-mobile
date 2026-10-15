/*
# Add Matchmaker Gig Board + Reviews + Multi-Route Owner System

1. New Tables
- `match_gigs` — public gig board for vendors/relievers to post and claim temporary DSD work (weekend gigs, last-minute coverage). Statuses: open → claimed → completed. Pay rate is free-text (e.g. "$200/day", "15% commission").
- `match_reviews` — 1-5 star reviews left after a gig completes. Both vendor and reliever can review each other once per gig.
- `multi_routes` — named routes belonging to a multi-route owner.
- `multi_route_runners` — runners assigned to each multi-route, with invite tokens for app signup.
- `multi_route_stores` — stores belonging to a multi-route (same shape as `stores` table but scoped to route_id).

2. Security
- Enable RLS on all new tables.
- match_gigs: anyone authenticated can read (it's a public board); only the poster can update/cancel; only the poster or claimer can mark completed.
- match_reviews: anyone authenticated can read; only the reviewer can insert their own review.
- multi_routes: only the owner can CRUD.
- multi_route_runners: only the route owner can CRUD; runners with a user_id can read their own assignments.
- multi_route_stores: only the route owner can CRUD.

3. Important Notes
- match_gigs uses `DEFAULT auth.uid()` on `posted_by` so inserts work even if the client omits it.
- multi_routes uses `DEFAULT auth.uid()` on `owner_id`.
- All policies are `TO authenticated` since the app requires sign-in.
*/

-- Match Gigs table
CREATE TABLE IF NOT EXISTS match_gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  poster_type text NOT NULL CHECK (poster_type IN ('vendor', 'reliever')),
  title text NOT NULL,
  description text,
  company text,
  city text,
  state text,
  gig_date date NOT NULL,
  pay_rate text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'cancelled')),
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE match_gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_match_gigs" ON match_gigs;
CREATE POLICY "select_match_gigs" ON match_gigs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_match_gigs" ON match_gigs;
CREATE POLICY "insert_match_gigs" ON match_gigs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = posted_by);

DROP POLICY IF EXISTS "update_match_gigs" ON match_gigs;
CREATE POLICY "update_match_gigs" ON match_gigs FOR UPDATE
  TO authenticated USING (auth.uid() = posted_by OR auth.uid() = claimed_by)
  WITH CHECK (auth.uid() = posted_by OR auth.uid() = claimed_by);

DROP POLICY IF EXISTS "delete_match_gigs" ON match_gigs;
CREATE POLICY "delete_match_gigs" ON match_gigs FOR DELETE
  TO authenticated USING (auth.uid() = posted_by);

-- Match Reviews table
CREATE TABLE IF NOT EXISTS match_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES match_gigs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_type text NOT NULL CHECK (reviewer_type IN ('vendor', 'reliever')),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (gig_id, reviewer_id)
);

ALTER TABLE match_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_match_reviews" ON match_reviews;
CREATE POLICY "select_match_reviews" ON match_reviews FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_match_reviews" ON match_reviews;
CREATE POLICY "insert_match_reviews" ON match_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "delete_match_reviews" ON match_reviews;
CREATE POLICY "delete_match_reviews" ON match_reviews FOR DELETE
  TO authenticated USING (auth.uid() = reviewer_id);

-- Multi Routes table
CREATE TABLE IF NOT EXISTS multi_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text,
  city text,
  state text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE multi_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_multi_routes" ON multi_routes;
CREATE POLICY "select_multi_routes" ON multi_routes FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_multi_routes" ON multi_routes;
CREATE POLICY "insert_multi_routes" ON multi_routes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_multi_routes" ON multi_routes;
CREATE POLICY "update_multi_routes" ON multi_routes FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_multi_routes" ON multi_routes;
CREATE POLICY "delete_multi_routes" ON multi_routes FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- Multi Route Runners table
CREATE TABLE IF NOT EXISTS multi_route_runners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES multi_routes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  invite_token text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE multi_route_runners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_multi_route_runners" ON multi_route_runners;
CREATE POLICY "select_multi_route_runners" ON multi_route_runners FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_runners.route_id AND multi_routes.owner_id = auth.uid())
    OR auth.uid() = multi_route_runners.user_id
  );

DROP POLICY IF EXISTS "insert_multi_route_runners" ON multi_route_runners;
CREATE POLICY "insert_multi_route_runners" ON multi_route_runners FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_runners.route_id AND multi_routes.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_multi_route_runners" ON multi_route_runners;
CREATE POLICY "update_multi_route_runners" ON multi_route_runners FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_runners.route_id AND multi_routes.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_runners.route_id AND multi_routes.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_multi_route_runners" ON multi_route_runners;
CREATE POLICY "delete_multi_route_runners" ON multi_route_runners FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_runners.route_id AND multi_routes.owner_id = auth.uid())
  );

-- Multi Route Stores table (same shape as stores but scoped to multi-route)
CREATE TABLE IF NOT EXISTS multi_route_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES multi_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  contact_name text,
  delivery_days text[] NOT NULL DEFAULT '{}',
  stop_order integer NOT NULL DEFAULT 0,
  special_instructions text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE multi_route_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_multi_route_stores" ON multi_route_stores;
CREATE POLICY "select_multi_route_stores" ON multi_route_stores FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_stores.route_id AND multi_routes.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_multi_route_stores" ON multi_route_stores;
CREATE POLICY "insert_multi_route_stores" ON multi_route_stores FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_stores.route_id AND multi_routes.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_multi_route_stores" ON multi_route_stores;
CREATE POLICY "update_multi_route_stores" ON multi_route_stores FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_stores.route_id AND multi_routes.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_stores.route_id AND multi_routes.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_multi_route_stores" ON multi_route_stores;
CREATE POLICY "delete_multi_route_stores" ON multi_route_stores FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM multi_routes WHERE multi_routes.id = multi_route_stores.route_id AND multi_routes.owner_id = auth.uid())
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_gigs_status ON match_gigs(status);
CREATE INDEX IF NOT EXISTS idx_match_gigs_date ON match_gigs(gig_date);
CREATE INDEX IF NOT EXISTS idx_match_reviews_gig ON match_reviews(gig_id);
CREATE INDEX IF NOT EXISTS idx_match_reviews_reviewee ON match_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_multi_routes_owner ON multi_routes(owner_id);
CREATE INDEX IF NOT EXISTS idx_multi_route_runners_route ON multi_route_runners(route_id);
CREATE INDEX IF NOT EXISTS idx_multi_route_stores_route ON multi_route_stores(route_id);
