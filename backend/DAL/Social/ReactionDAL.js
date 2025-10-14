/**
 * Reaction Data Access Layer (DAL)
 * Handles all database operations for Reaction entity
 */
const { sql, poolPromise } = require("../../config/db");
const Reaction = require("../../models/Social/ReactionClass");

class ReactionDAL {
  /**
   * Create or update reaction (like/love/etc.)
   */
  static async createOrUpdate(reactionData) {
    try {
      const pool = await poolPromise;
      
      console.log('📝 Creating/updating reaction:', {
        AccountID: reactionData.AccountID,
        PostID: reactionData.PostID,
        ReactionType: reactionData.ReactionType
      });

      // Check if reaction already exists
      const existingResult = await pool.request()
        .input("AccountID", sql.Int, reactionData.AccountID)
        .input("PostID", sql.Int, reactionData.PostID)
        .query(`
          SELECT ReactionID, ReactionType 
          FROM Reaction 
          WHERE AccountID = @AccountID AND PostID = @PostID
        `);

      if (existingResult.recordset.length > 0) {
        const existing = existingResult.recordset[0];
        
        // If same reaction type, remove it (toggle off)
        if (existing.ReactionType === reactionData.ReactionType) {
          await pool.request()
            .input("ReactionID", sql.Int, existing.ReactionID)
            .query("DELETE FROM Reaction WHERE ReactionID = @ReactionID");
          
          console.log('✅ Reaction removed (toggled off)');
          return {
            action: 'removed',
            reactionId: existing.ReactionID,
            reactionType: existing.ReactionType
          };
        } else {
          // Update to new reaction type
          await pool.request()
            .input("ReactionID", sql.Int, existing.ReactionID)
            .input("ReactionType", sql.VarChar, reactionData.ReactionType)
            .query(`
              UPDATE Reaction 
              SET ReactionType = @ReactionType, CreatedDate = GETDATE()
              WHERE ReactionID = @ReactionID
            `);
          
          console.log('✅ Reaction updated');
          return {
            action: 'updated',
            reactionId: existing.ReactionID,
            reactionType: reactionData.ReactionType
          };
        }
      } else {
        // Create new reaction
        const result = await pool.request()
          .input("AccountID", sql.Int, reactionData.AccountID)
          .input("PostID", sql.Int, reactionData.PostID)
          .input("ReactionType", sql.VarChar, reactionData.ReactionType)
          .query(`
            INSERT INTO Reaction (AccountID, PostID, ReactionType, CreatedDate)
            OUTPUT INSERTED.*
            VALUES (@AccountID, @PostID, @ReactionType, GETDATE())
          `);
        
        const newReaction = new Reaction(result.recordset[0]);
        console.log('✅ Reaction created:', newReaction.ReactionID);
        
        return {
          action: 'created',
          reactionId: newReaction.ReactionID,
          reactionType: newReaction.ReactionType
        };
      }
    } catch (error) {
      console.error('❌ ReactionDAL.createOrUpdate error:', error);
      throw error;
    }
  }

  /**
   * Get all reactions for a post
   */
  static async getByPostId(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("PostID", sql.Int, postId)
        .query(`
          SELECT r.*, a.Username, a.FullName, a.AvatarUrl
          FROM Reaction r
          JOIN Account a ON r.AccountID = a.AccountID
          WHERE r.PostID = @PostID
          ORDER BY r.ReactedDate DESC
        `);
      
      return result.recordset.map(row => new Reaction(row));
    } catch (error) {
      console.error('ReactionDAL.getByPostId error:', error);
      throw error;
    }
  }

  /**
   * Get reaction counts by type for a post
   */
  static async getCountsByPostId(postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("PostID", sql.Int, postId)
        .query(`
          SELECT ReactionType, COUNT(*) as Count
          FROM Reaction
          WHERE PostID = @PostID
          GROUP BY ReactionType
        `);
      
      return result.recordset;
    } catch (error) {
      console.error('ReactionDAL.getCountsByPostId error:', error);
      throw error;
    }
  }

  /**
   * Get user's reaction to a post
   */
  static async getUserReaction(accountId, postId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("AccountID", sql.Int, accountId)
        .input("PostID", sql.Int, postId)
        .query(`
          SELECT * FROM Reaction 
          WHERE AccountID = @AccountID AND PostID = @PostID
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new Reaction(result.recordset[0]);
    } catch (error) {
      console.error('ReactionDAL.getUserReaction error:', error);
      throw error;
    }
  }

  /**
   * Get all reactions by an account
   */
  static async getByAccountId(accountId) {
    try {
      const pool = await poolPromise;

      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT r.*, p.Title as PostTitle, p.PostID as PostID
          FROM Reaction r
          JOIN Post p ON r.PostID = p.PostID
          WHERE r.AccountID = @AccountID
          ORDER BY r.CreatedDate DESC
        `);

      return result.recordset.map(row => new Reaction(row));
    } catch (error) {
      console.error('ReactionDAL.getByAccountId error:', error);
      throw error;
    }
  }

  /**
   * Delete reaction
   */
  static async delete(reactionId) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input("ReactionID", sql.Int, reactionId)
        .query("DELETE FROM Reaction WHERE ReactionID = @ReactionID");
      
      return true;
    } catch (error) {
      console.error('ReactionDAL.delete error:', error);
      throw error;
    }
  }
}

module.exports = ReactionDAL;
