const { sql, poolPromise } = require("../../config/db");
const Post = require("../../models/Social/Post");

// Cache whether the ContentModerationLog table exists in the database
let _moderationTableExists = null;

async function checkModerationTable(pool) {
  try {
    if (_moderationTableExists !== null) return _moderationTableExists;
    const result = await pool.request().query("SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ContentModerationLog'");
    _moderationTableExists = (result && result.recordset && result.recordset[0] && result.recordset[0].cnt > 0) ? true : false;
  } catch (e) {
    // If the check fails, assume table does not exist to avoid breaking reads
    _moderationTableExists = false;
  }
  return _moderationTableExists;
}

class PostDAL {
  /**
   * Get all posts with pagination
   */
  static async getAll(page = 1, limit = 10) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT p.PostID, p.AccountID, p.Content, p.CreatedDate, p.Status,
                 a.Username, a.FullName, a.AvatarUrl
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.Status = 'Visible' AND a.Status = 'Active'
          ORDER BY p.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
      // Get images and reactions for each post
      const posts = await Promise.all(result.recordset.map(async (postData) => {
        const images = await PostDAL.getPostImages(postData.PostID);
        const reactions = await PostDAL.getPostReactions(postData.PostID);
        const postObj = new Post({
          ...postData,
          Images: images,
          Reactions: reactions
        });

        // If post references a BookingID, attach booking details (same as getById)
        try {
          if ((postData.BookingID || postData.Booking_BookingID) && !postObj.Booking) {
            const bid = postData.Booking_BookingID || postData.BookingID;
            const bookingRes = await pool.request()
              .input('BookingID', sql.Int, bid)
              .query(`
                SELECT b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit AS DepositPaid, b.Status,
                       sf.FieldName, f.FacilityName, st.SportName
                FROM Booking b
                JOIN SportField sf ON b.FieldID = sf.FieldID
                LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
                LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
                WHERE b.BookingID = @BookingID
              `);
            if (bookingRes && bookingRes.recordset && bookingRes.recordset[0]) {
              const bk = bookingRes.recordset[0];
              postObj.Booking = {
                BookingID: bk.BookingID,
                BookingStatus: bk.Status || 'Pending',
                FacilityName: bk.FacilityName,
                FieldName: bk.FieldName,
                SportName: bk.SportName,
                StartTime: bk.StartTime,
                EndTime: bk.EndTime,
                TotalAmount: bk.TotalAmount,
                DepositPaid: bk.DepositPaid
              };
            }
          }
        } catch (e) {
          console.debug('PostDAL.getByUserId: could not attach booking details', e && e.message ? e.message : e);
        }

        return postObj;
      }));
      
