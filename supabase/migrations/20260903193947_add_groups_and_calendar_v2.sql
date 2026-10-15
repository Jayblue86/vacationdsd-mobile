/*
# VACATIONDSD - Groups, Members, and Group Calendar

## Overview
Adds group management and a shared vacation calendar so DSD route owners can
form local groups, join via a code, and coordinate their vacation schedules
with a shared color-coded calendar. The reliever is also a member with their
own color and vacation entries.

## New Tables
### groups
- id, name (auto like "LA01"), city, state, join_code, created_by, created_at

### group_members
- id, group_id, user_id, display_name, color, role (owner/reliever), joined_at
- Unique (group_id, user_id)

### group_calendar
- id, group_id, user_id, week_start, week_end, notes, created_at
- Unique (group_id, user_id, week_start)

## Modified Tables
### profiles
- group_id (nullable, references groups)

## Security (RLS)
- groups: any authenticated can read; creator can update/delete.
- group_members: members can read; users insert own; creator can delete members.
- group_calendar: members can read all entries; users manage only their own.
*/

-- Groups table (must be created before ALTER TABLE profiles)
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  city text,
  state text,
  join_code text UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all_groups" ON groups;
CREATE POLICY "select_all_groups" ON groups FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_group" ON groups;
CREATE POLICY "insert_own_group" ON groups FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_own_group" ON groups;
CREATE POLICY "update_own_group" ON groups FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "delete_own_group" ON groups;
CREATE POLICY "delete_own_group" ON groups FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- Now add group_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  role text NOT NULL DEFAULT 'owner',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_group_members" ON group_members;
CREATE POLICY "select_group_members" ON group_members FOR SELECT
  TO authenticated USING (
    group_id IN (SELECT id FROM groups)
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_own_membership" ON group_members;
CREATE POLICY "insert_own_membership" ON group_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_membership" ON group_members;
CREATE POLICY "update_own_membership" ON group_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_membership_leader" ON group_members;
CREATE POLICY "delete_membership_leader" ON group_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups WHERE groups.id = group_members.group_id AND groups.created_by = auth.uid()
    )
  );

-- Group calendar table
CREATE TABLE IF NOT EXISTS group_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id, week_start)
);

ALTER TABLE group_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_group_calendar" ON group_calendar;
CREATE POLICY "select_group_calendar" ON group_calendar FOR SELECT
  TO authenticated USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_calendar" ON group_calendar;
CREATE POLICY "insert_own_calendar" ON group_calendar FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.user_id = auth.uid() AND gm.group_id = group_calendar.group_id
    )
  );

DROP POLICY IF EXISTS "update_own_calendar" ON group_calendar;
CREATE POLICY "update_own_calendar" ON group_calendar FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_calendar" ON group_calendar;
CREATE POLICY "delete_own_calendar" ON group_calendar FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_calendar_group_id ON group_calendar(group_id);
CREATE INDEX IF NOT EXISTS idx_group_calendar_user_id ON group_calendar(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON profiles(group_id);
