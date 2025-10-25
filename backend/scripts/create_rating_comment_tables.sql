-- ==========================================
-- Create Rating and FieldComment tables
-- Separates star ratings from comments
-- ==========================================

-- 1. Rating Table (1 rating per user per target)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Rating' AND xtype='U')
BEGIN
    CREATE TABLE Rating (
        RatingID INT IDENTITY(1,1) PRIMARY KEY,
        AccountID INT NOT NULL,
        TargetType VARCHAR(50) NOT NULL, -- 'Facility' or 'Field'
        TargetID INT NOT NULL,
        Rating INT NOT NULL CHECK (Rating >= 1 AND Rating <= 5),
        CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Ensure 1 rating per user per target
        CONSTRAINT UQ_Rating_User_Target UNIQUE (AccountID, TargetType, TargetID)
        -- Note: FK to Account will be added conditionally below if Account table exists
    );
    
    -- Indexes for better query performance
    CREATE INDEX IX_Rating_Target ON Rating(TargetType, TargetID);
    CREATE INDEX IX_Rating_Account ON Rating(AccountID);
    
    PRINT 'Table Rating created successfully';
END
ELSE
BEGIN
    PRINT 'Table Rating already exists';
END
GO

-- 2. FieldComment Table (multiple comments allowed per user)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FieldComment' AND xtype='U')
BEGIN
    CREATE TABLE FieldComment (
        CommentID INT IDENTITY(1,1) PRIMARY KEY,
        AccountID INT NOT NULL,
        TargetType VARCHAR(50) NOT NULL, -- 'Facility' or 'Field'
        TargetID INT NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedDate DATETIME NOT NULL DEFAULT GETDATE()
        -- Note: FK to Account will be added conditionally below if Account table exists
    );
    
    -- Indexes for better query performance
    CREATE INDEX IX_FieldComment_Target ON FieldComment(TargetType, TargetID, CreatedDate DESC);
    CREATE INDEX IX_FieldComment_Account ON FieldComment(AccountID);
    
    PRINT 'Table FieldComment created successfully';
END
ELSE
BEGIN
    PRINT 'Table FieldComment already exists';
END
GO

-- 3. Optional: Migrate existing Feedback data to new tables
-- Uncomment if you want to migrate old feedback data

/*
-- Migrate ratings from Feedback to Rating
INSERT INTO Rating (AccountID, TargetType, TargetID, Rating, CreatedDate, UpdatedDate)
SELECT DISTINCT
    AccountID,
    TargetType,
    TargetID,
    Rating,
    CreatedDate,
    CreatedDate as UpdatedDate
FROM Feedback
WHERE Rating > 0
AND NOT EXISTS (
    SELECT 1 FROM Rating r 
    WHERE r.AccountID = Feedback.AccountID 
    AND r.TargetType = Feedback.TargetType 
    AND r.TargetID = Feedback.TargetID
);

PRINT 'Migrated ratings from Feedback to Rating table';

-- Migrate comments from Feedback to FieldComment
INSERT INTO FieldComment (AccountID, TargetType, TargetID, Content, CreatedDate, UpdatedDate)
SELECT 
    AccountID,
    TargetType,
    TargetID,
    Content,
    CreatedDate,
    CreatedDate as UpdatedDate
FROM Feedback
WHERE Content IS NOT NULL AND LTRIM(RTRIM(Content)) <> '';

PRINT 'Migrated comments from Feedback to FieldComment table';
*/

PRINT 'Database schema update completed successfully';
GO

-- 4. Conditionally add foreign key constraints if Account table exists
IF OBJECT_ID('Account','U') IS NOT NULL
BEGIN
    -- Add FK for Rating if not already present
    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys fk WHERE fk.name = 'FK_Rating_Account'
    )
    BEGIN
        ALTER TABLE Rating
        ADD CONSTRAINT FK_Rating_Account FOREIGN KEY (AccountID)
            REFERENCES Account(AccountID) ON DELETE CASCADE;
    END

    -- Add FK for FieldComment if not already present
    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys fk WHERE fk.name = 'FK_FieldComment_Account'
    )
    BEGIN
        ALTER TABLE FieldComment
        ADD CONSTRAINT FK_FieldComment_Account FOREIGN KEY (AccountID)
            REFERENCES Account(AccountID) ON DELETE CASCADE;
    END

    PRINT 'Conditional foreign keys added (Account table found)';
END
ELSE
BEGIN
    PRINT 'Account table not found in this database; foreign keys were not added. You may add them manually after creating Account.';
END
GO
