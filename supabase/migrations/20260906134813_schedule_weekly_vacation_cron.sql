/*
# Schedule weekly vacation notifications cron job

## Overview
Creates a pg_cron job that calls the weekly-vacation-notifications edge
function every Sunday at 9:00 AM UTC. This ensures notifications fire
when the vacation week starts, not when the vacation was scheduled.

## How it works
1. A cron job runs every Sunday at 9:00 AM UTC.
2. It uses pg_net to make an HTTP POST request to the edge function.
3. The edge function finds all vacations starting this week and creates
   celebratory notifications for group members and warm notes for solo
   relievers.

## Important Notes
1. The job is scheduled weekly (Sundays) so it catches all vacations
   starting during that week.
2. The edge function is idempotent — it checks for existing notifications
   before creating new ones, so re-runs don't create duplicates.
*/

-- Grant necessary permissions for pg_net
GRANT USAGE ON SCHEMA extensions TO postgres;
GRANT USAGE ON SCHEMA net TO postgres;

-- Schedule the weekly vacation notifications job
-- Runs every Sunday at 9:00 AM UTC
-- 0 = Sunday in pg_cron's dw field
SELECT cron.schedule(
  'weekly-vacation-notifications',
  '0 9 * * 0',
  $$
    SELECT net.http_post(
      url := 'https://nwmibplpdxqzsupabase.co/functions/v1/weekly-vacation-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bWlibHBwZHhxeiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzQwMDAwMDAwMCwiZXhwIjoxNzYwMDAwMDAwMH0.placeholder'}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
