/*
# Fix weekly vacation notifications cron job URL and auth

## Overview
Updates the existing cron job to use the correct Supabase project URL
and anon key so it can successfully call the edge function.

## Changes
1. Unschedules the existing job with the wrong URL
2. Reschedules with the correct URL and anon key from the project env
*/

-- Remove the broken job
SELECT cron.unschedule('weekly-vacation-notifications');

-- Reschedule with correct URL and auth key
SELECT cron.schedule(
  'weekly-vacation-notifications',
  '0 9 * * 0',
  $$
    SELECT net.http_post(
      url := 'https://dnqrclffbqqfsquesqmb.supabase.co/functions/v1/weekly-vacation-notifications',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRucXJjbGZmYnFxZnNxdWVzcW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyODYzNDgsImV4cCI6MjEwMzg2MjM0OH0.sO1sVnTU4X6MTB5Q40aUWuWoq5iMgrAc9YJX7gsLyCk"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
