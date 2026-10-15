/*
# Allow relievers read-only access to vendor stores

## Overview
When a solo reliever is scheduled to cover a vendor's route, they need to see
that vendor's store list as a reference for their daily work. This migration
adds a SELECT policy on the `stores` table so an active reliever can read
stores belonging to any vendor they have an active relationship with.

## Security changes
- Adds a new SELECT policy `select_reliever_vendor_stores` on `stores`.
- The policy checks that an active `vendor_relationships` row exists where
  the current user is the reliever and the store owner is the vendor.
- No INSERT, UPDATE, or DELETE access is granted — relievers can only read.
- The existing owner-scoped policies remain unchanged.

## Important notes
1. This is strictly read-only for relievers. Vendors retain full CRUD on
   their own stores.
2. The relationship must be active (`is_active = true`) — deactivated
   relationships immediately revoke read access.
*/

DROP POLICY IF EXISTS "select_reliever_vendor_stores" ON stores;
CREATE POLICY "select_reliever_vendor_stores" ON stores FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM vendor_relationships
      WHERE vendor_relationships.vendor_id = stores.user_id
        AND vendor_relationships.reliever_id = auth.uid()
        AND vendor_relationships.is_active = true
    )
  );
