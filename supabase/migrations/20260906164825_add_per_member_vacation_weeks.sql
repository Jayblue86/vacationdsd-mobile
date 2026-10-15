/*
# Add per-member vacation weeks allowance

## Overview
Previously, the group had a single `draft_rounds_total` that applied to every
member equally. Now the leader needs to set vacation weeks per member based
on how much each vendor pays the reliever (e.g. $50/week = 3 weeks,
$150/week = 6 weeks).

## Changes
1. Adds `vacation_weeks_allowed` column to group_members (integer, default 3).
2. The leader sets this per member in the Draft tab before starting the draft.
3. The draft engine uses each member's individual allowance to determine
   when they've picked all their weeks, rather than a single global round count.

## Important Notes
1. No new tables — just one column on the existing group_members table.
2. No RLS policy changes — the existing update_own_membership policy allows
   users to update their own row, and the existing delete_membership_leader
   policy allows the leader to manage members. We add a new policy allowing
   the group leader to update any member's vacation_weeks_allowed.
3. The old `draft_rounds_total` on the groups table remains as a fallback
   default for new members, but the per-member value takes precedence.
*/

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS vacation_weeks_allowed integer NOT NULL DEFAULT 3;

-- Allow group leader to update member rows (for setting vacation_weeks_allowed)
-- The existing update_own_membership only allows self-updates. We need
-- the leader to be able to update other members' vacation_weeks_allowed.
DROP POLICY IF EXISTS "update_membership_leader" ON group_members;
CREATE POLICY "update_membership_leader" ON group_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  );
