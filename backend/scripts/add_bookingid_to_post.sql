-- Script để thêm BookingID column vào Post table
-- Run this SQL script in MSSQL Management Studio hoặc Azure Data Studio

-- Check nếu column chưa tồn tại thì thêm vào
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Post') AND name = 'BookingID'
)
BEGIN
    ALTER TABLE Post 
    ADD BookingID INT NULL;
    
    PRINT 'Added BookingID column to Post table';
END
ELSE
BEGIN
    PRINT 'BookingID column already exists in Post table';
END
GO

-- Thêm foreign key constraint (optional, nhưng recommended)
IF NOT EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_Post_Booking'
)
BEGIN
    ALTER TABLE Post
    ADD CONSTRAINT FK_Post_Booking 
    FOREIGN KEY (BookingID) REFERENCES Booking(BookingID);
    
    PRINT 'Added foreign key constraint FK_Post_Booking';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_Post_Booking already exists';
END
GO

-- Tạo index để tăng tốc query (optional, nhưng recommended)
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_Post_BookingID' AND object_id = OBJECT_ID('Post')
)
BEGIN
    CREATE INDEX IX_Post_BookingID ON Post(BookingID);
    
    PRINT 'Created index IX_Post_BookingID';
END
ELSE
BEGIN
    PRINT 'Index IX_Post_BookingID already exists';
END
GO

-- Verify changes
SELECT TOP 5 PostID, AccountID, Content, BookingID, CreatedDate 
FROM Post 
ORDER BY CreatedDate DESC;

PRINT 'Migration completed successfully!';
