/*
# Secure Vendor Invite Acceptance

## Overview
Adds a server-side function for accepting a vendor invitation. The browser cannot create a vendor relationship directly; the database verifies the signed-in email, atomically claims the pending invitation, and creates the relationship.

## Security
- The invitation token is single-use through an atomic status update.
- The signed-in user's email must match the invitation email.
- The function derives the vendor identity from `auth.uid()` and never trusts a client-supplied vendor ID.
- The function uses a fixed `search_path` and is callable only by authenticated users.
*/

CREATE OR REPLACE FUNCTION accept_vendor_invite(p_invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite vendor_invitations%ROWTYPE;
  v_email text;
  v_relationship_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE vendor_invitations
  SET status = 'accepted', accepted_at = now(), responded_at = now()
  WHERE invite_token = p_invite_token
    AND status = 'pending'
    AND lower(vendor_email) = lower(v_email)
  RETURNING * INTO v_invite;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite is invalid, expired, already used, or does not match this email';
  END IF;

  INSERT INTO vendor_relationships (reliever_id, vendor_id, invitation_id, vendor_name)
  VALUES (v_invite.reliever_id, auth.uid(), v_invite.id, v_invite.vendor_name)
  ON CONFLICT (reliever_id, vendor_id)
  DO UPDATE SET is_active = true, vendor_name = EXCLUDED.vendor_name
  RETURNING id INTO v_relationship_id;

  UPDATE profiles
  SET account_type = 'vendor'
  WHERE id = auth.uid();

  RETURN v_relationship_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION accept_vendor_invite(text) FROM anon;
GRANT EXECUTE ON FUNCTION accept_vendor_invite(text) TO authenticated;
