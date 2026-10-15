/*
# Notification System + Draft Reminders

## Overview
Adds a notification system so users receive in-app reminders about upcoming
vacation draft events. Users can opt in/out of different notification types
via a settings panel. An edge function will run periodically to check for
upcoming drafts and create notification rows.

## Modified Tables
### profiles
- `notify_draft_reminders` (boolean, default true) — receive reminders about upcoming draft dates
- `notify_group_updates` (boolean, default true) — receive notifications when group info changes
- `notify_weekly_summary` (boolean, default false) — receive a weekly summary of the schedule

## New Tables
### notifications
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users, cascade delete) — the recipient
- `type` (text, not null) — 'draft_reminder', 'group_update', 'weekly_summary', 'general'
- `title` (text, not null) — short headline
- `body` (text) — longer description
- `link` (text) — optional in-app route to navigate to
- `read_at` (timestamptz, nullable) — when the user dismissed/read it; null = unread
- `created_at` (timestamptz, default now())
- `metadata` (jsonb) — extra context (e.g. group_id, draft_date, days_until)

### draft_schedule
- `id` (uuid, primary key)
- `group_id` (uuid, not null, references groups, cascade delete) — which group
- `draft_date` (date, not null) — when the draft starts
- `year` (int, not null) — which vacation year this draft covers
- `reminder_1month_sent` (boolean, default false) — 1-month reminder created
- `reminder_1week_sent` (boolean, default false) — 1-week reminder created
- `reminder_1day_sent` (boolean, default false) — 1-day reminder created
- `created_at` (timestamptz, default now())

## Security
### notifications
- RLS enabled, owner-scoped: users can only see/manage their own notifications
- SELECT, INSERT (for edge function via service role — but RLS still applies
  to authenticated), UPDATE (mark as read), DELETE policies

### draft_schedule
- RLS enabled, scoped to group members: anyone in the group can see the schedule
- Only group creator can INSERT/UPDATE/DELETE
*/

-- Add notification preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_draft_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_group_updates boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_weekly_summary boolean NOT NULL DEFAULT false;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Create draft_schedule table
CREATE TABLE IF NOT EXISTS draft_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  draft_date date NOT NULL,
  year int NOT NULL,
  reminder_1month_sent boolean NOT NULL DEFAULT false,
  reminder_1week_sent boolean NOT NULL DEFAULT false,
  reminder_1day_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE draft_schedule ENABLE ROW LEVEL SECURITY;

-- Group members can see the draft schedule
DROP POLICY IF EXISTS "select_draft_schedule" ON draft_schedule;
CREATE POLICY "select_draft_schedule" ON draft_schedule FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = draft_schedule.group_id AND gm.user_id = auth.uid()
    )
  );

-- Only group creator can manage draft schedule
DROP POLICY IF EXISTS "insert_draft_schedule" ON draft_schedule;
CREATE POLICY "insert_draft_schedule" ON draft_schedule FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = draft_schedule.group_id AND g.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_draft_schedule" ON draft_schedule;
CREATE POLICY "update_draft_schedule" ON draft_schedule FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = draft_schedule.group_id AND g.created_by = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = draft_schedule.group_id AND g.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_draft_schedule" ON draft_schedule;
CREATE POLICY "delete_draft_schedule" ON draft_schedule FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = draft_schedule.group_id AND g.created_by = auth.uid()
    )
  );

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_draft_schedule_group ON draft_schedule(group_id);
CREATE INDEX IF NOT EXISTS idx_draft_schedule_date ON draft_schedule(draft_date);
