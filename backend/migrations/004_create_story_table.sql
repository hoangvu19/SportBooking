-- Migration: Create Story table
-- Stories expire after 24 hours and can contain text or media
-- Note: ExpiresAt is a COMPUTED COLUMN that auto-calculates as CreatedDate + 24 hours

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Story')
BEGIN
    CREATE TABLE Story (
        StoryID INT IDENTITY(1,1) PRIMARY KEY,
        AccountID INT NOT NULL,
        Content NVARCHAR(500) NULL,
        MediaUrl NVARCHAR(MAX) NULL,
        MediaType VARCHAR(20) NULL, -- 'text', 'image', 'video'
        BackgroundColor VARCHAR(10) NULL, -- For text-only stories
        CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
        ExpiresAt AS DATEADD(HOUR, 24, CreatedDate), -- COMPUTED: CreatedDate + 24 hours
        Status VARCHAR(20) NOT NULL DEFAULT 'Active', -- 'Active', 'Expired', 'Deleted'
        ViewCount INT DEFAULT 0,
        CONSTRAINT FK_Story_Account FOREIGN KEY (AccountID) REFERENCES Account(AccountID) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Story_AccountID ON Story(AccountID);
    CREATE INDEX IX_Story_Status_ExpiresAt ON Story(Status, ExpiresAt);
    
    PRINT 'Story table created successfully';
END
ELSE
BEGIN
    PRINT 'Story table already exists';
END
GO
