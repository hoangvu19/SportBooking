-- Add columns to support "share as a new post" feature
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'IsShare' AND Object_ID = Object_ID(N'dbo.Post'))
BEGIN
  ALTER TABLE Post ADD IsShare BIT NOT NULL CONSTRAINT DF_Post_IsShare DEFAULT(0);
END

IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'SharedFromPostID' AND Object_ID = Object_ID(N'dbo.Post'))
BEGIN
  ALTER TABLE Post ADD SharedFromPostID INT NULL;
END

IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'SharedNote' AND Object_ID = Object_ID(N'dbo.Post'))
BEGIN
  ALTER TABLE Post ADD SharedNote NVARCHAR(MAX) NULL;
END

-- Optionally add foreign key if Post table exists (safe to add if Post.Primary key PostID exists)
IF OBJECT_ID('dbo.Post','U') IS NOT NULL AND OBJECT_ID('dbo.FK_Post_SharedFrom','F') IS NULL
BEGIN
  ALTER TABLE Post WITH NOCHECK ADD CONSTRAINT FK_Post_SharedFrom FOREIGN KEY(SharedFromPostID) REFERENCES Post(PostID);
END
