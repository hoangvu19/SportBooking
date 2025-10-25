-- Migration Tối Ưu: Booking Post Feature (Giảm dư thừa, tận dụng bảng có sẵn)
-- Phân tích: Đã có Post, Booking, SportType, Comment, Account
-- Chỉ cần thêm những gì THẬT SỰ thiếu

USE [SportBookingDB];
GO

-- ============================================
-- 1. Thêm cột cho bảng Post (thay vì tạo bảng BookingPost riêng)
-- ============================================
-- Thêm cột BookingID vào Post để đánh dấu đây là "bài đăng sau khi đặt sân"
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'Post' AND COLUMN_NAME = 'BookingID')
BEGIN
    ALTER TABLE [dbo].[Post] ADD 
        [BookingID] INT NULL,
        CONSTRAINT FK_Post_Booking FOREIGN KEY (BookingID) REFERENCES Booking(BookingID) ON DELETE SET NULL;
    
    PRINT '✅ Added BookingID column to Post table';
END
ELSE
    PRINT '⚠️  BookingID column already exists in Post table';
GO

-- Thêm cột SportTypeID vào Post để phân loại theo môn thể thao
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'Post' AND COLUMN_NAME = 'SportTypeID')
BEGIN
    ALTER TABLE [dbo].[Post] ADD 
        [SportTypeID] INT NULL,
        CONSTRAINT FK_Post_SportType FOREIGN KEY (SportTypeID) REFERENCES SportType(SportTypeID);
    
    PRINT '✅ Added SportTypeID column to Post table';
END
ELSE
    PRINT '⚠️  SportTypeID column already exists in Post table';
GO

-- Thêm các cột quản lý người chơi
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'Post' AND COLUMN_NAME = 'MaxPlayers')
BEGIN
    ALTER TABLE [dbo].[Post] ADD 
        [MaxPlayers] INT NULL,
        [CurrentPlayers] INT NULL,
        [IsAutoHidden] BIT DEFAULT 0,
        [HiddenAt] DATETIME NULL;
    
    PRINT '✅ Added player management columns to Post table';
END
ELSE
    PRINT '⚠️  Player management columns already exist in Post table';
GO

-- ============================================
-- 2. Bảng PostPlayer - Quản lý người chơi (CHỈ CẦN BẢNG NÀY THÊM MỚI)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PostPlayer')
BEGIN
    CREATE TABLE [dbo].[PostPlayer] (
        [PostPlayerID] INT IDENTITY(1,1) PRIMARY KEY,
        [PostID] INT NOT NULL,
        [PlayerID] INT NOT NULL,
        [Status] NVARCHAR(20) DEFAULT 'Pending', -- Pending, Accepted, Rejected
        [InvitedAt] DATETIME DEFAULT GETDATE(),
        [RespondedAt] DATETIME NULL,
        CONSTRAINT FK_PostPlayer_Post FOREIGN KEY (PostID) REFERENCES Post(PostID) ON DELETE CASCADE,
        CONSTRAINT FK_PostPlayer_Account FOREIGN KEY (PlayerID) REFERENCES Account(AccountID),
        CONSTRAINT UQ_PostPlayer_Unique UNIQUE (PostID, PlayerID)
    );
    
    CREATE INDEX IX_PostPlayer_Status ON PostPlayer(Status);
    CREATE INDEX IX_PostPlayer_PostID ON PostPlayer(PostID);
    
    PRINT '✅ Created PostPlayer table';
END
ELSE
    PRINT '⚠️  PostPlayer table already exists';
GO

-- ============================================
-- 3. Bảng FacilityPolicy - Chính sách chủ sân (GIỮ NGUYÊN - THIẾT YẾU)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FacilityPolicy')
BEGIN
    CREATE TABLE [dbo].[FacilityPolicy] (
        [PolicyID] INT PRIMARY KEY IDENTITY(1,1),
        [FacilityID] INT NOT NULL UNIQUE,
        [CancellationPolicy] NVARCHAR(50) DEFAULT 'Flexible', -- Flexible, Moderate, Strict
        [ReschedulePolicy] NVARCHAR(50) DEFAULT 'Allowed', -- Allowed, NotAllowed, LimitedTimes
        [MinAdvanceBooking] INT DEFAULT 1, -- Tối thiểu đặt trước (giờ)
        [MaxAdvanceBooking] INT DEFAULT 720, -- Tối đa đặt trước (giờ)
        [DepositPercentage] DECIMAL(5,2) DEFAULT 30.00, -- % tiền cọc
        [RefundPercentage] DECIMAL(5,2) DEFAULT 0.00, -- % hoàn tiền khi hủy
        [CancellationDeadlineHours] INT DEFAULT 24, -- Hạn hủy (giờ trước giờ bắt đầu)
        [RescheduleDeadlineHours] INT DEFAULT 12, -- Hạn đổi lịch (giờ trước giờ bắt đầu)
        [AutoConfirmBooking] BIT DEFAULT 0, -- Tự động xác nhận booking
        [CreatedAt] DATETIME DEFAULT GETDATE(),
        [UpdatedAt] DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_FacilityPolicy_Facility FOREIGN KEY (FacilityID) REFERENCES Facility(FacilityID) ON DELETE CASCADE
    );
    
    PRINT '✅ Created FacilityPolicy table';
    
    -- Insert default policies cho facilities hiện có
    INSERT INTO FacilityPolicy (FacilityID, CancellationPolicy, ReschedulePolicy)
    SELECT FacilityID, 'Flexible', 'Allowed'
    FROM Facility
    WHERE FacilityID NOT IN (SELECT FacilityID FROM FacilityPolicy);
    
    PRINT '✅ Inserted default policies for existing facilities';
