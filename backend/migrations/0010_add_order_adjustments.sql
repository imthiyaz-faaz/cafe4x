-- Migration 0010: Add adjustment and discount columns to orders table
ALTER TABLE orders ADD COLUMN subtotal REAL;
ALTER TABLE orders ADD COLUMN adjustment_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0;
