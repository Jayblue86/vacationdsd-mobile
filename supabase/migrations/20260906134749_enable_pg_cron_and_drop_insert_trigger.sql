/*
# Enable pg_cron for scheduled vacation notifications

## Overview
Enables the pg_cron extension and sets up a weekly cron job that calls the
weekly-vacation-notifications edge function every Sunday at 9am UTC. This
ensures group members get celebratory notifications when someone's vacation
week starts, not when they schedule it.

## Changes
1. Enables pg_cron extension (required for scheduled jobs)
2. Enables pg_net extension (required for cron to make HTTP calls to edge functions)
3. Creates a weekly cron job that calls the edge function every Sunday at 9am UTC

## Important Notes
1. The INSERT trigger from the previous migration is being dropped — we no
   longer notify at scheduling time. Instead, notifications fire when the
   vacation week actually starts.
2. The cron job calls the edge function which handles both group-side
   celebratory messages and solo-side warm notes.
*/

-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net (needed for cron to make HTTP requests to edge functions)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop the INSERT trigger — we no longer notify at scheduling time
DROP TRIGGER IF EXISTS on_vacation_period_inserted ON vacation_periods;
DROP FUNCTION IF EXISTS notify_group_on_vacation_start();
