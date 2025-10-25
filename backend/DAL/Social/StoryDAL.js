/**
 * Story Data Access Layer (DAL)
 * Handles all database operations for Story entity
 */
const { sql, poolPromise } = require("../../config/db");
const Story = require("../../models/Social/Story");
const fs = require('fs');
const path = require('path');

class StoryDAL {
  /**
   * Create new story
   */
  static async create(storyData) {
    let transaction;
    try {
      const pool = await poolPromise;
      transaction = new sql.Transaction(pool);
      
      await transaction.begin();
      
      // Note: ExpiresAt is a computed column (CreatedDate + 24 hours), so we don't insert it
      const result = await transaction.request()
        .input('AccountID', sql.Int, storyData.AccountID)
        .input('Content', sql.NVarChar, storyData.Content || null)
        .input('MediaUrl', sql.NVarChar(sql.MAX), storyData.MediaUrl || null)
        .input('MediaType', sql.VarChar, storyData.MediaType || 'text')
        .input('BackgroundColor', sql.VarChar, storyData.BackgroundColor || '#4f46e5')
        .query(`
          INSERT INTO Story (AccountID, Content, MediaUrl, MediaType, BackgroundColor, Status, ViewCount)
          OUTPUT INSERTED.*
          VALUES (@AccountID, @Content, @MediaUrl, @MediaType, @BackgroundColor, 'Active', 0)
        `);
      
      await transaction.commit();
      
      const newStory = result.recordset[0];
      return await StoryDAL.getById(newStory.StoryID);
    } catch (error) {
      console.error('StoryDAL.create error:', error);
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }
      }
      throw error;
    }
  }

  /**
   * Get story by ID
   */
  static async getById(storyId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('StoryID', sql.Int, storyId)
        .query(`
          SELECT s.*, a.Username, a.FullName, a.AvatarUrl
          FROM Story s
          JOIN Account a ON s.AccountID = a.AccountID
          WHERE s.StoryID = @StoryID AND a.Status = 'Active'
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new Story(result.recordset[0]);
    } catch (error) {
      console.error('StoryDAL.getById error:', error);
      throw error;
    }
  }

  /**
   * Get all active stories (not expired, ordered by creation date)
   */
  static async getActiveStories() {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .query(`
          SELECT s.*, a.Username, a.FullName, a.AvatarUrl
          FROM Story s
          JOIN Account a ON s.AccountID = a.AccountID
          WHERE s.Status = 'Active' 
            AND s.ExpiresAt > GETDATE()
            AND a.Status = 'Active'
          ORDER BY s.CreatedDate DESC
        `);
      
      return result.recordset.map(storyData => new Story(storyData));
    } catch (error) {
      console.error('StoryDAL.getActiveStories error:', error);
      throw error;
    }
  }

  /**
   * Get active stories by user
   */
  static async getByUserId(accountId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT s.*, a.Username, a.FullName, a.AvatarUrl
          FROM Story s
          JOIN Account a ON s.AccountID = a.AccountID
          WHERE s.AccountID = @AccountID 
            AND s.Status = 'Active'
            AND s.ExpiresAt > GETDATE()
            AND a.Status = 'Active'
          ORDER BY s.CreatedDate DESC
        `);
      
      return result.recordset.map(storyData => new Story(storyData));
    } catch (error) {
      console.error('StoryDAL.getByUserId error:', error);
      throw error;
    }
  }

  /**
   * Delete story (soft delete)
   */
  static async delete(storyId) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('StoryID', sql.Int, storyId)
        .query(`
          UPDATE Story 
          SET Status = 'Deleted'
          WHERE StoryID = @StoryID
        `);
      
      return true;
    } catch (error) {
      console.error('StoryDAL.delete error:', error);
      throw error;
    }
  }

  /**
   * Mark expired stories (background job)
   */
  static async markExpiredStories() {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .query(`
          UPDATE Story 
          SET Status = 'Expired'
          WHERE Status = 'Active' AND ExpiresAt <= GETDATE()
        `);
      
      return result.rowsAffected[0];
    } catch (error) {
      console.error('StoryDAL.markExpiredStories error:', error);
      throw error;
    }
  }

  /**
   * Get archived stories (Status = 'Archived')
   */
  static async getArchivedStories() {
    try {
      const pool = await poolPromise;

      const result = await pool.request()
        .query(`
          SELECT s.*, a.Username, a.FullName, a.AvatarUrl
          FROM Story s
          JOIN Account a ON s.AccountID = a.AccountID
          WHERE s.Status = 'Archived' AND a.Status = 'Active'
          ORDER BY s.CreatedDate DESC
        `);

      return result.recordset.map(storyData => new Story(storyData));
    } catch (error) {
      console.error('StoryDAL.getArchivedStories error:', error);
      throw error;
    }
  }

  /**
   * Archive expired stories: move media files to archive folder and mark Status='Archived'
   * Returns number of stories archived
   */
  static async archiveExpiredStories() {
    try {
      const pool = await poolPromise;

      // Select expired stories (Active or Expired) that should be archived
      const selectRes = await pool.request()
        .query(`
          SELECT StoryID, MediaUrl
          FROM Story
          WHERE (Status = 'Active' OR Status = 'Expired') AND ExpiresAt <= GETDATE()
        `);

      const toArchive = selectRes.recordset || [];
      if (!toArchive.length) return 0;

      // Ensure archive folder exists
      const uploadsDir = path.join(__dirname, '../../uploads/stories');
      const archiveDir = path.join(uploadsDir, 'archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const archivedIds = [];

      for (const row of toArchive) {
        try {
          const { StoryID, MediaUrl } = row;
          if (MediaUrl && typeof MediaUrl === 'string') {
            // Expected mediaUrl like '/uploads/stories/filename.ext' or 'uploads/stories/filename.ext'
            const cleaned = MediaUrl.replace(/^\/+/, ''); // remove leading '/'
            const parts = cleaned.split('/');
            const idx = parts.indexOf('stories');
            if (idx !== -1 && parts.length > idx + 1) {
              const filename = parts.slice(idx + 1).join('/');
              const src = path.join(__dirname, '../../uploads/stories', filename);
              const dest = path.join(archiveDir, filename);
              if (fs.existsSync(src)) {
                try {
                  const destDir = path.dirname(dest);
                  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
                  fs.renameSync(src, dest);
                } catch (moveErr) {
                  // Fallback to copy + unlink if rename fails
                  try {
                    fs.copyFileSync(src, dest);
                    fs.unlinkSync(src);
                  } catch (copyErr) {
                    console.error('Failed to move story media file:', src, copyErr.message);
                  }
                }
              }
            }
          }

          archivedIds.push(StoryID);
        } catch (inner) {
          console.error('Error preparing archive for story row', row, inner && inner.message);
        }
      }

      if (archivedIds.length) {
        const idList = archivedIds.join(',');
        const updateSql = `UPDATE Story SET Status = 'Archived' WHERE StoryID IN (${idList})`;
        await pool.request().query(updateSql);
        return archivedIds.length;
      }

      return 0;
    } catch (error) {
      console.error('StoryDAL.archiveExpiredStories error:', error);
      throw error;
    }
  }

  /**
   * Increment view count
   */
  static async incrementViewCount(storyId) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('StoryID', sql.Int, storyId)
        .query(`
          UPDATE Story 
          SET ViewCount = ViewCount + 1
          WHERE StoryID = @StoryID
        `);
      
      return true;
    } catch (error) {
      console.error('StoryDAL.incrementViewCount error:', error);
      throw error;
    }
  }
}

module.exports = StoryDAL;
