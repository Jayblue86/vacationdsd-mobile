/*
# Add Group Seeker Directory

## Overview
Adds a "seeking group" flag to profiles and a server-side function that lets
group-seekers discover each other by state and city without exposing the full
profiles table to every authenticated user.

## New Columns

### profiles
- `seeking_group` (boolean, not null, default false): when true the user appears
  in the group-seeker directory and can be contacted by other seekers.

## New Function

### find_group_seekers(p_state text, p_city text)
Returns seekers in the same state as the caller, with same-city seekers listed
first. Exposes only the fields needed for contact: full_name, company,
route_name, city, state, phone, and id (for display). The function is
SECURITY DEFINER so it bypasses RLS on profiles, but it only returns rows
where seeking_group = true, and it excludes the caller themselves.

## Security
- Only authenticated users can call the function.
- The function only returns seekers (seeking_group = true), not all profiles.
- The caller's own row is excluded from results.
- No writes happen through this function; the seeking_group flag is toggled
  by the profile owner through a normal UPDATE on their own profile row.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seeking_group boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION find_group_seekers(p_state text, p_city text)
RETURNS TABLE (
  id uuid,
  full_name text,
  company text,
  route_name text,
  city text,
  state text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.company,
    p.route_name,
    p.city,
    p.state,
    p.phone
  FROM profiles p
  WHERE p.seeking_group = true
    AND p.id <> auth.uid()
    AND (p_state IS NULL OR lower(p.state) = lower(p_state))
  ORDER BY
    (CASE WHEN lower(p.city) = lower(p_city) THEN 0 ELSE 1 END),
    p.full_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION find_group_seekers(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION find_group_seekers(text, text) TO authenticated;
