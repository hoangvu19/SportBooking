const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class BookingPostDAL {
  static async createBookingPost(data) {
    const {
      accountId,
      bookingId,
      content,
      sportTypeId,
      maxPlayers = 10,
      images = []
    } = data;

    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Verify booking exists and has deposit
      const bookingResult = await transaction.request()
        .input('BookingID', sql.Int, bookingId)
        .query(`
          SELECT b.*, sf.SportTypeID 
          FROM Booking b
          JOIN SportField sf ON b.FieldID = sf.FieldID
          WHERE b.BookingID = @BookingID AND b.Deposit > 0
        `);

      if (bookingResult.recordset.length === 0) {
        throw new Error('Booking not found or deposit not paid');
      }

      const booking = bookingResult.recordset[0];
      const inferredSportTypeId = sportTypeId || booking.SportTypeID;

      // 2. Insert Post with BookingID (mark as booking post)
      const postResult = await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('Content', sql.NVarChar(sql.MAX), content)
        .input('Status', sql.NVarChar(50), 'Visible')
        .input('IsShare', sql.Bit, 0)
        .input('BookingID', sql.Int, bookingId)
        .input('SportTypeID', sql.Int, inferredSportTypeId)
        .input('MaxPlayers', sql.Int, maxPlayers)
        .input('CurrentPlayers', sql.Int, 1) // owner is first player
        .input('PostType', sql.NVarChar(50), 'BookingPost')
        .query(`
          INSERT INTO Post (
            AccountID, Content, Status, IsShare, 
            BookingID, SportTypeID, MaxPlayers, CurrentPlayers, PostType, 
            CreatedDate
          )
          OUTPUT INSERTED.PostID
          VALUES (
            @AccountID, @Content, @Status, @IsShare, 
            @BookingID, @SportTypeID, @MaxPlayers, @CurrentPlayers, @PostType, 
            GETDATE()
          )
        `);

      const postId = postResult.recordset[0].PostID;

      if (images && images.length > 0) {
        for (const imageUrl of images) {
          await transaction.request()
            .input('TargetType', sql.NVarChar(50), 'Post')
            .input('TargetID', sql.NVarChar(100), String(postId))
            .input('URL', sql.NVarChar(255), imageUrl)
            .input('Data', sql.NVarChar(sql.MAX), null)
            .input('MediaType', sql.NVarChar(50), 'Image')
            .input('AccountID', sql.Int, null)
            .query(`
              INSERT INTO MediaAsset (TargetType, TargetID, URL, Data, MediaType, UploadedDate, AccountID)
              VALUES (@TargetType, @TargetID, @URL, @Data, @MediaType, GETDATE(), @AccountID)
            `);
        }
      }

      // 4. Add owner to PostPlayer with status Accepted
      await transaction.request()
        .input('PostID', sql.Int, postId)
        .input('PlayerID', sql.Int, accountId)
        .input('Status', sql.NVarChar(50), 'Accepted')
        .query(`
          INSERT INTO PostPlayer (PostID, PlayerID, Status, InvitedAt, RespondedAt)
          VALUES (@PostID, @PlayerID, @Status, GETDATE(), GETDATE())
        `);

      await transaction.commit();

      return {
        success: true,
        postId,
        message: 'Booking post created successfully'
      };
    } catch (error) {
      if (transaction && !transaction.aborted) {
        try { await transaction.rollback(); } catch (e) { /* ignore */ }
      }
      throw error;
    }
  }

  static async addPlayerFromComment(postId, playerId, ownerId) {
    const pool = await poolPromise;

    try {
      // 1. Verify owner
      const ownerCheck = await pool.request()
        .input('PostID', sql.Int, postId)
        .input('OwnerID', sql.Int, ownerId)
        .query(`
          SELECT PostID FROM Post 
          WHERE PostID = @PostID 
            AND AccountID = @OwnerID 
            AND BookingID IS NOT NULL
        `);

      if (ownerCheck.recordset.length === 0) {
        throw new Error('Unauthorized or not a booking post');
      }

      // 2. Check if post is full
      const capacityCheck = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT MaxPlayers, CurrentPlayers 
          FROM Post 
          WHERE PostID = @PostID
        `);

      const { MaxPlayers, CurrentPlayers } = capacityCheck.recordset[0];
      if (CurrentPlayers >= MaxPlayers) {
        throw new Error('Post is full');
      }

      // 3. Check if player already invited
      const existingInvite = await pool.request()
        .input('PostID', sql.Int, postId)
        .input('PlayerID', sql.Int, playerId)
        .query(`
          SELECT PostPlayerID FROM PostPlayer 
          WHERE PostID = @PostID AND PlayerID = @PlayerID
        `);

      if (existingInvite.recordset.length > 0) {
        throw new Error('Player already invited');
      }

      // 4. Insert invitation
      await pool.request()
        .input('PostID', sql.Int, postId)
        .input('PlayerID', sql.Int, playerId)
        .input('Status', sql.NVarChar(50), 'Pending')
        .query(`
          INSERT INTO PostPlayer (PostID, PlayerID, Status, InvitedAt)
          VALUES (@PostID, @PlayerID, @Status, GETDATE())
        `);

      // 5. Create notification for player
      await pool.request()
        .input('RecipientID', sql.Int, playerId)
        .input('SenderID', sql.Int, ownerId)
        .input('Type', sql.NVarChar(50), 'player_invitation')
        .input('ContentID', sql.Int, postId)
        .input('Content', sql.NVarChar(sql.MAX), 'You are invited to join')
        .query(`
          INSERT INTO Notification (
            RecipientAccountID, SenderAccountID, Type, ContentID, Content, 
            IsRead, CreatedDate
          )
          VALUES (@RecipientID, @SenderID, @Type, @ContentID, @Content, 0, GETDATE())
        `);

      return { success: true, message: 'Player invited successfully' };
    } catch (error) {
      throw error;
    }
  }

  static async acceptInvitation(postId, playerId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // 1. Update status
      const updateResult = await transaction.request()
        .input('PostID', sql.Int, postId)
        .input('PlayerID', sql.Int, playerId)
        .query(`
          UPDATE PostPlayer
          SET Status = 'Accepted', RespondedAt = GETDATE()
          WHERE PostID = @PostID AND PlayerID = @PlayerID AND Status = 'Pending'
        `);

      if (updateResult.rowsAffected[0] === 0) {
        throw new Error('Invitation not found or already responded');
      }

      // 2. Increase CurrentPlayers
      await transaction.request()
        .input('PostID', sql.Int, postId)
        .query(`
          UPDATE Post
          SET CurrentPlayers = CurrentPlayers + 1
          WHERE PostID = @PostID
        `);

      // 3. Notify owner
      const ownerResult = await transaction.request()
        .input('PostID', sql.Int, postId)
        .query(`SELECT AccountID FROM Post WHERE PostID = @PostID`);

      const ownerId = ownerResult.recordset[0].AccountID;

      await transaction.request()
        .input('RecipientID', sql.Int, ownerId)
        .input('SenderID', sql.Int, playerId)
        .input('Type', sql.NVarChar(50), 'player_accepted')
        .input('ContentID', sql.Int, postId)
        .input('Content', sql.NVarChar(sql.MAX), 'Player has accepted the invitation')
        .query(`
          INSERT INTO Notification (
            RecipientAccountID, SenderAccountID, Type, ContentID, Content, 
            IsRead, CreatedDate
          )
          VALUES (@RecipientID, @SenderID, @Type, @ContentID, @Content, 0, GETDATE())
        `);

      await transaction.commit();

      return { success: true, message: 'Invitation accepted' };
    } catch (error) {
      if (transaction && !transaction.aborted) {
        try { await transaction.rollback(); } catch (e) { /* ignore */ }
      }
      throw error;
    }
  }

  static async rejectInvitation(postId, playerId) {
    const pool = await poolPromise;

    try {
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .input('PlayerID', sql.Int, playerId)
        .query(`
          UPDATE PostPlayer
          SET Status = 'Rejected', RespondedAt = GETDATE()
          WHERE PostID = @PostID AND PlayerID = @PlayerID AND Status = 'Pending'
        `);

      if (result.rowsAffected[0] === 0) {
        throw new Error('Invitation not found or already responded');
      }

      return { success: true, message: 'Invitation rejected' };
    } catch (error) {
      throw error;
    }
  }

  static async getPlayers(postId) {
    const pool = await poolPromise;

    try {
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT 
            pp.PostPlayerID,
            pp.Status,
            pp.InvitedAt,
            pp.RespondedAt,
            a.AccountID,
            a.Username,
            a.FullName,
            a.AvatarUrl
          FROM PostPlayer pp
          JOIN Account a ON pp.PlayerID = a.AccountID
          WHERE pp.PostID = @PostID
          ORDER BY 
            CASE pp.Status 
              WHEN 'Accepted' THEN 1
              WHEN 'Pending' THEN 2
              WHEN 'Rejected' THEN 3
            END,
            pp.InvitedAt ASC
        `);

      return result.recordset;
    } catch (error) {
      throw error;
    }
  }

  static async getBySportType(sportTypeId, limit = 20, offset = 0) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('SportTypeID', sql.Int, sportTypeId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
     SELECT p.*, b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit as DepositPaid,
       b.Status as BookingStatus,
       sf.FieldID, sf.FieldName, f.FacilityID, f.FacilityName, sf.SportTypeID,
       a.AccountID as OwnerAccountID, a.Username as OwnerUsername, a.FullName as OwnerFullName, a.AvatarUrl as OwnerAvatar
          FROM Post p
          JOIN Booking b ON p.BookingID = b.BookingID
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          LEFT JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.SportTypeID = @SportTypeID
            AND p.Status = 'Visible'
            AND p.IsAutoHidden = 0
            AND b.EndTime > GETDATE()
          ORDER BY p.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);

      return result.recordset;
    } catch (error) {
      console.error('Error fetching booking posts by sport type:', error.message);
      throw error;
    }
  }

  static async getAll(limit = 20, offset = 0) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT p.*, b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit as DepositPaid,
                 b.Status as BookingStatus,
                 sf.FieldName, f.FacilityName, sf.SportTypeID
          FROM Post p
          JOIN Booking b ON p.BookingID = b.BookingID
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE p.Status = 'Visible'
            AND p.IsAutoHidden = 0
            AND b.EndTime > GETDATE()
          ORDER BY p.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);

      return result.recordset;
    } catch (error) {
      console.error('Error fetching all booking posts:', error.message);
      throw error;
    }
  }

  static async getById(postId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT p.*, b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit as DepositPaid,
                 b.Status as BookingStatus,
                 sf.FieldID, sf.FieldName, f.FacilityID, f.FacilityName, sf.SportTypeID,
                 a.AccountID as OwnerAccountID, a.Username as OwnerUsername, a.FullName as OwnerFullName, a.AvatarUrl as OwnerAvatar
          FROM Post p
          JOIN Booking b ON p.BookingID = b.BookingID
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          LEFT JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.PostID = @PostID
        `);

      return result.recordset[0] || null;
    } catch (error) {
      console.error('Error fetching booking post by id:', error.message);
      throw error;
    }
  }

  static async getByBookingId(bookingId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('BookingID', sql.Int, bookingId)
        .query(`
          SELECT p.*, b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit as DepositPaid,
                 b.Status as BookingStatus,
                 sf.FieldID, sf.FieldName, f.FacilityID, f.FacilityName, sf.SportTypeID
          FROM Post p
          JOIN Booking b ON p.BookingID = b.BookingID
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE b.BookingID = @BookingID
        `);

      return result.recordset[0] || null;
    } catch (error) {
      console.error('Error fetching booking post by booking id:', error.message);
      throw error;
    }
  }

  static async autoHideExpiredPosts() {
    const pool = await poolPromise;

    try {
      const result = await pool.request()
        .execute('sp_AutoHideExpiredBookingPosts');

      return {
        success: true,
        hiddenCount: result.returnValue || 0
      };
    } catch (error) {
      console.error('Error auto-hiding expired posts:', error);
      throw error;
    }
  }

  static async getByUserId(userId, limit = 20, offset = 0) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('AccountID', sql.Int, userId)
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT p.*, b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit as DepositPaid,
                 b.Status as BookingStatus,
                 sf.FieldName, f.FacilityName, sf.SportTypeID
          FROM Post p
          JOIN Booking b ON p.BookingID = b.BookingID
          JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          WHERE p.AccountID = @AccountID
          ORDER BY p.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);

      return result.recordset;
    } catch (error) {
      console.error('Error fetching booking posts by user:', error.message);
      throw error;
    }
  }
}

module.exports = BookingPostDAL;
