-- Migration 006: create livestreams table
-- Stores live stream sessions metadata
CREATE TABLE IF NOT EXISTS Livestreams (
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
