/*
# Add "just_pick" draft type for simultaneous free-for-all vacation picking

1. Changes
- Alter the `groups.draft_type` CHECK constraint to allow 'just_pick' alongside 'snake' and 'linear'.
- In "just_pick" mode, all members pick simultaneously (no turn order). The draft ends when the leader manually finalizes it.
- Overlap detection is handled in the frontend: when two route owners pick the same week, the app alerts the group.

2. Important Notes
- This is a non-destructive ALTER — only the CHECK constraint is replaced, no data is lost.
- Existing groups keep their current draft_type values.
*/

ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_draft_type_check;

ALTER TABLE groups ADD CONSTRAINT groups_draft_type_check
  CHECK (draft_type IN ('snake', 'linear', 'just_pick'));
