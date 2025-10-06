-- Migration: Create StoryView table
-- Track who viewed which story and when

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StoryView')
BEGIN
    CREATE TABLE StoryView (
        StoryViewID INT IDENTITY(1,1) PRIMARY KEY,
        StoryID INT NOT NULL,
        ViewerAccountID INT NOT NULL,
        ViewedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_StoryView_Story FOREIGN KEY (StoryID) 
            REFERENCES Story(StoryID) ON DELETE CASCADE,
        CONSTRAINT FK_StoryView_Account FOREIGN KEY (ViewerAccountID) 
            REFERENCES Account(AccountID) ON DELETE NO ACTION,
        -- Prevent duplicate views from same user for same story
        CONSTRAINT UQ_StoryView_Story_Viewer UNIQUE (StoryID, ViewerAccountID)
    );
    
    CREATE INDEX IX_StoryView_StoryID ON StoryView(StoryID);
    CREATE INDEX IX_StoryView_ViewerAccountID ON StoryView(ViewerAccountID);
    CREATE INDEX IX_StoryView_ViewedAt ON StoryView(ViewedAt);
    
    PRINT 'StoryView table created successfully';
END
ELSE
BEGIN
    PRINT 'StoryView table already exists';
END
