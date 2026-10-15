/*
# Restrict weekly delivery confirmations to an active reliever work week

The browser only shows the delivery control when the reliever has a gig in the
current Monday-through-Sunday week. This policy enforces the same rule at the
database boundary, and also verifies that the store belongs to the vendor.
Vendors cannot insert confirmations because reliever_id must equal auth.uid().
*/

DROP POLICY IF EXISTS "insert_reliever_confirmations" ON reliever_delivery_confirmations;
CREATE POLICY "insert_reliever_confirmations" ON reliever_delivery_confirmations FOR INSERT
  TO authenticated WITH CHECK (
    reliever_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM solo_gigs
      WHERE solo_gigs.reliever_id = auth.uid()
        AND solo_gigs.vendor_id = reliever_delivery_confirmations.vendor_id
        AND solo_gigs.status <> 'cancelled'
        AND solo_gigs.gig_date >= date_trunc('week', CURRENT_DATE)::date
        AND solo_gigs.gig_date < (date_trunc('week', CURRENT_DATE)::date + 7)
    )
    AND EXISTS (
      SELECT 1
      FROM stores
      WHERE stores.id = reliever_delivery_confirmations.store_id
        AND stores.user_id = reliever_delivery_confirmations.vendor_id
    )
  );
