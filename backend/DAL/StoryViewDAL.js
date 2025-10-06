/**
 * StoryView Data Access Layer (DAL)
 * Handles all database operations for StoryView entity
 */
const { sql, poolPromise } = require("../config/db");
const StoryView = require("../models/StoryView");

class StoryViewDAL {
  /**
   * Record a story view (idempotent - won't create duplicate)
   */
  static async recordView(storyId, viewerAccountId) {
    try {
      const pool = await poolPromise;
      
      // Try to insert, ignore if already exists (UNIQUE constraint)
      const result = await pool.request()
        .input('StoryID', sql.Int, storyId)
        .input('ViewerAccountID', sql.Int, viewerAccountId)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM StoryView 
            WHERE StoryID = @StoryID AND ViewerAccountID = @ViewerAccountID
          )
          BEGIN
            INSERT INTO StoryView (StoryID, ViewerAccountID)
            OUTPUT INSERTED.*
            VALUES (@StoryID, @ViewerAccountID)
          END
          ELSE
          BEGIN
            SELECT * FROM StoryView 
            WHERE StoryID = @StoryID AND ViewerAccountID = @ViewerAccountID
          END
        `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      return new StoryView(result.recordset[0]);
    } catch (error) {
      console.error('StoryViewDAL.recordView error:', error);
      throw error;
    }
  }

  /**
   * Get all viewers for a story with their account info
   */
  static async getStoryViewers(storyId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('StoryID', sql.Int, storyId)
        .query(`
          SELECT 
            sv.*,
            a.Username AS ViewerUsername,
            a.FullName AS ViewerFullName,
            a.AvatarUrl AS ViewerAvatarUrl
          FROM StoryView sv
          JOIN Account a ON sv.ViewerAccountID = a.AccountID
          WHERE sv.StoryID = @StoryID AND a.Status = 'Active'
          ORDER BY sv.ViewedAt DESC
        `);
      
      return result.recordset.map(row => new StoryView(row));
    } catch (error) {
      console.error('StoryViewDAL.getStoryViewers error:', error);
      throw error;
    }
  }

  /**
   * Get view count for a story
   */
  static async getViewCount(storyId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('StoryID', sql.Int, storyId)
        .query(`
          SELECT COUNT(*) AS ViewCount
          FROM StoryView
          WHERE StoryID = @StoryID
        `);
      
      return result.recordset[0]?.ViewCount || 0;
    } catch (error) {
      console.error('StoryViewDAL.getViewCount error:', error);
      throw error;
    }
  }

  /**
   * Check if user has viewed a story
   */
  static async hasUserViewed(storyId, accountId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('StoryID', sql.Int, storyId)
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT COUNT(*) AS Count
          FROM StoryView
          WHERE StoryID = @StoryID AND ViewerAccountID = @AccountID
        `);
      
      return result.recordset[0]?.Count > 0;
    } catch (error) {
      console.error('StoryViewDAL.hasUserViewed error:', error);
      throw error;
    }
  }

  /**
   * Get stories viewed by a user
   */
  static async getViewedStoriesByUser(accountId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input('AccountID', sql.Int, accountId)
        .query(`
          SELECT 
            sv.*,
            s.*,
            a.Username AS ViewerUsername,
            a.FullName AS ViewerFullName,
            a.AvatarUrl AS ViewerAvatarUrl
          FROM StoryView sv
          JOIN Story s ON sv.StoryID = s.StoryID
          JOIN Account a ON sv.ViewerAccountID = a.AccountID
          WHERE sv.ViewerAccountID = @AccountID AND s.Status = 'Active'
          ORDER BY sv.ViewedAt DESC
        `);
      
      return result.recordset.map(row => new StoryView(row));
    } catch (error) {
      console.error('StoryViewDAL.getViewedStoriesByUser error:', error);
      throw error;
    }
  }

  /**
   * Delete all views for a story (when story is deleted)
   */
  static async deleteByStoryId(storyId) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('StoryID', sql.Int, storyId)
        .query(`
          DELETE FROM StoryView WHERE StoryID = @StoryID
        `);
      
      return true;
    } catch (error) {
      console.error('StoryViewDAL.deleteByStoryId error:', error);
      throw error;
    }
  }
}

module.exports = StoryViewDAL;
