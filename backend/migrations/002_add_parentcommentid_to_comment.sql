-- Add ParentCommentID to enable threaded replies
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'ParentCommentID' AND Object_ID = Object_ID(N'dbo.Comment'))
BEGIN
	ALTER TABLE Comment ADD ParentCommentID INT NULL;
END

-- Optionally create an index for faster lookups
IF NOT EXISTS(SELECT * FROM sys.indexes WHERE name = N'IX_Comment_ParentCommentID' AND object_id = OBJECT_ID(N'dbo.Comment'))
BEGIN
	CREATE INDEX IX_Comment_ParentCommentID ON Comment(ParentCommentID);
END
