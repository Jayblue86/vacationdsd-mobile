/*
# Add Solo Reliever and Vendor System

## Overview
Expands the app beyond group-only DSD to support two new account types:
- "solo" relievers who manage multiple vendor routes without a formal group
- "vendors" who are invited by solo relievers to input their store info and payment preferences

## New Columns

### profiles table
- `account_type` (text, not null, default 'group'): One of 'group', 'solo', 'vendor'.

## New Tables
- vendor_invitations: invitations sent by solo relievers to vendors
- vendor_relationships: links vendor users to solo relievers
- vendor_routes: route profiles defined by vendors
- solo_gigs: gig calendar entries for solo relievers

## Security (RLS)
All new tables have RLS enabled with ownership-scoped policies.

## Important Notes
1. account_type defaults to 'group' so existing users are unaffected
2. Vendor signup is invitation-only
3. vendor_relationships.is_active allows deactivating without data loss
*/

-- Add account_type to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'group';

-- Create vendor_invitations table
CREATE TABLE IF NOT EXISTS vendor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reliever_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_email text NOT NULL,
  vendor_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invite_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  message text,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  responded_at timestamptz
);

ALTER TABLE vendor_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_invitations" ON vendor_invitations;
CREATE POLICY "select_own_invitations" ON vendor_invitations FOR SELECT
  TO authenticated USING (
    reliever_id = auth.uid() OR vendor_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_invitations" ON vendor_invitations;
CREATE POLICY "insert_own_invitations" ON vendor_invitations FOR INSERT
  TO authenticated WITH CHECK (reliever_id = auth.uid());

DROP POLICY IF EXISTS "update_own_invitations" ON vendor_invitations;
CREATE POLICY "update_own_invitations" ON vendor_invitations FOR UPDATE
  TO authenticated USING (reliever_id = auth.uid() OR vendor_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (reliever_id = auth.uid() OR vendor_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_invitations" ON vendor_invitations;
CREATE POLICY "delete_own_invitations" ON vendor_invitations FOR DELETE
  TO authenticated USING (reliever_id = auth.uid());

-- Create vendor_relationships table
CREATE TABLE IF NOT EXISTS vendor_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reliever_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES vendor_invitations(id) ON DELETE SET NULL,
  vendor_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (reliever_id, vendor_id)
);

ALTER TABLE vendor_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_vendor_relationships" ON vendor_relationships;
CREATE POLICY "select_vendor_relationships" ON vendor_relationships FOR SELECT
  TO authenticated USING (reliever_id = auth.uid() OR vendor_id = auth.uid());

DROP POLICY IF EXISTS "insert_vendor_relationships" ON vendor_relationships;
CREATE POLICY "insert_vendor_relationships" ON vendor_relationships FOR INSERT
  TO authenticated WITH CHECK (reliever_id = auth.uid());

DROP POLICY IF EXISTS "update_vendor_relationships" ON vendor_relationships;
CREATE POLICY "update_vendor_relationships" ON vendor_relationships FOR UPDATE
  TO authenticated USING (reliever_id = auth.uid() OR vendor_id = auth.uid())
  WITH CHECK (reliever_id = auth.uid() OR vendor_id = auth.uid());

DROP POLICY IF EXISTS "delete_vendor_relationships" ON vendor_relationships;
CREATE POLICY "delete_vendor_relationships" ON vendor_relationships FOR DELETE
  TO authenticated USING (reliever_id = auth.uid());

-- Create vendor_routes table
CREATE TABLE IF NOT EXISTS vendor_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reliever_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company text NOT NULL,
  delivery_days text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vendor_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_vendor_routes" ON vendor_routes;
CREATE POLICY "select_vendor_routes" ON vendor_routes FOR SELECT
  TO authenticated USING (vendor_id = auth.uid() OR reliever_id = auth.uid());

DROP POLICY IF EXISTS "insert_vendor_routes" ON vendor_routes;
CREATE POLICY "insert_vendor_routes" ON vendor_routes FOR INSERT
  TO authenticated WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS "update_vendor_routes" ON vendor_routes;
CREATE POLICY "update_vendor_routes" ON vendor_routes FOR UPDATE
  TO authenticated USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS "delete_vendor_routes" ON vendor_routes;
CREATE POLICY "delete_vendor_routes" ON vendor_routes FOR DELETE
  TO authenticated USING (vendor_id = auth.uid());

-- Create solo_gigs table
CREATE TABLE IF NOT EXISTS solo_gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reliever_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid REFERENCES vendor_routes(id) ON DELETE SET NULL,
  gig_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE solo_gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_solo_gigs" ON solo_gigs;
CREATE POLICY "select_solo_gigs" ON solo_gigs FOR SELECT
  TO authenticated USING (reliever_id = auth.uid() OR vendor_id = auth.uid());

DROP POLICY IF EXISTS "insert_solo_gigs" ON solo_gigs;
CREATE POLICY "insert_solo_gigs" ON solo_gigs FOR INSERT
  TO authenticated WITH CHECK (reliever_id = auth.uid());

DROP POLICY IF EXISTS "update_solo_gigs" ON solo_gigs;
CREATE POLICY "update_solo_gigs" ON solo_gigs FOR UPDATE
  TO authenticated USING (reliever_id = auth.uid())
  WITH CHECK (reliever_id = auth.uid());

DROP POLICY IF EXISTS "delete_solo_gigs" ON solo_gigs;
CREATE POLICY "delete_solo_gigs" ON solo_gigs FOR DELETE
  TO authenticated USING (reliever_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_invitations_reliever ON vendor_invitations(reliever_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invitations_token ON vendor_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_vendor_relationships_reliever ON vendor_relationships(reliever_id);
CREATE INDEX IF NOT EXISTS idx_vendor_relationships_vendor ON vendor_relationships(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_routes_vendor ON vendor_routes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_routes_reliever ON vendor_routes(reliever_id);
CREATE INDEX IF NOT EXISTS idx_solo_gigs_reliever ON solo_gigs(reliever_id);
CREATE INDEX IF NOT EXISTS idx_solo_gigs_vendor ON solo_gigs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_solo_gigs_date ON solo_gigs(gig_date);
