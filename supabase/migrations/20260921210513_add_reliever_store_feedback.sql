/*
# Add reliever store feedback system

## Overview
When a solo reliever covers a vendor's route, they may encounter situations
at a particular store that the vendor needs to know about — e.g. "Still have
3 cases of backstock in store." This migration adds a feedback table so
relievers can leave per-store notes for the vendor. The feedback is
week-scoped (tied to the same week_start as delivery confirmations) so it
resets naturally each week. When the reliever submits feedback, a
notification row is inserted for the vendor so they see it in their
notification bell — even after the week has passed.

## New Table
- `reliever_store_feedback`
  - `id` (uuid, primary key)
  - `reliever_id` (uuid, references auth.users) — the reliever who wrote it
  - `vendor_id` (uuid, references auth.users) — the vendor who owns the store
  - `store_id` (uuid, references stores) — which store the feedback is about
  - `week_start` (date) — the Monday of the coverage week (same convention as
    reliever_delivery_confirmations)
  - `message` (text, not null) — the feedback text the reliever writes
  - `created_at` (timestamptz, default now())
  - UNIQUE (reliever_id, store_id, week_start) — one feedback per store per week

## Security (RLS)
- Relievers can INSERT and SELECT their own feedback
- Vendors can SELECT feedback for their stores
- No UPDATE or DELETE — feedback is immutable once submitted, preserving the
  audit trail for the vendor

## How the weekly reset works
Same as delivery confirmations: the app queries feedback filtered by the
current week's Monday. When a new week starts, no feedback rows exist for
that week_start yet. Old feedback remains in the database as historical
records but is not shown in the active week view.

## Notification on submit
The reliever's frontend inserts a notification row for the vendor
(user_id = vendor_id) with type 'reliever_feedback' so the vendor sees it
in their notification bell. The notification persists even after the week
ends, so the vendor can go back and read it later.
*/

CREATE TABLE IF NOT EXISTS reliever_store_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reliever_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reliever_id, store_id, week_start)
);

ALTER TABLE reliever_store_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_reliever_feedback" ON reliever_store_feedback;
CREATE POLICY "select_reliever_feedback" ON reliever_store_feedback FOR SELECT
  TO authenticated USING (
    reliever_id = auth.uid() OR vendor_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_reliever_feedback" ON reliever_store_feedback;
CREATE POLICY "insert_reliever_feedback" ON reliever_store_feedback FOR INSERT
  TO authenticated WITH CHECK (reliever_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rsf_reliever_week ON reliever_store_feedback(reliever_id, week_start);
CREATE INDEX IF NOT EXISTS idx_rsf_vendor_week ON reliever_store_feedback(vendor_id, week_start);
CREATE INDEX IF NOT EXISTS idx_rsf_store ON reliever_store_feedback(store_id);
