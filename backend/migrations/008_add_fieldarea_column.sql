-- Migration: Add FieldArea column to SportField table
-- Purpose: Store field zone information (A1, A2, B1, B2, etc.)
-- Date: 2025-10-14

-- Step 1: Add FieldArea column
ALTER TABLE SportField
ADD FieldArea NVARCHAR(10) NULL;

-- Step 2: Add check constraint for valid area values
ALTER TABLE SportField
ADD CONSTRAINT CHK_FieldArea 
CHECK (FieldArea IN ('A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'D1', 'D2', 'D3') OR FieldArea IS NULL);

-- Step 3: Update existing records with sample data
-- Note: You should update these based on your actual field organization
UPDATE SportField SET FieldArea = 'A1' WHERE FieldID % 9 = 1;
UPDATE SportField SET FieldArea = 'A2' WHERE FieldID % 9 = 2;
UPDATE SportField SET FieldArea = 'A3' WHERE FieldID % 9 = 3;
UPDATE SportField SET FieldArea = 'B1' WHERE FieldID % 9 = 4;
UPDATE SportField SET FieldArea = 'B2' WHERE FieldID % 9 = 5;
UPDATE SportField SET FieldArea = 'B3' WHERE FieldID % 9 = 6;
UPDATE SportField SET FieldArea = 'C1' WHERE FieldID % 9 = 7;
UPDATE SportField SET FieldArea = 'C2' WHERE FieldID % 9 = 8;
UPDATE SportField SET FieldArea = 'C3' WHERE FieldID % 9 = 0;

-- Step 4: Verify the changes
SELECT FieldID, FieldName, FieldArea, FieldType, Status
FROM SportField
ORDER BY FieldArea, FieldID;

PRINT 'Migration completed: FieldArea column added successfully';
