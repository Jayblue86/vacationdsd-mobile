/*
# Vacation Draft System

## Overview
Transforms the group calendar into a draft-based system where members take
turns picking vacation weeks, ordered by seniority (join date). The group
leader starts a draft, members pick in snake-draft order, and the leader
can finalize when done.

## Modified Tables
### groups
- `draft_status` (text, default 'idle') — 'idle', 'active', or 'finalized'
- `draft_round` (int, default 1) — current round (1-based)
- `draft_current_index` (int, default 0) — index into the pick order for the current round
- `draft_rounds_total` (int, default 3) — how many rounds (vacation weeks per member)

### group_members
- `seniority_order` (int, default 0) — pick order position (0 = first pick).
  Set by the group leader; defaults to join order.

## Security
- group_members UPDATE policy already allows users to update their own row.
  We add a policy allowing the group creator to update any member's seniority_order.
- groups UPDATE policy already allows the creator to update the group.
*/

ALTER TABLE groups ADD COLUMN IF NOT EXISTS draft_status text NOT NULL DEFAULT 'idle';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS draft_round int NOT NULL DEFAULT 1;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS draft_current_index int NOT NULL DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS draft_rounds_total int NOT NULL DEFAULT 3;

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS seniority_order int NOT NULL DEFAULT 0;

-- Allow group creator to update member seniority
DROP POLICY IF EXISTS "update_membership_leader" ON group_members;
CREATE POLICY "update_membership_leader" ON group_members FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = group_members.group_id AND g.created_by = auth.uid()
    )
  );

-- Index for seniority ordering
CREATE INDEX IF NOT EXISTS idx_group_members_seniority ON group_members(group_id, seniority_order);
