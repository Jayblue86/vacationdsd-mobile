/*
# Add vote deadlines + group forum (topics & messages)

## Part 1: Vote Deadlines
Adds a `deadline` timestamptz column to `group_votes` (nullable). When set,
the vote auto-closes at that time even if not all members have voted.
A cron-style check is done client-side on load; the leader can also
manually close. The deadline is optional.

## Part 2: Group Forum (Topics + Messages)
Creates two new tables for a forum-style group chat where any member
can create a topic thread and any member can reply.

### group_topics
- id (uuid, PK)
- group_id (uuid, FK to groups, cascade delete)
- created_by (uuid, the member who started the topic)
- title (text, the topic header / subject line)
- created_at (timestamptz, default now())

### group_messages
- id (uuid, PK)
- topic_id (uuid, FK to group_topics, cascade delete)
- user_id (uuid, the sender, defaults to auth.uid())
- body (text, the message content)
- created_at (timestamptz, default now())

## Security (RLS)
All tables enable RLS, scoped to authenticated group members:
- SELECT: any group member can read topics and messages
- INSERT: any group member can create topics and post messages
- DELETE: only the topic creator can delete their topic; only the
  message author can delete their own message
- No UPDATE policies (messages are immutable once posted)

The vote deadline column has no policy impact — it's just data.
*/

-- Part 1: Vote deadlines
ALTER TABLE group_votes
  ADD COLUMN IF NOT EXISTS deadline timestamptz;

-- Part 2: Forum tables
CREATE TABLE IF NOT EXISTS group_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE group_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_read_topics" ON group_topics;
CREATE POLICY "members_can_read_topics"
ON group_topics FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_topics.group_id
    AND group_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "members_can_insert_topics" ON group_topics;
CREATE POLICY "members_can_insert_topics"
ON group_topics FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = group_topics.group_id
    AND group_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "creator_can_delete_topics" ON group_topics;
CREATE POLICY "creator_can_delete_topics"
ON group_topics FOR DELETE
TO authenticated
USING (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES group_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_can_read_messages" ON group_messages;
CREATE POLICY "members_can_read_messages"
ON group_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM group_topics
    JOIN group_members ON group_members.group_id = group_topics.group_id
    WHERE group_topics.id = group_messages.topic_id
    AND group_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "members_can_insert_messages" ON group_messages;
CREATE POLICY "members_can_insert_messages"
ON group_messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_topics
    JOIN group_members ON group_members.group_id = group_topics.group_id
    WHERE group_topics.id = group_messages.topic_id
    AND group_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "author_can_delete_messages" ON group_messages;
CREATE POLICY "author_can_delete_messages"
ON group_messages FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_topics_group_id ON group_topics(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_topic_id ON group_messages(topic_id);

-- Enable realtime on all three tables
ALTER PUBLICATION supabase_realtime ADD TABLE group_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE group_vote_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE group_topics;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;