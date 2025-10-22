/**
 * Post Data Access Layer (DAL)
 * Handles all database operations for Post entity
 */
const { sql, poolPromise } = require("../../config/db");
const Post = require("../../models/Social/Post");

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
        
        return new Post({
          ...postData,
          Images: images,
          Reactions: reactions
        });
      }));
      
      return posts;
    } catch (error) {
      console.error('PostDAL.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get multiple posts by IDs (preserve order of ids argument)
   */
  static async getByIds(postIds = []) {
    try {
      if (!Array.isArray(postIds) || postIds.length === 0) return [];
      const pool = await poolPromise;
      // Use table-valued parameter style via a temporary table approach
      const idsCsv = postIds.map(id => parseInt(id)).filter(Boolean).join(',');
      const result = await pool.request()
        .query(`
          SELECT p.*, a.Username, a.FullName, a.AvatarUrl
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.PostID IN (${idsCsv}) AND p.Status = 'Visible' AND a.Status = 'Active'
        `);

      const rowsById = {};
      result.recordset.forEach(r => { rowsById[r.PostID] = r; });

      const posts = await Promise.all(postIds.map(async (pid) => {
        const postData = rowsById[pid];
        if (!postData) return null;
        const images = await PostDAL.getPostImages(pid);
        const reactions = await PostDAL.getPostReactions(pid);
        const commentsCount = await PostDAL.getCommentsCount(pid);
        const sharesCount = await PostDAL.getSharesCount(pid);
        return new Post({ ...postData, Images: images, Reactions: reactions, CommentsCount: commentsCount, SharesCount: sharesCount });
      }));

      return posts.filter(Boolean);
    } catch (error) {
      console.error('PostDAL.getByIds error:', error);
      throw error;
    }
  }

  /**
   * Get post by ID
   */
  static async getById(postId, includeShared = false, _depth = 0) {
    try {
      const pool = await poolPromise;

      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT p.*, a.Username, a.FullName, a.AvatarUrl
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.PostID = @PostID AND p.Status = 'Visible' AND a.Status = 'Active'
        `);

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
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .input('Offset', sql.Int, offset)
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT p.*, a.Username, a.FullName, a.AvatarUrl
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
          WHERE p.AccountID = @AccountID AND p.Status = 'Visible' AND a.Status = 'Active'
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
        .query(`
          INSERT INTO Post (AccountID, Content, CreatedDate, Status, IsShare, SharedFromPostID, SharedNote, BookingID)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @Content, GETDATE(), 'Visible', @IsShare, @SharedFromPostID, @SharedNote, @BookingID)
        `);
      
      const newPost = postResult.recordset[0];
      
      // Insert images if provided
      if (postData.ImageUrls && postData.ImageUrls.length > 0) {
        for (const imageUrl of postData.ImageUrls) {
          await transaction.request()
            .input('PostID', sql.Int, newPost.PostID)
            .input('ImageUrl', sql.VarChar, imageUrl)
            .query(`
              INSERT INTO PostImage (PostID, ImageUrl, UploadedDate)
              VALUES (@PostID, @ImageUrl, GETDATE())
            `);
        }
      }
      await transaction.commit();
      const fullPost = await PostDAL.getById(newPost.PostID);
      
      if (!fullPost) {
        throw new Error(`getById(${newPost.PostID}) returned null after successful insert!`);
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
   * Get post images
   */
  static async getPostImages(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('PostID', sql.Int, postId)
        .query(`
          SELECT ImageUrl, UploadedDate
          FROM PostImage
          WHERE PostID = @PostID
          ORDER BY UploadedDate
        `);
      
      return result.recordset.map(img => img.ImageUrl);
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
        .input('SearchTerm', sql.VarChar, `%${searchTerm}%`)
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
      const result = await pool.request()
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
                 -- Field info
                 sf.FieldName,
                 -- Facility info
                 f.FacilityName,
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
            FieldName: postData.FieldName || 'Sân',
            SportName: postData.SportName || 'Thể thao',
            StartTime: postData.StartTime,
            EndTime: postData.EndTime,
            TotalAmount: postData.TotalAmount || 0,
            DepositPaid: postData.DepositPaid || 0
          };
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
          Booking: booking
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
                 a.Username, a.FullName, a.AvatarUrl
          FROM Post p
          JOIN Account a ON p.AccountID = a.AccountID
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

        return new Post({
          ...postData,
          Images: images,
          Reactions: [{ ReactionType: 'Like', Count: likesCount }],
          SharesCount: postData.SharesCount || 0,
          SharedPost: sharedPost,
          IsShare: !!postData.IsShare,
          SharedNote: postData.SharedNote || null
        });
      }));
      
      return posts;
    } catch (error) {
      console.error('PostDAL.getPostsByUserId error:', error);
      throw error;
    }
  }
}

module.exports = PostDAL;
