/*
# VACATIONDSD - Initial Database Schema

## Overview
Creates the core tables for the VACATIONDSD app — a tool for DSD (Direct Store Delivery) route owners
to manage their routes, stores, and vacation handoffs to relievers.

## New Tables

### profiles
- `id` (uuid, PK, references auth.users) — the vendor's auth ID
- `full_name` (text) — vendor's full name
- `company` (text) — the product company they deliver (e.g. "Little Debbie", "Mission Tortillas")
- `phone` (text) — contact phone number
- `route_name` (text) — name/label for their route
- `created_at` (timestamptz)

### stores
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users, defaults to auth.uid()) — owner of this store entry
- `name` (text) — store name (e.g. "Walmart Supercenter #123")
- `address` (text) — store street address
- `city` (text) — city
- `state` (text) — state
- `zip` (text) — zip code
- `phone` (text) — store phone number
- `contact_name` (text) — name of key contact at the store
- `delivery_days` (text[]) — array of weekday names this store gets deliveries (e.g. ['Monday','Wednesday','Friday'])
- `stop_order` (integer) — order of this stop within the day's route
- `special_instructions` (text) — critical per-store instructions for the reliever
- `created_at` (timestamptz)

### vacation_periods
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users, defaults to auth.uid())
- `start_date` (date) — first day of vacation
- `end_date` (date) — last day of vacation
- `reliever_name` (text) — name of the reliever covering the route
- `reliever_phone` (text) — reliever contact phone
- `notes` (text) — general notes for the reliever during this vacation period
- `created_at` (timestamptz)

### delivery_confirmations
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users, defaults to auth.uid())
- `store_id` (uuid, references stores, ON DELETE CASCADE)
- `delivery_date` (date) — the date the delivery was confirmed for
- `confirmed` (boolean, default false)
- `confirmed_at` (timestamptz) — when the confirmation was toggled
- `notes` (text) — optional notes about this delivery (e.g. "backroom was locked")
- Unique constraint on (store_id, delivery_date) to prevent duplicates

## Security (RLS)
- RLS enabled on all tables.
- All tables scoped to `authenticated` users with ownership checks via `auth.uid() = user_id`.
- `delivery_confirmations` ownership checked through the parent store's user_id.
- `profiles` table: users can read/update only their own profile row.
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
- `user_id` columns default to `auth.uid()` so inserts work even when the client omits user_id.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  company text,
  phone text,
  route_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Stores table
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  contact_name text,
  delivery_days text[] NOT NULL DEFAULT '{}',
  stop_order integer DEFAULT 0,
  special_instructions text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stores" ON stores;
CREATE POLICY "select_own_stores" ON stores FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_stores" ON stores;
CREATE POLICY "insert_own_stores" ON stores FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_stores" ON stores;
CREATE POLICY "update_own_stores" ON stores FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_stores" ON stores;
CREATE POLICY "delete_own_stores" ON stores FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Vacation periods table
CREATE TABLE IF NOT EXISTS vacation_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reliever_name text,
  reliever_phone text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vacation_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vacations" ON vacation_periods;
CREATE POLICY "select_own_vacations" ON vacation_periods FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vacations" ON vacation_periods;
CREATE POLICY "insert_own_vacations" ON vacation_periods FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vacations" ON vacation_periods;
CREATE POLICY "update_own_vacations" ON vacation_periods FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vacations" ON vacation_periods;
CREATE POLICY "delete_own_vacations" ON vacation_periods FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Delivery confirmations table
CREATE TABLE IF NOT EXISTS delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  delivery_date date NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  notes text,
  UNIQUE(store_id, delivery_date)
);

ALTER TABLE delivery_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_confirmations" ON delivery_confirmations;
CREATE POLICY "select_own_confirmations" ON delivery_confirmations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_confirmations" ON delivery_confirmations;
CREATE POLICY "insert_own_confirmations" ON delivery_confirmations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_confirmations" ON delivery_confirmations;
CREATE POLICY "update_own_confirmations" ON delivery_confirmations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_confirmations" ON delivery_confirmations;
CREATE POLICY "delete_own_confirmations" ON delivery_confirmations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_vacation_periods_user_id ON vacation_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_user_id ON delivery_confirmations(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_store_date ON delivery_confirmations(store_id, delivery_date);
