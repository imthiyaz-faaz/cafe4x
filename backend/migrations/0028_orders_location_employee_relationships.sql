-- Migration: 0028_orders_location_employee_relationships.sql
-- Description:
-- 1. Ensure orders table has proper indexes on organization_id, location_id, employee_id, and seat_id.
-- 2. Backfill any missing location_id or employee_id from seats or users table.
-- 3. Ensure order_items table has index on (order_id, organization_id).

-- Indexes for fast location-wise and employee-wise order aggregations
CREATE INDEX IF NOT EXISTS idx_orders_org_created ON orders(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_loc_created ON orders(location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_emp_created ON orders(employee_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_seat_created ON orders(seat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org_order ON order_items(organization_id, order_id);

-- Backfill missing location_id on orders from matching seat in seats table
UPDATE orders
SET location_id = (
  SELECT s.location_id 
  FROM seats s 
  WHERE s.organization_id = orders.organization_id 
    AND (s.id = orders.seat_id OR s.id = orders.seat OR s.number = orders.seat)
  LIMIT 1
)
WHERE (location_id IS NULL OR location_id = '') 
  AND EXISTS (
    SELECT 1 FROM seats s 
    WHERE s.organization_id = orders.organization_id 
      AND (s.id = orders.seat_id OR s.id = orders.seat OR s.number = orders.seat)
  );

-- Backfill missing location_name on orders from locations table
UPDATE orders
SET location_name = (
  SELECT l.name 
  FROM locations l 
  WHERE l.id = orders.location_id
  LIMIT 1
)
WHERE (location_name IS NULL OR location_name = '' OR location_name = 'Office')
  AND location_id IS NOT NULL 
  AND EXISTS (SELECT 1 FROM locations l WHERE l.id = orders.location_id);

-- Backfill missing employee_id on orders from users table by matching employee_name
UPDATE orders
SET employee_id = (
  SELECT u.id 
  FROM users u
  JOIN user_organizations uo ON u.id = uo.user_id
  WHERE uo.organization_id = orders.organization_id
    AND LOWER(u.name) = LOWER(orders.employee_name)
  LIMIT 1
)
WHERE (employee_id IS NULL OR employee_id = '')
  AND employee_name IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM users u
    JOIN user_organizations uo ON u.id = uo.user_id
    WHERE uo.organization_id = orders.organization_id
      AND LOWER(u.name) = LOWER(orders.employee_name)
  );

