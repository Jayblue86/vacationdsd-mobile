/*
# Add group avatar and accent color customization

## Overview
Adds two new columns to the groups table so the group leader can personalize
their group's appearance: an emoji avatar and an accent color. These are
displayed throughout the group views to give each group a unique identity.

## Changes
1. Adds `avatar_emoji` column (text, nullable, default '👥') to groups table.
2. Adds `accent_color` column (text, nullable, default 'emerald') to groups table.
3. Both columns are leader-controlled via the existing update_own_group RLS policy
   (only the creator can update the group row), so no new policies are needed.

## Important Notes
1. No new tables — just two nullable columns on the existing groups table.
2. No RLS policy changes — the existing update_own_group policy already
   restricts updates to the group creator (leader), which is exactly what
   we want for these settings.
3. Defaults are set so existing groups get a neutral avatar and the app's
   standard emerald accent without any action from the leader.
*/

ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_emoji text DEFAULT '👥';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS accent_color text DEFAULT 'emerald';