END
ELSE
    PRINT '⚠️  FacilityPolicy table already exists';
GO

-- ============================================
-- 4. Bảng ContentModerationLog - AI Moderation (GIỮ NGUYÊN - THIẾT YẾU)
-- ============================================
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ContentModerationLog')
BEGIN
    CREATE TABLE [dbo].[ContentModerationLog] (
        [LogID] INT PRIMARY KEY IDENTITY(1,1),
        [PostID] INT NULL,
        [CommentID] INT NULL,
        [Content] NVARCHAR(MAX),
        [IsClean] BIT DEFAULT 1,
        [Confidence] DECIMAL(3,2) DEFAULT 1.00,
        [Reason] NVARCHAR(500) NULL,
        [NeedsReview] BIT DEFAULT 0,
        [Flags] NVARCHAR(500) NULL, -- JSON array of flags
        [ReviewedBy] INT NULL, -- Admin who reviewed
        [ReviewedAt] DATETIME NULL,
        [FinalDecision] NVARCHAR(50) NULL, -- Approved, Rejected
        [CreatedAt] DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_ContentLog_Post FOREIGN KEY (PostID) REFERENCES Post(PostID) ON DELETE CASCADE,
        CONSTRAINT FK_ContentLog_Comment FOREIGN KEY (CommentID) REFERENCES Comment(CommentID) ON DELETE CASCADE,
        CONSTRAINT FK_ContentLog_Reviewer FOREIGN KEY (ReviewedBy) REFERENCES Account(AccountID)
    );
    
    CREATE INDEX IX_ContentModerationLog_NeedsReview ON ContentModerationLog(NeedsReview);
    
    PRINT '✅ Created ContentModerationLog table';
END
ELSE
    PRINT '⚠️  ContentModerationLog table already exists';
GO

-- ============================================
-- 5. XÓA BỎ: PostCategory và Post_Category (DƯ THỪA)
-- Lý do: Đã có SportTypeID trong Post để phân loại theo môn thể thao
-- Các category khác có thể dùng Status hoặc thêm 1 cột PostType nếu cần
-- ============================================
-- Nếu muốn phân loại đơn giản hơn, chỉ cần thêm 1 cột PostType vào Post:
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'Post' AND COLUMN_NAME = 'PostType')
BEGIN
    ALTER TABLE [dbo].[Post] ADD 
        [PostType] NVARCHAR(50) DEFAULT 'General'; -- General, BookingPost, FindPlayer, etc.
    
    PRINT '✅ Added PostType column to Post table (thay thế PostCategory)';
END
ELSE
    PRINT '⚠️  PostType column already exists in Post table';
GO

-- ============================================
-- 6. Thêm indexes để tăng hiệu suất
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Post_BookingID' AND object_id = OBJECT_ID('Post'))
BEGIN
    CREATE INDEX IX_Post_BookingID ON Post(BookingID);
    PRINT '✅ Created index IX_Post_BookingID';
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Post_SportTypeID' AND object_id = OBJECT_ID('Post'))
BEGIN
    CREATE INDEX IX_Post_SportTypeID ON Post(SportTypeID);
    PRINT '✅ Created index IX_Post_SportTypeID';
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Post_IsAutoHidden' AND object_id = OBJECT_ID('Post'))
BEGIN
    CREATE INDEX IX_Post_IsAutoHidden ON Post(IsAutoHidden) WHERE IsAutoHidden = 0;
    PRINT '✅ Created index IX_Post_IsAutoHidden';
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Post_PostType' AND object_id = OBJECT_ID('Post'))
BEGIN
    CREATE INDEX IX_Post_PostType ON Post(PostType);
    PRINT '✅ Created index IX_Post_PostType';
END;
GO

-- ============================================
-- 7. Stored Procedure để auto-hide expired booking posts
-- ============================================
IF OBJECT_ID('sp_AutoHideExpiredBookingPosts', 'P') IS NOT NULL
    DROP PROCEDURE sp_AutoHideExpiredBookingPosts;
GO

