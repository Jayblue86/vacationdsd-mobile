/*
# Add city and state to profiles

## Overview
Adds city and state columns to the profiles table so vendors can be grouped
geographically. This helps VacationDSD identify where route owners are located
and facilitates forming local groups across the country.

## Modified Tables
### profiles
- `city` (text) — vendor's city
- `state` (text) — vendor's state (2-letter abbreviation)

## Security
- No security changes. The existing RLS policies on profiles already cover
  the new columns since they are owned by the same user.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
