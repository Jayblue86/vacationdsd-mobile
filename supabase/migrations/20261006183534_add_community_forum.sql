/*
# Add Community Forum — Nationwide Discussion Space

## Purpose
Creates a public forum where ALL authenticated users (group members, solo relievers, vendors, matchmakers, multi-route owners) across the entire country can discuss, share tips, and connect. This is separate from group-scoped chat — it's a nationwide community space.

## New Tables
1. `forum_categories` — Top-level discussion categories (e.g. "Reliever Tips", "Route Management", "General")
   - id (uuid PK)
   - name (text, unique, not null)
   - description (text)
   - display_order (int, default 0)
   - created_at (timestamptz)

2. `forum_topics` — Thread topics within a category
   - id (uuid PK)
   - category_id (uuid FK → forum_categories, ON DELETE CASCADE)
   - user_id (uuid, NOT NULL, DEFAULT auth.uid() — the thread author)
   - title (text, not null)
   - created_at (timestamptz)
   - pinned (boolean, default false)

3. `forum_posts` — Messages within a topic
   - id (uuid PK)
   - topic_id (uuid FK → forum_topics, ON DELETE CASCADE)
   - user_id (uuid, NOT NULL, DEFAULT auth.uid() — the post author)
   - body (text, not null)
   - created_at (timestamptz)

## Seed Data
- 4 default categories: General Discussion, Reliever Tips & Advice, Route Management, Holiday & Peak Season

## Security (RLS)
- All three tables: RLS enabled, TO authenticated only
- SELECT: any authenticated user can read (nationwide forum — everyone sees everything)
- INSERT: authenticated users can create topics/posts (user_id defaults to auth.uid())
- UPDATE: users can edit only their own posts
- DELETE: users can delete only their own posts/topics (topic author can delete their thread)
- No anon access — must be signed in

## Important Notes
1. user_id columns default to auth.uid() so frontend inserts that omit user_id succeed
2. Forum is visible to ALL authenticated users regardless of group or location
3. Topic deletion cascades to its posts; category deletion cascades to topics+posts
*/

-- Categories
CREATE TABLE IF NOT EXISTS forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_categories_read" ON forum_categories;
CREATE POLICY "forum_categories_read"
ON forum_categories FOR SELECT
TO authenticated USING (true);

-- Topics
CREATE TABLE IF NOT EXISTS forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  pinned boolean NOT NULL DEFAULT false
);

ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_topics_read" ON forum_topics;
CREATE POLICY "forum_topics_read"
ON forum_topics FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "forum_topics_insert" ON forum_topics;
CREATE POLICY "forum_topics_insert"
ON forum_topics FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_topics_delete_own" ON forum_topics;
CREATE POLICY "forum_topics_delete_own"
ON forum_topics FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Posts
CREATE TABLE IF NOT EXISTS forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forum_posts_read" ON forum_posts;
CREATE POLICY "forum_posts_read"
ON forum_posts FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "forum_posts_insert" ON forum_posts;
CREATE POLICY "forum_posts_insert"
ON forum_posts FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_posts_update_own" ON forum_posts;
CREATE POLICY "forum_posts_update_own"
ON forum_posts FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "forum_posts_delete_own" ON forum_posts;
CREATE POLICY "forum_posts_delete_own"
ON forum_posts FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at);

-- Seed default categories
INSERT INTO forum_categories (name, description, display_order) VALUES
  ('General Discussion', 'Anything and everything DSD-related. Introduce yourself, ask questions, or share what''s on your mind.', 0),
  ('Reliever Tips & Advice', 'Tips for relievers covering routes, handling unfamiliar stores, and working with route owners.', 1),
  ('Route Management', 'Best practices for managing your route, organizing stores, and planning vacation coverage.', 2),
  ('Holiday & Peak Season', 'Surviving the busy seasons — holiday routes, surge periods, and peak demand tips.', 3)
ON CONFLICT (name) DO NOTHING;