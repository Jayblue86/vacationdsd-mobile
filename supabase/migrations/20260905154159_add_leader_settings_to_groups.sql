/*
# Add leader-only settings to groups

1. New Columns on `groups`
- `draft_scheduled_at` (timestamptz, nullable): When the leader schedules the draft to go live. Null means no scheduled time.
- `pick_time_limit_hours` (integer, default 24): How many hours each member has to make their pick before being auto-skipped.
- `auto_skip_enabled` (boolean, default true): Whether members who exceed the pick time limit are automatically skipped.
- `draft_type` (text, default 'snake'): The draft format — 'snake' (reverses order each round) or 'linear' (same order every round).
- `allow_reliever_picks` (boolean, default true): Whether relievers participate in the draft or only vendors pick.

2. Security
- No new tables. Existing RLS policies on `groups` remain unchanged — only the group creator (leader) can update group settings, enforced by the existing UPDATE policy.
*/

DO $$ BEGIN
  ALTER TABLE groups ADD COLUMN draft_scheduled_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE groups ADD COLUMN pick_time_limit_hours integer NOT NULL DEFAULT 24;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE groups ADD COLUMN auto_skip_enabled boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE groups ADD COLUMN draft_type text NOT NULL DEFAULT 'snake' CHECK (draft_type IN ('snake', 'linear'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE groups ADD COLUMN allow_reliever_picks boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
