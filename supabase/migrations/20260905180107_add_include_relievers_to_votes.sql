/*
# Add include_relievers column to group_votes

## Purpose
Allows the leader to decide per-vote whether relievers (members with role 'reliever')
are included in the vote. When excluded, relievers won't see the vote at all.
When included, they can vote like any other member.

## Changes
- Add `include_relievers` boolean column to `group_votes` (default true)
- When false, the RLS SELECT policy filters out the vote for users whose
  role in group_members is 'reliever'
- The INSERT policy on group_vote_responses also checks that the user
  is not a barred reliever

## Security
- No changes to existing RLS policies structure; the new column is used
  in the SELECT and INSERT predicates to enforce the leader's choice
  at the database level.
*/

ALTER TABLE group_votes
  ADD COLUMN IF NOT EXISTS include_relievers boolean NOT NULL DEFAULT true;

-- Update SELECT policy on group_votes to exclude barred relievers
DROP POLICY IF EXISTS "members_can_read_votes" ON group_votes;
CREATE POLICY "members_can_read_votes"
ON group_votes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_votes.group_id
    AND group_members.user_id = auth.uid()
    AND (
      group_votes.include_relievers = true
      OR group_members.role <> 'reliever'
    )
  )
);

-- Update INSERT policy on group_vote_responses to prevent barred relievers from voting
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
    AND (
      group_votes.include_relievers = true
      OR group_members.role <> 'reliever'
    )
  )
);