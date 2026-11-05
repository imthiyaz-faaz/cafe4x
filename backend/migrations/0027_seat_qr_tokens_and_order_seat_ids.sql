-- Migration: 0027_seat_qr_tokens_and_order_seat_ids.sql
-- Description:
-- 1. Add permanent, unique, unpredictable qr_token column to seats table.
-- 2. Backfill existing seats with unique random QR tokens and permanent customer order_urls.
-- 3. Add unique index on seats(qr_token).
-- 4. Add seat_id foreign key / reference column to orders table.
-- 5. Add index on orders(seat_id).
-- 6. Backfill orders.seat_id and orders.seat with authoritative seat identifiers (e.g. OFFICE-0001, ROOM-0001).

-- Step 1: Add qr_token column to seats table
ALTER TABLE seats ADD COLUMN qr_token TEXT;

-- Step 2: Backfill unique unpredictable tokens for all existing seats
UPDATE seats
SET qr_token = 'seat_' || lower(hex(randomblob(10)))
WHERE qr_token IS NULL OR qr_token = '';

-- Step 3: Update seats.order_url to use the unique permanent qr_token
UPDATE seats
SET order_url = '/' || COALESCE((SELECT short_code FROM organizations WHERE id = seats.organization_id), 'FTS') || '/order/' || qr_token
WHERE qr_token IS NOT NULL;

-- Step 4: Create unique index on seats(qr_token)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_qr_token ON seats(qr_token);

-- Step 5: Add seat_id column to orders table
ALTER TABLE orders ADD COLUMN seat_id TEXT;

-- Step 6: Create index on orders(seat_id)
CREATE INDEX IF NOT EXISTS idx_orders_seat_id ON orders(seat_id);

-- Step 7: Backfill existing orders with exact seat_id from seats table
UPDATE orders
SET seat_id = (
  SELECT s.id
  FROM seats s
  WHERE s.location_id = orders.location_id
    AND (
      s.id = orders.seat
      OR s.number = orders.seat
      OR s.number = printf('%02d', CAST(orders.seat AS INTEGER))
    )
  LIMIT 1
)
WHERE seat_id IS NULL OR seat_id = '';

-- Step 8: Update orders.seat to hold the authoritative seat identifier (e.g. OFFICE-0001) instead of generic numbers
UPDATE orders
SET seat = seat_id
WHERE seat_id IS NOT NULL AND seat_id != '';

