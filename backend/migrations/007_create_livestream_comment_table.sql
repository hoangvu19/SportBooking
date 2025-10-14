-- Migration 007: create livestream comment table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LivestreamComment' AND xtype='U')
CREATE TABLE LivestreamComment (
  CommentID INT IDENTITY(1,1) PRIMARY KEY,
  LivestreamID INT NOT NULL,
  AccountID INT NOT NULL,
  Content NVARCHAR(MAX) NOT NULL,
  CreatedDate DATETIME DEFAULT GETDATE()
);

GO
