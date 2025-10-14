-- Migration 006: create livestreams table (SQL Server compatible)
-- Stores live stream sessions metadata
IF NOT EXISTS (
    SELECT 1 FROM sys.objects 
    WHERE object_id = OBJECT_ID(N'[dbo].[Livestreams]') AND type IN (N'U')
)
BEGIN
    CREATE TABLE dbo.Livestreams (
        LivestreamID INT IDENTITY(1,1) PRIMARY KEY,
        AccountID INT NOT NULL,
        Title NVARCHAR(255) NULL,
        Description NVARCHAR(MAX) NULL,
        EmbedUrl NVARCHAR(1000) NULL,
        IsActive BIT DEFAULT 0,
        StartedAt DATETIME2 NULL,
        EndedAt DATETIME2 NULL,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
END
