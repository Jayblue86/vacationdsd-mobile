/*
# Add developer feedback table

1. Purpose
   Allows any authenticated VacationDSD member to submit feedback, bug reports,
   or feature suggestions to the developer. This is a one-way channel: users
   submit feedback and cannot read other users' submissions.

2. New Tables
   - `developer_feedback`
     - `id` (uuid, primary key)
     - `user_id` (uuid, not null, defaults to auth.uid() — links to the submitting user)
     - `category` (text, not null — one of: 'bug', 'feature', 'general', 'praise')
     - `message` (text, not null — the feedback body, max 2000 chars)
     - `page_context` (text, null — which dashboard/view the user was on when they submitted)
     - `created_at` (timestamptz, defaults to now())
     - `status` (text, defaults to 'new' — tracks whether the developer has reviewed it)

3. Security
   - RLS enabled on `developer_feedback`.
   - SELECT: users can read only their own feedback submissions.
   - INSERT: authenticated users can submit feedback (user_id defaults to auth.uid()).
   - UPDATE: users can update only their own feedback (e.g., withdraw it).
   - DELETE: users can delete only their own feedback.
   - No anon access — only authenticated members can submit feedback.

4. Indexes
   - `idx_developer_feedback_created_at` on `created_at DESC` for the developer's review queue.
   - `idx_developer_feedback_user_id` on `user_id` for users viewing their own submissions.
*/

CREATE TABLE IF NOT EXISTS developer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bug', 'feature', 'general', 'praise')),
  message text NOT NULL CHECK (length(message) <= 2000),
  page_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new'
);

ALTER TABLE developer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_feedback" ON developer_feedback;
CREATE POLICY "select_own_feedback"
ON developer_feedback FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_feedback" ON developer_feedback;
CREATE POLICY "insert_own_feedback"
ON developer_feedback FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_feedback" ON developer_feedback;
CREATE POLICY "update_own_feedback"
ON developer_feedback FOR UPDATE
TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_feedback" ON developer_feedback;
CREATE POLICY "delete_own_feedback"
ON developer_feedback FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_developer_feedback_created_at ON developer_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_feedback_user_id ON developer_feedback (user_id);
