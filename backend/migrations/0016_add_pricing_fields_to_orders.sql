-- Migration: 0016_add_pricing_fields_to_orders.sql
-- Description: Adds subtotal, adjustment_amount, and discount to orders table

ALTER TABLE orders ADD COLUMN subtotal REAL;
ALTER TABLE orders ADD COLUMN adjustment_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0;
