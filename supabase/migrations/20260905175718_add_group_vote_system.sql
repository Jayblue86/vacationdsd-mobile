/*
# Add Group Vote System

## Purpose
Allows group leaders to create yes/no votes with a written note/question.
Members vote yes or no. Results (tally only) become visible to all members
after every member has cast their vote. Individual vote choices are never
revealed — only the aggregate counts.

## New Tables

### group_votes
- `id` (uuid, primary key)
- `group_id` (uuid, FK to groups, cascade delete)
- `created_by` (uuid, the leader who created the vote)
- `question` (text, the leader's note/question — what members are voting on)
- `status` (text: 'open' or 'closed'; closed when all votes are in)
- `yes_count` (int, default 0 — cached tally for quick reads)
- `no_count` (int, default 0 — cached tally for quick reads)
- `total_members` (int, number of members at creation time, used to determine when all votes are in)
- `created_at` (timestamptz, default now())
- `closed_at` (timestamptz, nullable — set when the vote closes)

### group_vote_responses
- `id` (uuid, primary key)
- `vote_id` (uuid, FK to group_votes, cascade delete)
- `user_id` (uuid, the member who voted)
- `vote` (text: 'yes' or 'no')
- `created_at` (timestamptz, default now())
- Unique constraint on (vote_id, user_id) — one vote per member per poll

## Security (RLS)

Both tables enable RLS. Policies scope access to authenticated group members:
- SELECT: any authenticated member of the group can read votes and their own response
- INSERT: the group leader can create votes; any group member can insert their own response
- UPDATE: only the leader can update vote status/tally (on close)
- DELETE: only the leader can delete a vote

Individual vote responses are readable only by the user who cast them
(to show "you voted yes/no"), but the aggregate is derived from cached
counts on the group_votes row, so no one can see how others voted.
*/

CREATE TABLE IF NOT EXISTS group_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  yes_count int NOT NULL DEFAULT 0,
  no_count int NOT NULL DEFAULT 0,
  total_members int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE group_votes ENABLE ROW LEVEL SECURITY;

-- Helper: is current user a member of the group that owns this vote?
DROP POLICY IF EXISTS "members_can_read_votes" ON group_votes;
CREATE POLICY "members_can_read_votes"
ON group_votes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_votes.group_id
    AND group_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "leader_can_insert_votes" ON group_votes;
CREATE POLICY "leader_can_insert_votes"
ON group_votes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_votes.group_id
    AND groups.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "leader_can_update_votes" ON group_votes;
CREATE POLICY "leader_can_update_votes"
ON group_votes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_votes.group_id
    AND groups.created_by = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_votes.group_id
    AND groups.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "leader_can_delete_votes" ON group_votes;
CREATE POLICY "leader_can_delete_votes"
ON group_votes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_votes.group_id
    AND groups.created_by = auth.uid()
  )
);

CREATE TABLE IF NOT EXISTS group_vote_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid NOT NULL REFERENCES group_votes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  vote text NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (vote_id, user_id)
);

ALTER TABLE group_vote_responses ENABLE ROW LEVEL SECURITY;

-- Members can read only their own response (to show "you voted X")
-- but NOT other members' responses — privacy is enforced here.
DROP POLICY IF EXISTS "members_can_read_own_response" ON group_vote_responses;
CREATE POLICY "members_can_read_own_response"
ON group_vote_responses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Any group member can cast their own vote
DROP POLICY IF EXISTS "members_can_insert_own_response" ON group_vote_responses;
CREATE POLICY "members_can_insert_own_response"
ON group_vote_responses FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_votes
    JOIN group_members ON group_members.group_id = group_votes.group_id
    WHERE group_votes.id = group_vote_responses.vote_id
    AND group_members.user_id = auth.uid()
    AND group_votes.status = 'open'
  )
);

-- No update or delete policies on responses — votes are immutable once cast.

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_group_votes_group_id ON group_votes(group_id);
CREATE INDEX IF NOT EXISTS idx_group_vote_responses_vote_id ON group_vote_responses(vote_id);