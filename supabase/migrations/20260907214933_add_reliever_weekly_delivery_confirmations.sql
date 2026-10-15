/*
# Add reliever weekly delivery confirmations

## Overview
When a solo reliever covers a vendor's route for the week, they need to mark
stores as delivered. Once marked, the confirmation stays visible to the vendor
for the entire week and automatically resets when the next week begins
(Monday at 00:00). This lets the vendor track the reliever's progress
throughout the coverage period.

## New Table
- `reliever_delivery_confirmations`
  - `reliever_id` (uuid, references auth.users) — the reliever who marked it
  - `vendor_id` (uuid, references auth.users) — the vendor whose store it is
  - `store_id` (uuid, references stores) — which store was delivered
  - `week_start` (date) — the Monday of the coverage week
  - `confirmed_at` (timestamptz) — when the reliever confirmed the delivery
  - UNIQUE constraint on (reliever_id, store_id, week_start) so each store
    can only be confirmed once per week

## Security (RLS)
- Relievers can INSERT and SELECT their own confirmations
- Vendors can SELECT confirmations for their own stores (to track progress)
- No UPDATE or DELETE — once confirmed, it stays confirmed until the week
  rolls over naturally (the next week simply has no row yet)

## How the weekly reset works
The app queries confirmations filtered by the current week's Monday date.
When a new week starts, there are no rows for that week_start yet, so all
stores appear unconfirmed. Last week's rows remain in the database as
historical records but are not shown.
*/

CREATE TABLE IF NOT EXISTS reliever_delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reliever_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reliever_id, store_id, week_start)
);

ALTER TABLE reliever_delivery_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_reliever_confirmations" ON reliever_delivery_confirmations;
CREATE POLICY "select_reliever_confirmations" ON reliever_delivery_confirmations FOR SELECT
  TO authenticated USING (
    reliever_id = auth.uid() OR vendor_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_reliever_confirmations" ON reliever_delivery_confirmations;
CREATE POLICY "insert_reliever_confirmations" ON reliever_delivery_confirmations FOR INSERT
  TO authenticated WITH CHECK (reliever_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rdc_reliever_week ON reliever_delivery_confirmations(reliever_id, week_start);
CREATE INDEX IF NOT EXISTS idx_rdc_vendor_week ON reliever_delivery_confirmations(vendor_id, week_start);
CREATE INDEX IF NOT EXISTS idx_rdc_store ON reliever_delivery_confirmations(store_id);
