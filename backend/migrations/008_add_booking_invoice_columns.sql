-- Migration: Add missing columns to Booking and Invoice tables
-- Date: 2025-10-14
-- Description: Add TotalAmount to Booking and PaymentMethod to Invoice

-- Step 1: Add TotalAmount to Booking table
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Booking' 
    AND COLUMN_NAME = 'TotalAmount'
)
BEGIN
    ALTER TABLE Booking ADD TotalAmount DECIMAL(10, 2) NULL;
    PRINT 'TotalAmount column added to Booking table';
END
ELSE
BEGIN
    PRINT 'TotalAmount column already exists in Booking table';
END

-- Step 2: Add PaymentMethod to Invoice table
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Invoice' 
    AND COLUMN_NAME = 'PaymentMethod'
)
BEGIN
    ALTER TABLE Invoice ADD PaymentMethod VARCHAR(50) NULL;
    PRINT 'PaymentMethod column added to Invoice table';
END
ELSE
BEGIN
    PRINT 'PaymentMethod column already exists in Invoice table';
END

PRINT 'Migration completed successfully!';