CREATE PROCEDURE sp_AutoHideExpiredBookingPosts
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Tìm các post có BookingID và booking đã hết hạn
        UPDATE p
        SET 
            p.IsAutoHidden = 1, 
            p.HiddenAt = GETDATE(),
            p.Status = 'Hidden'
        FROM Post p
        INNER JOIN Booking b ON p.BookingID = b.BookingID
        WHERE 
            b.EndTime < GETDATE() 
            AND p.IsAutoHidden = 0 
            AND p.Status = 'Visible'
            AND p.BookingID IS NOT NULL;
        
        DECLARE @affectedRows INT = @@ROWCOUNT;
        
        COMMIT TRANSACTION;
        
        PRINT CONCAT('✅ Auto-hidden ', @affectedRows, ' expired booking posts');
        RETURN @affectedRows;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        PRINT CONCAT('❌ Error in sp_AutoHideExpiredBookingPosts: ', @ErrorMessage);
        THROW;
    END CATCH
END;
GO

PRINT '✅ Created stored procedure sp_AutoHideExpiredBookingPosts';
GO

-- ============================================
-- 8. Tạo View để dễ query Booking Posts
-- ============================================
IF OBJECT_ID('vw_BookingPosts', 'V') IS NOT NULL
    DROP VIEW vw_BookingPosts;
GO

CREATE VIEW vw_BookingPosts AS
SELECT 
    p.PostID,
    p.AccountID,
    p.Content,
    p.CreatedDate,
    p.Status,
    p.BookingID,
    p.SportTypeID,
    p.MaxPlayers,
    p.CurrentPlayers,
    p.IsAutoHidden,
    p.HiddenAt,
    p.PostType,
    b.FieldID,
    b.StartTime,
    b.EndTime,
    b.Status AS BookingStatus,
    b.Deposit,
    b.TotalAmount,
    s.SportName,
    sf.FieldName,
    sf.RentalPrice,
    f.FacilityName,
    a.Username AS OwnerUsername,
    a.FullName AS OwnerFullName,
    a.AvatarUrl AS OwnerAvatar,
    (SELECT COUNT(*) FROM PostPlayer pp WHERE pp.PostID = p.PostID AND pp.Status = 'Accepted') AS AcceptedPlayers,
    (SELECT COUNT(*) FROM PostPlayer pp WHERE pp.PostID = p.PostID AND pp.Status = 'Pending') AS PendingPlayers
FROM Post p
INNER JOIN Booking b ON p.BookingID = b.BookingID
INNER JOIN SportType s ON p.SportTypeID = s.SportTypeID
INNER JOIN SportField sf ON b.FieldID = sf.FieldID
INNER JOIN Facility f ON sf.FacilityID = f.FacilityID
INNER JOIN Account a ON p.AccountID = a.AccountID
WHERE p.BookingID IS NOT NULL;
GO

PRINT '✅ Created view vw_BookingPosts';
GO

-- ============================================
-- 9. Sample data và verification
-- ============================================
PRINT '';
PRINT '========================================';
PRINT '✅ MIGRATION HOÀN TẤT - TỐI ƯU HÓA';
PRINT '========================================';
PRINT '';
PRINT '📊 So sánh với migration cũ:';
PRINT '   ❌ Migration cũ: 6 bảng mới';
PRINT '   ✅ Migration tối ưu: CHỈ 3 bảng mới';
PRINT '';
PRINT '🔧 Các thay đổi:';
PRINT '   ✅ Thêm cột vào Post (BookingID, SportTypeID, MaxPlayers, CurrentPlayers, IsAutoHidden, PostType)';
PRINT '   ✅ Bảng PostPlayer (quản lý người chơi)';
PRINT '   ✅ Bảng FacilityPolicy (chính sách chủ sân)';
PRINT '   ✅ Bảng ContentModerationLog (AI moderation)';
PRINT '   ✅ View vw_BookingPosts (query dễ dàng)';
PRINT '   ✅ Stored Procedure sp_AutoHideExpiredBookingPosts';
PRINT '   ✅ 6 indexes để tăng performance';
PRINT '';
PRINT '🚀 Next steps:';
PRINT '   1. Update models để sử dụng cấu trúc mới';
PRINT '   2. Update controllers để sử dụng View vw_BookingPosts';
PRINT '   3. Chạy sp_AutoHideExpiredBookingPosts định kỳ (cron job)';
PRINT '   4. Test API endpoints';
PRINT '';

-- Test query
PRINT '📝 Test query - Kiểm tra cấu trúc:';
SELECT 
    'Post' AS TableName,
    COUNT(*) AS RowCount,
    (SELECT COUNT(*) FROM Post WHERE BookingID IS NOT NULL) AS BookingPostsCount
FROM Post
UNION ALL
SELECT 'PostPlayer', COUNT(*), NULL FROM PostPlayer
UNION ALL
SELECT 'FacilityPolicy', COUNT(*), NULL FROM FacilityPolicy
UNION ALL
SELECT 'ContentModerationLog', COUNT(*), NULL FROM ContentModerationLog;
GO
