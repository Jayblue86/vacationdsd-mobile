/*
# Add draft/confirmed status to group_calendar

## Overview
Adds a `status` column to the group_calendar table so members can propose
vacation weeks as drafts, then the group leader (or members themselves)
can confirm them when the annual schedule is finalized.

## Modified Tables
### group_calendar
- `status` (text, NOT NULL, default 'draft') — either 'draft' or 'confirmed'

## Security
- No security changes needed. The existing RLS policies on group_calendar
  already cover the new column since users can only modify their own entries.
*/

ALTER TABLE group_calendar ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
