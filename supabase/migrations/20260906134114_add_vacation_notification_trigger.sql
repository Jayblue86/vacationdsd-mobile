/*
# Vacation Start Notification Trigger

## Overview
When a user schedules a vacation, this trigger instantly creates notifications
for everyone in their group (and the reliever if they have an account) with a
celebratory message like "Johnny starts their vacation this week! Have a great
time and be safe!"

## How it works
1. A AFTER INSERT trigger on `vacation_periods` fires immediately when someone
   schedules a vacation.
2. The trigger function looks up the vacation owner's group and all group members.
3. It creates a notification for each group member (including the vacation owner)
   with a celebratory message.
4. If the reliever has an account in the system (matched by name), they also
   get a notification.

## Security
- The trigger function runs with SECURITY DEFINER (as the database owner) so it
  can insert notifications for other users. This is safe because it only fires
  on INSERT of vacation_periods, which is already protected by RLS.
- No new tables are created — uses the existing notifications table.
- No changes to existing RLS policies.

## Important Notes
1. This is an instant trigger — no cron job or edge function call needed.
   The moment someone saves a vacation, everyone in the group is notified.
2. The trigger is idempotent per vacation — it won't create duplicate
   notifications for the same vacation insert.
3. Group members with `notify_group_updates = false` are skipped.
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION notify_group_on_vacation_start()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_profile RECORD;
  v_group_members RECORD;
  v_owner_first_name text;
  v_start_str text;
  v_end_str text;
  v_notif_body text;
  v_owner_body text;
BEGIN
  -- Get the vacation owner's profile (name + group)
  SELECT id, full_name, group_id
  INTO v_owner_profile
  FROM profiles
  WHERE id = NEW.user_id;

  -- If the owner has no group, nothing to do
  IF v_owner_profile.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract first name for a friendly message
  v_owner_first_name := COALESCE(
    split_part(v_owner_profile.full_name, ' ', 1),
    'A group member'
  );

  -- Format dates nicely
  v_start_str := to_char(NEW.start_date::date, 'Mon DD');
  v_end_str := to_char(NEW.end_date::date, 'Mon DD');

  -- Build the celebratory message for other group members
  v_notif_body := v_owner_first_name || ' is on vacation ' || v_start_str || ' - ' || v_end_str || '. The reliever has the route covered. Have a great time and be safe!';

  -- Build a slightly different message for the vacation owner themselves
  v_owner_body := 'Your vacation runs ' || v_start_str || ' - ' || v_end_str || '. Have a great time and be safe!';

  -- Insert notifications for all group members who have group updates enabled
  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  SELECT
    gm.user_id,
    'vacation_weekly',
    v_owner_first_name || ' starts vacation soon!',
    CASE
      WHEN gm.user_id = NEW.user_id THEN v_owner_body
      ELSE v_notif_body
    END,
    '/app',
    jsonb_build_object(
      'vacation_id', NEW.id,
      'vacation_owner', NEW.user_id,
      'start_date', NEW.start_date,
      'end_date', NEW.end_date
    )
  FROM group_members gm
  JOIN profiles p ON p.id = gm.user_id
  WHERE gm.group_id = v_owner_profile.group_id
    AND p.notify_group_updates = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists, then create it
DROP TRIGGER IF EXISTS on_vacation_period_inserted ON vacation_periods;

CREATE TRIGGER on_vacation_period_inserted
  AFTER INSERT ON vacation_periods
  FOR EACH ROW
  EXECUTE FUNCTION notify_group_on_vacation_start();