      return posts;
    } catch (error) {
      console.error('PostDAL.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get multiple posts by IDs (preserve order of ids argument)
   * Now uses getById to ensure booking data and shared posts are included
   */
  static async getByIds(postIds = []) {
    try {
      if (!Array.isArray(postIds) || postIds.length === 0) return [];
      
      // Use getById for each post to get full data including booking and shared posts
      const posts = await Promise.all(
        postIds.map(pid => PostDAL.getById(parseInt(pid), true).catch(err => {
          console.debug(`PostDAL.getByIds: Failed to get post ${pid}:`, err?.message);
          return null;
        }))
      );

      return posts.filter(Boolean);
    } catch (error) {
      console.error('PostDAL.getByIds error:', error);
      throw error;
    }
  }

  /**
   * Get post by ID
   */
  static async getById(postId, includeShared = false, _depth = 0, includeHidden = false) {
    try {
      const pool = await poolPromise;
      const moderationTable = await checkModerationTable(pool);

      let result;
      if (moderationTable) {
        result = await pool.request()
          .input('PostID', sql.Int, postId)
          .input('IncludeHidden', sql.Bit, includeHidden ? 1 : 0)
          .query(`
            SELECT p.*, a.Username, a.FullName, a.AvatarUrl,
              m.IsClean AS m_IsClean,
              m.NeedsReview AS m_NeedsReview,
              m.Flags AS m_Flags,
              m.Confidence AS m_Confidence,
              m.Reason AS m_Reason,
              m.CreatedAt AS m_CreatedAt
            FROM Post p
            JOIN Account a ON p.AccountID = a.AccountID
            OUTER APPLY (
              SELECT TOP 1 IsClean, NeedsReview, Flags, Confidence, Reason, CreatedAt
              FROM ContentModerationLog ml
              WHERE ml.PostID = p.PostID
              ORDER BY ml.CreatedAt DESC
            ) m
            WHERE p.PostID = @PostID AND (p.Status = 'Visible' OR @IncludeHidden = 1) AND a.Status = 'Active'
          `);
      } else {
        result = await pool.request()
          .input('PostID', sql.Int, postId)
          .input('IncludeHidden', sql.Bit, includeHidden ? 1 : 0)
          .query(`
            SELECT p.*, a.Username, a.FullName, a.AvatarUrl
            FROM Post p
            JOIN Account a ON p.AccountID = a.AccountID
            WHERE p.PostID = @PostID AND (p.Status = 'Visible' OR @IncludeHidden = 1) AND a.Status = 'Active'
          `);
      }

      if (result.recordset.length === 0) {
        return null;
      }

      const postData = result.recordset[0];

      // Get images and reactions
      const images = await PostDAL.getPostImages(postId);
      const reactions = await PostDAL.getPostReactions(postId);
      const commentsCount = await PostDAL.getCommentsCount(postId);
      const sharesCount = await PostDAL.getSharesCount(postId);

      const post = new Post({
        ...postData,
        Images: images,
        Reactions: reactions,
        CommentsCount: commentsCount,
        SharesCount: sharesCount
      });

      // Attach moderation metadata if present in the query
      try {
        if (typeof postData.m_IsClean !== 'undefined' && postData.m_IsClean !== null) {
          post.__moderation = {
            isClean: postData.m_IsClean === 1,
            needsReview: postData.m_NeedsReview === 1,
            flags: postData.m_Flags ? JSON.parse(postData.m_Flags) : [],
            confidence: postData.m_Confidence || null,
            reason: postData.m_Reason || null,
            timestamp: postData.m_CreatedAt || null
          };
        }
      } catch (e) { /* ignore parse errors */ }

      // If this post references a BookingID, attach booking details so frontend can render BookingStatusCard
      try {
        if ((postData.BookingID || postData.Booking_BookingID) && !post.Booking) {
          const bid = postData.Booking_BookingID || postData.BookingID;
          const bookingRes = await pool.request()
            .input('BookingID', sql.Int, bid)
            .query(`
              SELECT b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit AS DepositPaid, b.Status,
                     sf.FieldName, f.FacilityName, st.SportName
              FROM Booking b
              JOIN SportField sf ON b.FieldID = sf.FieldID
              LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
              LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
              WHERE b.BookingID = @BookingID
            `);
          if (bookingRes && bookingRes.recordset && bookingRes.recordset[0]) {
            const bk = bookingRes.recordset[0];
            post.Booking = {
              BookingID: bk.BookingID,
              BookingStatus: bk.Status || 'Pending',
              FacilityName: bk.FacilityName,
              FieldName: bk.FieldName,
              SportName: bk.SportName,
              StartTime: bk.StartTime,
              EndTime: bk.EndTime,
              TotalAmount: bk.TotalAmount,
              DepositPaid: bk.DepositPaid
            };
            // Try to enrich booking with facility images (same behaviour as feed/getPostsByUserId)
            try {
              const facilityLookup = await pool.request()
                .input('BookingID', sql.Int, bid)
                .query(`
                  SELECT sf.FieldID, f.FacilityID
                  FROM Booking b
                  JOIN SportField sf ON b.FieldID = sf.FieldID
                  LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
                  WHERE b.BookingID = @BookingID
                `);
              if (facilityLookup && facilityLookup.recordset && facilityLookup.recordset[0]) {
                const facRow = facilityLookup.recordset[0];
                const facilityId = facRow.FacilityID;
                if (facilityId) {
                  try {
                    const MediaAssetDAL = require('./MediaAssetDAL');
                    const facMedia = await MediaAssetDAL.getByTarget('Facility', facilityId);
                    if (Array.isArray(facMedia) && facMedia.length > 0) {
                      post.Booking.FacilityImage = facMedia.map(r => r.URL || r.Data).filter(Boolean)[0] || null;
                      post.Booking.FacilityImages = facMedia.map(r => r.URL || r.Data).filter(Boolean);
                    }
                  } catch (e) {
                    console.debug('PostDAL.getById: could not load Facility media', e && e.message ? e.message : e);
                  }
                }
              }
            } catch (e) {
              console.debug('PostDAL.getById: facility lookup failed', e && e.message ? e.message : e);
            }
          }
        }
      } catch (e) {
        console.debug('PostDAL.getById: could not attach booking details', e && e.message ? e.message : e);
      }

      // Preserve the raw SharedFromPostID for callers (useful to resolve root original)
      post.SharedFromPostID = postData.SharedFromPostID || null;

      // Optionally include the original post when this post is a share
      // Increased recursion limit to 5 to support deeper re-share chains (A->B->C->D->E)
      if (includeShared && post.IsShare && postData.SharedFromPostID && _depth < 5) {
        try {
          const original = await PostDAL.getById(postData.SharedFromPostID, true, _depth + 1);
          post.SharedPost = original ? original.toFrontendFormat() : null;
        } catch (e) {
          console.error(`PostDAL.getById: error loading SharedFromPostID=${postData.SharedFromPostID}:`, e && e.message ? e.message : e);
          post.SharedPost = null;
        }
      }

      return post;
    } catch (error) {
      console.error('❌ PostDAL.getById error:', error);
      throw error;
    }
  }

  /**
   * Get posts by user
   */
  static async getByUserId(accountId, page = 1, limit = 10) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      const moderationTable = await checkModerationTable(pool);
      let result;
      if (moderationTable) {
        result = await pool.request()
          .input('AccountID', sql.Int, accountId)
          .input('Offset', sql.Int, offset)
          .input('Limit', sql.Int, limit)
          .query(`
            SELECT p.PostID, p.AccountID, p.Content, p.CreatedDate, p.Status, p.IsShare, p.SharedFromPostID, p.SharedNote,
                   a.Username, a.FullName, a.AvatarUrl,
                   -- moderation
                   m.IsClean AS m_IsClean,
                   m.NeedsReview AS m_NeedsReview,
                   m.Flags AS m_Flags,
                   m.Confidence AS m_Confidence,
                   m.Reason AS m_Reason,
                   m.CreatedAt AS m_CreatedAt,
                   -- Booking info (if any)
                   b.BookingID AS Booking_BookingID,
                   b.Status AS BookingStatus,
                   b.StartTime,
                   b.EndTime,
                   b.TotalAmount,
                   b.Deposit AS DepositPaid,
                   sf.FieldName,
                   f.FacilityName,
                   st.SportName
            FROM Post p
            JOIN Account a ON p.AccountID = a.AccountID
            LEFT JOIN Booking b ON p.BookingID = b.BookingID
            OUTER APPLY (
              SELECT TOP 1 IsClean, NeedsReview, Flags, Confidence, Reason, CreatedAt
              FROM ContentModerationLog ml
              WHERE ml.PostID = p.PostID
              ORDER BY ml.CreatedAt DESC
            ) m
            LEFT JOIN SportField sf ON b.FieldID = sf.FieldID
            LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
            LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
            WHERE p.AccountID = @AccountID 
              AND p.Status = 'Visible' 
              AND a.Status = 'Active'
            ORDER BY p.CreatedDate DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
          `);
      } else {
        result = await pool.request()
          .input('AccountID', sql.Int, accountId)
          .input('Offset', sql.Int, offset)
          .input('Limit', sql.Int, limit)
          .query(`
            SELECT p.PostID, p.AccountID, p.Content, p.CreatedDate, p.Status, p.IsShare, p.SharedFromPostID, p.SharedNote,
                   a.Username, a.FullName, a.AvatarUrl,
                   -- Booking info (if any)
                   b.BookingID AS Booking_BookingID,
                   b.Status AS BookingStatus,
                   b.StartTime,
                   b.EndTime,
                   b.TotalAmount,
                   b.Deposit AS DepositPaid,
                   sf.FieldName,
                   f.FacilityName,
                   st.SportName
            FROM Post p
            JOIN Account a ON p.AccountID = a.AccountID
            LEFT JOIN Booking b ON p.BookingID = b.BookingID
            LEFT JOIN SportField sf ON b.FieldID = sf.FieldID
            LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
            LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
            WHERE p.AccountID = @AccountID 
              AND p.Status = 'Visible' 
              AND a.Status = 'Active'
            ORDER BY p.CreatedDate DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
          `);
      }
      
      // Get images and reactions for each post
      const posts = await Promise.all(result.recordset.map(async (postData) => {
        const images = await PostDAL.getPostImages(postData.PostID);
        const reactions = await PostDAL.getPostReactions(postData.PostID);
        // Attach booking + facility media (align behaviour with getFeedPosts)
        let booking = null;
        try {
          if ((postData.BookingID || postData.Booking_BookingID) && !booking) {
            const bid = postData.Booking_BookingID || postData.BookingID;
            const bookingRes = await pool.request()
              .input('BookingID', sql.Int, bid)
              .query(`
                SELECT b.BookingID, b.StartTime, b.EndTime, b.TotalAmount, b.Deposit AS DepositPaid, b.Status,
                       sf.FieldName, f.FacilityName, sf.FieldID, f.FacilityID, st.SportName
                FROM Booking b
                JOIN SportField sf ON b.FieldID = sf.FieldID
                LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
                LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
                WHERE b.BookingID = @BookingID
              `);
            if (bookingRes && bookingRes.recordset && bookingRes.recordset[0]) {
              const bk = bookingRes.recordset[0];
              booking = {
                BookingID: bk.BookingID,
                BookingStatus: bk.Status || 'Pending',
                FacilityName: bk.FacilityName,
                FacilityID: bk.FacilityID,
                FieldName: bk.FieldName,
                FieldID: bk.FieldID,
                SportName: bk.SportName,
                StartTime: bk.StartTime,
                EndTime: bk.EndTime,
                TotalAmount: bk.TotalAmount,
                DepositPaid: bk.DepositPaid
              };

              // enrich booking with facility images if available
              try {
                const facilityId = bk.FacilityID;
                if (facilityId) {
                  const MediaAssetDAL = require('./MediaAssetDAL');
                  const facMedia = await MediaAssetDAL.getByTarget('Facility', facilityId);
                  if (Array.isArray(facMedia) && facMedia.length > 0) {
                    booking.FacilityImage = facMedia.map(r => r.URL || r.Data).filter(Boolean)[0] || null;
                    booking.FacilityImages = facMedia.map(r => r.URL || r.Data).filter(Boolean);
                  }
                }
              } catch (e) {
                console.debug('PostDAL.getByUserId: could not load Facility media', e?.message || e);
              }
            }
          }
        } catch (e) {
          console.debug('PostDAL.getByUserId: could not attach booking details', e && e.message ? e.message : e);
        }

        // Build moderation metadata object if moderation log exists
        let moderationMeta = null;
        try {
          if (postData && (typeof postData.m_IsClean !== 'undefined' && postData.m_IsClean !== null)) {
            moderationMeta = {
              isClean: postData.m_IsClean === 1,
              needsReview: postData.m_NeedsReview === 1,
              flags: postData.m_Flags ? JSON.parse(postData.m_Flags) : [],
              confidence: postData.m_Confidence || null,
              reason: postData.m_Reason || null,
              timestamp: postData.m_CreatedAt || null
            };
          }
        } catch (e) { moderationMeta = null; }

        return new Post({
          ...postData,
          Images: images,
          Reactions: reactions,
          Booking: booking,
          __moderation: moderationMeta
        });
      }));
      
      return posts;
    } catch (error) {
      console.error('PostDAL.getByUserId error:', error);
      throw error;
    }
  }

  /**
   * Create new post
   */
  static async create(postData) {
    let transaction;
    try {
      const pool = await poolPromise;
      
      transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      
      const postResult = await transaction.request()
        .input('AccountID', sql.Int, postData.AccountID)
        .input('Content', sql.NVarChar, postData.Content)
        .input('IsShare', sql.Bit, 0)
        .input('SharedFromPostID', sql.Int, null)
        .input('SharedNote', sql.NVarChar, postData.SharedNote || null)
        .input('BookingID', sql.Int, postData.BookingID || null)
        .input('Status', sql.NVarChar(50), postData.Status || 'Visible')
        .query(`
          INSERT INTO Post (AccountID, Content, CreatedDate, Status, IsShare, SharedFromPostID, SharedNote, BookingID)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @Content, GETDATE(), @Status, @IsShare, @SharedFromPostID, @SharedNote, @BookingID)
        `);
      
      const newPost = postResult.recordset[0];
      
      // Insert images if provided (store in unified MediaAsset table for consolidation)
      const MediaAssetDAL = require('./MediaAssetDAL');

      // If callers passed raw files via multipart upload, process and store them in MediaAsset using the same transaction
      if (postData.files && Array.isArray(postData.files) && postData.files.length > 0) {
        await MediaAssetDAL.createFromFilesTx(postData.files, { targetType: 'Post', targetId: newPost.PostID, accountId: postData.AccountID }, transaction);
      }

      // Fallback: if ImageUrls (array of URLs or base64 strings) provided, insert them too
      if (postData.ImageUrls && postData.ImageUrls.length > 0) {
        for (const imageUrl of postData.ImageUrls) {
          // If imageUrl is a data URI or very long, store in Data (NVARCHAR(MAX)), otherwise store in URL (short)
          const isDataUri = typeof imageUrl === 'string' && imageUrl.startsWith('data:');
          const tooLongForUrl = typeof imageUrl === 'string' && imageUrl.length > 255;

          if (isDataUri || tooLongForUrl) {
            await transaction.request()
              .input('TargetType', sql.NVarChar(50), 'Post')
              .input('TargetID', sql.NVarChar(100), String(newPost.PostID))
              .input('URL', sql.NVarChar(255), null)
              .input('Data', sql.NVarChar(sql.MAX), imageUrl)
              .input('MediaType', sql.NVarChar(50), 'Image')
              .input('AccountID', sql.UniqueIdentifier, null)
              .query(`INSERT INTO MediaAsset (TargetType, TargetID, URL, Data, MediaType, UploadedDate, AccountID) VALUES (@TargetType, @TargetID, @URL, @Data, @MediaType, GETDATE(), @AccountID)`);
          } else {
            await transaction.request()
              .input('TargetType', sql.NVarChar(50), 'Post')
              .input('TargetID', sql.NVarChar(100), String(newPost.PostID))
              .input('URL', sql.NVarChar(255), imageUrl)
              .input('Data', sql.NVarChar(sql.MAX), null)
              .input('MediaType', sql.NVarChar(50), 'Image')
              .input('AccountID', sql.UniqueIdentifier, null)
              .query(`INSERT INTO MediaAsset (TargetType, TargetID, URL, Data, MediaType, UploadedDate, AccountID) VALUES (@TargetType, @TargetID, @URL, @Data, @MediaType, GETDATE(), @AccountID)`);
          }
        }
      }
      await transaction.commit();
      // Use getById but allow retrieving newly-inserted posts which may be non-visible
      const fullPost = await PostDAL.getById(newPost.PostID, false, 0, true);
      if (!fullPost) {
        // Fallback: build a minimal Post object from inserted row
        try {
          const images = await PostDAL.getPostImages(newPost.PostID);
          const reactions = await PostDAL.getPostReactions(newPost.PostID);
          return new Post({ ...newPost, Images: images, Reactions: reactions });
        } catch (e) {
          console.error('PostDAL.create fallback build failed', e);
          throw new Error(`getById(${newPost.PostID}) returned null after insert and fallback failed`);
        }
      }
      return fullPost;
    } catch (error) {
      console.error('❌ PostDAL.create error:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error number:', error.number);
      console.error('❌ Full error:', error);
      
      // Rollback transaction if it exists
      if (transaction) {
        try {
          await transaction.rollback();
          console.warn('⚠️  Transaction rolled back');
        } catch (rollbackError) {
          console.error('❌ Rollback error:', rollbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Update post
   */
  static async update(postId, postData) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('PostID', sql.Int, postId)
  .input('Content', sql.NVarChar, postData.Content)
        .query(`
          UPDATE Post 
          SET Content = @Content
          WHERE PostID = @PostID
        `);
      
      return await PostDAL.getById(postId);
    } catch (error) {
      console.error('PostDAL.update error:', error);
      throw error;
    }
  }

  /**
   * Delete post (soft delete)
   */
  static async delete(postId) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          UPDATE Post 
          SET Status = 'Deleted'
          WHERE PostID = @PostID
        `);
      
      return true;
    } catch (error) {
      console.error('PostDAL.delete error:', error);
      throw error;
    }
  }

  /**
   * Backward-compatible alias used by some controllers
   */
  static async deleteById(postId) {
    return await PostDAL.delete(postId);
  }

  /**
   * Get post images
   */
  static async getPostImages(postId) {
    try {
      const pool = await poolPromise;
      // Use unified MediaAsset table if available
      try {
        const MediaAssetDAL = require('./MediaAssetDAL');
        const rows = await MediaAssetDAL.getByTarget('Post', postId);
        return rows.map(r => r.URL || r.Data).filter(Boolean);
      } catch (e) {
        // Fallback to legacy PostImage table
        const result = await pool.request()
          .input('PostID', sql.Int, postId)
          .query(`
            SELECT ImageUrl, UploadedDate
            FROM PostImage
            WHERE PostID = @PostID
            ORDER BY UploadedDate
          `);
        return result.recordset.map(img => img.ImageUrl);
      }
    } catch (error) {
      console.error('PostDAL.getPostImages error:', error);
      throw error;
    }
  }

  /**
   * Get post reactions
   */
  static async getPostReactions(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT ReactionType, COUNT(*) as Count
          FROM Reaction
          WHERE PostID = @PostID
          GROUP BY ReactionType
        `);
      
      return result.recordset;
    } catch (error) {
      console.error('PostDAL.getPostReactions error:', error);
      throw error;
    }
  }

  /**
   * Get comments count
   */
  static async getCommentsCount(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT COUNT(*) as Count
          FROM Comment c
          JOIN Account a ON c.AccountID = a.AccountID
          WHERE c.PostID = @PostID AND a.Status = 'Active'
        `);
      
      return result.recordset[0].Count;
    } catch (error) {
      console.error('PostDAL.getCommentsCount error:', error);
      throw error;
    }
  }

  /**
   * Get shares count
   */
  static async getSharesCount(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT COUNT(*) as Count
          FROM Share s
          JOIN Account a ON s.AccountID = a.AccountID
          WHERE s.PostID = @PostID AND a.Status = 'Active'
        `);
      
      return result.recordset[0].Count;
    } catch (error) {
      console.error('PostDAL.getSharesCount error:', error);
      throw error;
    }
  }

  /**
   * Search posts
   */
  static async search(searchTerm, page = 1, limit = 10) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      
      const result = await pool.request()
        .input('SearchTerm', sql.NVarChar, `%${searchTerm}%`)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT p.*, a.Username, a.FullName, a.AvatarUrl
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.Content LIKE @SearchTerm 
          AND p.Status = 'Visible' AND a.Status = 'Active'
          ORDER BY p.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
      // Get images and reactions for each post
      const posts = await Promise.all(result.recordset.map(async (postData) => {
        const images = await PostDAL.getPostImages(postData.PostID);
        const reactions = await PostDAL.getPostReactions(postData.PostID);
        
        return new Post({
          ...postData,
          Images: images,
          Reactions: reactions
        });
      }));
      
      return posts;
    } catch (error) {
      console.error('PostDAL.search error:', error);
      throw error;
    }
  }

  /**
   * Get feed posts (for timeline/feed)
   */
  static async getFeedPosts(page = 1, limit = 10) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;
      // Fetch limit + 1 to check if there are more records
      const moderationTable = await checkModerationTable(pool);
      let result;
      if (moderationTable) {
        result = await pool.request()
          .input('Offset', sql.Int, offset)
          .input('Limit', sql.Int, limit + 1)
          .query(`
               SELECT p.PostID, p.AccountID, p.Content, p.CreatedDate, p.Status, p.IsShare, p.SharedFromPostID, p.SharedNote, p.BookingID,
                   a.Username, a.FullName, a.AvatarUrl,
                   -- Booking info (always get latest status from Booking table)
                   b.BookingID AS Booking_BookingID, 
                   b.Status AS BookingStatus, 
                   b.StartTime, 
                   b.EndTime, 
                   b.TotalAmount,
                   b.Deposit AS DepositPaid,
                   b.FieldID,
                   -- Field info
                   sf.FieldName,
                   -- Facility info
                   f.FacilityName,
                   f.FacilityID,
                   -- Sport type
                   st.SportName,
                   -- moderation
                   m.IsClean AS m_IsClean,
                   m.NeedsReview AS m_NeedsReview,
                   m.Flags AS m_Flags,
                   m.Confidence AS m_Confidence,
                   m.Reason AS m_Reason,
                   m.CreatedAt AS m_CreatedAt
            FROM Post p
            JOIN Account a ON p.AccountID = a.AccountID
            LEFT JOIN Booking b ON p.BookingID = b.BookingID
            OUTER APPLY (
              SELECT TOP 1 IsClean, NeedsReview, Flags, Confidence, Reason, CreatedAt
              FROM ContentModerationLog ml
              WHERE ml.PostID = p.PostID
              ORDER BY ml.CreatedAt DESC
            ) m
            LEFT JOIN SportField sf ON b.FieldID = sf.FieldID
            LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
            LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
            WHERE p.Status = 'Visible' AND a.Status = 'Active'
            ORDER BY p.CreatedDate DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
          `);
      } else {
        result = await pool.request()
          .input('Offset', sql.Int, offset)
          .input('Limit', sql.Int, limit + 1)
          .query(`
               SELECT p.PostID, p.AccountID, p.Content, p.CreatedDate, p.Status, p.IsShare, p.SharedFromPostID, p.SharedNote, p.BookingID,
                   a.Username, a.FullName, a.AvatarUrl,
                   -- Booking info (always get latest status from Booking table)
                   b.BookingID AS Booking_BookingID, 
                   b.Status AS BookingStatus, 
                   b.StartTime, 
                   b.EndTime, 
                   b.TotalAmount,
                   b.Deposit AS DepositPaid,
                   b.FieldID,
                   -- Field info
                   sf.FieldName,
                   -- Facility info
                   f.FacilityName,
                   f.FacilityID,
                   -- Sport type
                   st.SportName
            FROM Post p
            JOIN Account a ON p.AccountID = a.AccountID
            LEFT JOIN Booking b ON p.BookingID = b.BookingID
            LEFT JOIN SportField sf ON b.FieldID = sf.FieldID
            LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
            LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
            WHERE p.Status = 'Visible' AND a.Status = 'Active'
            ORDER BY p.CreatedDate DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
          `);
      }
      
      // Check if there are more records
      const hasMore = result.recordset.length > limit;
      
      // Only return limit records (remove the extra one)
      const recordsToProcess = hasMore ? result.recordset.slice(0, limit) : result.recordset;
      
      // Get images and reactions for each post
      const posts = await Promise.all(recordsToProcess.map(async (postData) => {
        const images = await PostDAL.getPostImages(postData.PostID);
        const likesResult = await pool.request()
          .input('PostID', sql.Int, postData.PostID)
          .query(`
            SELECT COUNT(*) as LikesCount
            FROM Reaction
            WHERE PostID = @PostID AND ReactionType = 'Like'
          `);
        
        const likesCount = likesResult.recordset[0].LikesCount || 0;
        
        // Build booking data if BookingID exists
        let booking = null;
        if (postData.BookingID || postData.Booking_BookingID) {
          booking = {
            BookingID: postData.Booking_BookingID || postData.BookingID,
            BookingStatus: postData.BookingStatus || 'Pending',
            FacilityName: postData.FacilityName || 'Cơ sở thể thao',
            FacilityID: postData.FacilityID,
            FieldName: postData.FieldName || 'Sân',
            FieldID: postData.FieldID,
            SportName: postData.SportName || 'Thể thao',
            StartTime: postData.StartTime,
            EndTime: postData.EndTime,
            TotalAmount: postData.TotalAmount || 0,
            DepositPaid: postData.DepositPaid || 0
          };
          
          // Enrich booking with facility images
          try {
            const facilityId = postData.FacilityID;
            if (facilityId) {
              const MediaAssetDAL = require('./MediaAssetDAL');
              const facMedia = await MediaAssetDAL.getByTarget('Facility', facilityId);
              if (Array.isArray(facMedia) && facMedia.length > 0) {
                booking.FacilityImage = facMedia.map(r => r.URL || r.Data).filter(Boolean)[0] || null;
                booking.FacilityImages = facMedia.map(r => r.URL || r.Data).filter(Boolean);
              }
            }
          } catch (e) {
            console.debug('PostDAL.getFeedPosts: could not load Facility media', e?.message || e);
          }
        }
        
        // if this post is a share, load original post to include as SharedPost
        let sharedPost = null;
        if (postData.IsShare) {
          try {
            if (!postData.SharedFromPostID) {
              // Defensive: log missing SharedFromPostID but continue
              console.warn(`PostDAL.getFeedPosts: PostID=${postData.PostID} marked as IsShare but SharedFromPostID is falsy`);
            } else {
              // Pass includeShared=true to recursively load the full shared_post chain with booking data
              const original = await PostDAL.getById(postData.SharedFromPostID, true);
              sharedPost = original ? original.toFrontendFormat() : null;
            }
          } catch (e) {
            // Detailed error logging to help debug malformed share records without crashing the feed
            console.error(`PostDAL.getFeedPosts: error loading shared post for PostID=${postData.PostID} SharedFromPostID=${postData.SharedFromPostID}:`, e && e.message ? e.message : e);
            sharedPost = null;
          }
        }

        // Build moderation metadata object if moderation log exists
        let moderationMeta = null;
        try {
          if (postData && (typeof postData.m_IsClean !== 'undefined' && postData.m_IsClean !== null)) {
            moderationMeta = {
              isClean: postData.m_IsClean === 1,
              needsReview: postData.m_NeedsReview === 1,
              flags: postData.m_Flags ? JSON.parse(postData.m_Flags) : [],
              confidence: postData.m_Confidence || null,
              reason: postData.m_Reason || null,
              timestamp: postData.m_CreatedAt || null
            };
          }
        } catch (e) { moderationMeta = null; }

        return new Post({
          ...postData,
          Images: images,
          Reactions: [{ ReactionType: 'Like', Count: likesCount }],
          // attach shared metadata so model->frontend can include it
          SharesCount: postData.SharesCount || 0,
          SharedPost: sharedPost,
          IsShare: !!postData.IsShare,
          SharedNote: postData.SharedNote || null,
          // attach booking data
          Booking: booking,
          // attach moderation meta for frontend
          __moderation: moderationMeta
        });
      }));
      
      // Return posts with hasMore flag
      return { posts, hasMore };
    } catch (error) {
      console.error('PostDAL.getFeedPosts error:', error);
      throw error;
    }
  }

  /**
   * Create a share-post: insert a new Post row marked as IsShare=1 and reference original post
   * Also create a Share record for tracking shares.
   */
  static async createSharePost({ accountId, originalPostId, note }) {
    let transaction;
    try {
      const pool = await poolPromise;
      // Ensure original post exists and is visible
      const original = await PostDAL.getById(originalPostId);
      if (!original) {
        const err = new Error(`Original post ${originalPostId} not found`);
        err.code = 'ORIGINAL_NOT_FOUND';
        throw err;
      }
      // If the post being shared is itself a share, resolve to the root original post
      // so re-shares always point to the initial source post (avoid multi-hop chains)
      let rootOriginalId = originalPostId;
      if (original.IsShare && original.SharedFromPostID) {
        rootOriginalId = original.SharedFromPostID;
      }
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Create new post marked as share
      const postResult = await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('Content', sql.NVarChar, note || '')
        .input('IsShare', sql.Bit, 1)
        .input('SharedFromPostID', sql.Int, rootOriginalId)
        .input('SharedNote', sql.NVarChar, note || null)
        .query(`
          INSERT INTO Post (AccountID, Content, CreatedDate, Status, IsShare, SharedFromPostID, SharedNote)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @Content, GETDATE(), 'Visible', @IsShare, @SharedFromPostID, @SharedNote)
        `);

      const newSharePost = postResult.recordset[0];

      // Insert into Share table for historical count and checking
      // Record the share against the root original post so share counts reflect the source
      await transaction.request()
        .input('AccountID', sql.Int, accountId)
        .input('PostID', sql.Int, rootOriginalId)
        .input('Note', sql.NVarChar, note || null)
        .query(`
          INSERT INTO Share (AccountID, PostID, Note, SharedDate)
          VALUES (@AccountID, @PostID, @Note, GETDATE())
        `);

      await transaction.commit();

  // Return the full post object including the original shared post
  const fullPost = await PostDAL.getById(newSharePost.PostID, true);
      return fullPost;
    } catch (error) {
      if (transaction) {
        try { await transaction.rollback(); } catch (e) { /* ignore */ }
      }
      // Map common SQL Server foreign key violation (e.g., referencing missing original post)
      // SQL Server error number for FK violation is 547
      if (error && (error.number === 547 || error.code === 'EREQUEST')) {
        const fkErr = new Error('Foreign key constraint failed while creating share post');
        fkErr.code = 'ORIGINAL_NOT_FOUND';
        fkErr.original = error;
        console.error('PostDAL.createSharePost FK error -> mapping to ORIGINAL_NOT_FOUND:', error.message || error);
        throw fkErr;
      }
      console.error('PostDAL.createSharePost error:', error);
      throw error;
    }
  }

  /**
   * Get posts by user ID (for user profile)
   */
  static async getPostsByUserId(userId, limit = 10, page = 1) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;

      const result = await pool.request()
        .input('AccountID', sql.Int, userId)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT p.PostID, p.AccountID, p.Content, p.CreatedDate, p.Status, p.IsShare, p.SharedFromPostID, p.SharedNote,
                 a.Username, a.FullName, a.AvatarUrl,
                 -- Booking info (if any)
                 b.BookingID AS Booking_BookingID,
                 b.Status AS BookingStatus,
                 b.StartTime,
                 b.EndTime,
                 b.TotalAmount,
                 b.Deposit AS DepositPaid,
                 sf.FieldName,
                 f.FacilityName,
                 st.SportName
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          LEFT JOIN Booking b ON p.BookingID = b.BookingID
          LEFT JOIN SportField sf ON b.FieldID = sf.FieldID
          LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
          LEFT JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          WHERE p.AccountID = @AccountID 
            AND p.Status = 'Visible' 
            AND a.Status = 'Active'
          ORDER BY p.CreatedDate DESC
          OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
        `);
      
      // Get images and reactions for each post
      const posts = await Promise.all(result.recordset.map(async (postData) => {
        const images = await PostDAL.getPostImages(postData.PostID);
        const likesResult = await pool.request()
          .input('PostID', sql.Int, postData.PostID)
          .query(`
            SELECT COUNT(*) as LikesCount
            FROM Reaction
            WHERE PostID = @PostID AND ReactionType = 'Like'
          `);
        
        const likesCount = likesResult.recordset[0].LikesCount || 0;
        
        // If this post is a share, attempt to load the original for embedding (defensive)
        let sharedPost = null;
        if (postData.IsShare) {
          try {
            if (!postData.SharedFromPostID) {
              console.warn(`PostDAL.getPostsByUserId: PostID=${postData.PostID} marked as IsShare but SharedFromPostID is falsy`);
            } else {
              const original = await PostDAL.getById(postData.SharedFromPostID);
              sharedPost = original ? original.toFrontendFormat() : null;
            }
          } catch (e) {
            console.error(`PostDAL.getPostsByUserId: error loading shared post for PostID=${postData.PostID} SharedFromPostID=${postData.SharedFromPostID}:`, e && e.message ? e.message : e);
            sharedPost = null;
          }
        }

        // Build booking data if BookingID exists (normalize shape like getFeedPosts)
        let booking = null;
        if (postData.BookingID || postData.Booking_BookingID) {
          booking = {
            BookingID: postData.Booking_BookingID || postData.BookingID,
            BookingStatus: postData.BookingStatus || 'Pending',
            FacilityName: postData.FacilityName || 'Cơ sở thể thao',
            FieldName: postData.FieldName || 'Sân',
            SportName: postData.SportName || 'Thể thao',
            StartTime: postData.StartTime,
            EndTime: postData.EndTime,
            TotalAmount: postData.TotalAmount || 0,
            DepositPaid: postData.DepositPaid || 0
          };
          // enrich booking with facility images (align with getFeedPosts)
          try {
            const bid = postData.Booking_BookingID || postData.BookingID;
            const bookingRes = await pool.request()
              .input('BookingID', sql.Int, bid)
              .query(`
                SELECT sf.FieldID, f.FacilityID
                FROM Booking b
                JOIN SportField sf ON b.FieldID = sf.FieldID
                LEFT JOIN Facility f ON sf.FacilityID = f.FacilityID
                WHERE b.BookingID = @BookingID
              `);
            if (bookingRes && bookingRes.recordset && bookingRes.recordset[0]) {
              const bk2 = bookingRes.recordset[0];
              const facilityId = bk2.FacilityID;
              if (facilityId) {
                try {
                  const MediaAssetDAL = require('./MediaAssetDAL');
                  const facMedia = await MediaAssetDAL.getByTarget('Facility', facilityId);
                  if (Array.isArray(facMedia) && facMedia.length > 0) {
                    booking.FacilityImage = facMedia.map(r => r.URL || r.Data).filter(Boolean)[0] || null;
                    booking.FacilityImages = facMedia.map(r => r.URL || r.Data).filter(Boolean);
                  }
                } catch (e) {
                  console.debug('PostDAL.getPostsByUserId: could not load Facility media', e?.message || e);
                }
              }
            }
          } catch (e) {
            console.debug('PostDAL.getPostsByUserId: could not enrich booking with facility media', e?.message || e);
          }
        }

        return new Post({
          ...postData,
          Images: images,
          Reactions: [{ ReactionType: 'Like', Count: likesCount }],
          SharesCount: postData.SharesCount || 0,
          SharedPost: sharedPost,
          IsShare: !!postData.IsShare,
          SharedNote: postData.SharedNote || null,
          Booking: booking
        });
      }));
      
      return posts;
    } catch (error) {
      console.error('PostDAL.getPostsByUserId error:', error);
      throw error;
    }
  }

  /**
   * Get all posts with engagement metrics for AI recommendations
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of posts
   * @param {string} options.orderBy - 'recent' | 'popular'
   * @param {boolean} options.includeEngagement - Include likes/comments/shares count
   * @returns {Array} Posts with engagement data
   */
  static async getAllWithEngagement({ limit = 100, orderBy = 'recent', includeEngagement = true } = {}) {
    try {
      const pool = await poolPromise;
      
      const orderClause = orderBy === 'popular' 
        ? 'ORDER BY ReactionsCount DESC, CommentsCount DESC, p.CreatedDate DESC'
        : 'ORDER BY p.CreatedDate DESC';
      
      const result = await pool.request()
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT TOP (@Limit)
                 p.PostID,
                 p.AccountID,
                 p.Content,
                 p.CreatedDate,
                 p.Status,
                 p.BookingID,
                 a.Username,
                 a.FullName,
                 a.AvatarUrl,
                 ${includeEngagement ? `
                 ISNULL((SELECT COUNT(*) FROM Reaction r WHERE r.PostID = p.PostID), 0) as ReactionsCount,
                 ISNULL((SELECT COUNT(*) FROM Comment c WHERE c.PostID = p.PostID), 0) as CommentsCount,
                 ISNULL((SELECT COUNT(*) FROM Share s WHERE s.PostID = p.PostID), 0) as SharesCount,
                 ` : ''}
                 -- Try to get SportTypeID from booking
                 (SELECT TOP 1 sf.SportTypeID 
                  FROM Booking b 
                  JOIN SportField sf ON b.FieldID = sf.FieldID 
                  WHERE b.BookingID = p.BookingID) as SportTypeID,
                 -- Try to get FacilityID from booking
                 (SELECT TOP 1 sf.FacilityID 
                  FROM Booking b 
                  JOIN SportField sf ON b.FieldID = sf.FieldID 
                  WHERE b.BookingID = p.BookingID) as FacilityID
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.Status = 'Visible' AND a.Status = 'Active'
          ${orderClause}
        `);
      
      return result.recordset.map(row => ({
        PostID: row.PostID,
        AccountID: row.AccountID,
        Content: row.Content,
        CreatedDate: row.CreatedDate,
        Status: row.Status,
        BookingID: row.BookingID,
        Username: row.Username,
        FullName: row.FullName,
        AvatarUrl: row.AvatarUrl,
        ReactionsCount: row.ReactionsCount || 0,
        CommentsCount: row.CommentsCount || 0,
        SharesCount: row.SharesCount || 0,
        SportTypeID: row.SportTypeID,
        FacilityID: row.FacilityID
      }));
    } catch (error) {
      console.error('PostDAL.getAllWithEngagement error:', error);
      throw error;
    }
  }

  /**
   * Get user's created posts (for building user profile)
   * @param {number} accountId 
   * @returns {Array} User's posts
   */
  static async getUserCreatedPosts(accountId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT p.PostID,
                 p.Content,
                 p.CreatedDate,
                 p.BookingID,
                 (SELECT TOP 1 sf.SportTypeID 
                  FROM Booking b 
                  JOIN SportField sf ON b.FieldID = sf.FieldID 
                  WHERE b.BookingID = p.BookingID) as SportTypeID,
                 (SELECT TOP 1 sf.FacilityID 
                  FROM Booking b 
                  JOIN SportField sf ON b.FieldID = sf.FieldID 
                  WHERE b.BookingID = p.BookingID) as FacilityID
          FROM Post p
          WHERE p.AccountID = @AccountID AND p.Status = 'Visible'
          ORDER BY p.CreatedDate DESC
        `);
      
      return result.recordset;
    } catch (error) {
      console.error('PostDAL.getUserCreatedPosts error:', error);
      throw error;
    }
  }
}

module.exports = PostDAL;
