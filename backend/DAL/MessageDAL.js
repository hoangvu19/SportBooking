/**
 * Message Data Access Layer (DAL)
 * Handles all database operations for Message entity
 */
const { sql, poolPromise } = require("../config/db");
const db = require('../utils/dbHelper');
const Message = require("../models/MessageClass");

class MessageDAL {
  /**
   * Send new message
   */
  static async create(messageData) {
    try {
      console.log('📝 Creating message:', {
        SenderID: messageData.SenderID,
        ReceiverID: messageData.ReceiverID,
        ContentLength: messageData.Content ? messageData.Content.length : 0
      });

      const insertResult = await db.query(`
        INSERT INTO [Message] (SenderID, ReceiverID, Content, SentDate)
        OUTPUT INSERTED.*
        VALUES (@SenderID, @ReceiverID, @Content, GETDATE())
      `, [
        { name: 'SenderID', type: sql.Int, value: messageData.SenderID },
        { name: 'ReceiverID', type: sql.Int, value: messageData.ReceiverID },
        { name: 'Content', type: sql.NVarChar(sql.MAX), value: messageData.Content || '' }
      ]);

      const messageId = insertResult.recordset[0].MessageID;
      console.log('✅ Message created:', messageId);

      // Insert images in a separate transaction — if fails, do not rollback message
      const images = messageData.Images || messageData.images || [];
      if (images && images.length > 0) {
        try {
          await db.transaction(async (tx) => {
            const req = tx.request();
            for (let i = 0; i < Math.min(5, images.length); i++) {
              const img = images[i];
              const isBase64 = typeof img === 'string' && img.startsWith('data:');
              req.input('MessageID', sql.Int, messageId)
                .input('ImageData', sql.NVarChar(sql.MAX), isBase64 ? img : null)
                .input('ImageUrl', sql.NVarChar(sql.MAX), isBase64 ? null : img);

              await req.query(`
                INSERT INTO [MessageImage] (MessageID, ImageData, ImageUrl, CreatedAt)
                VALUES (@MessageID, @ImageData, @ImageUrl, GETDATE())
              `);
            }
          });
          console.log('✅ MessageImage rows inserted for message', messageId);
        } catch (imgErr) {
          console.error('❌ MessageImage insert error (will not rollback message):', imgErr && imgErr.message ? imgErr.message : imgErr);
        }
      }

      return await MessageDAL.getById(messageId);
    } catch (error) {
      console.error('❌ MessageDAL.create error:', error);
      throw error;
    }
  }

  /**
   * Delete a message by id if requester is the sender
   */
  static async deleteById(messageId, requesterId) {
    try {
      const pool = await poolPromise;
      // First verify the message exists and the requester is the sender
      const row = await pool.request()
        .input('MessageID', sql.Int, parseInt(messageId))
        .query('SELECT MessageID, SenderID FROM [Message] WHERE MessageID = @MessageID');

      if (!row.recordset || row.recordset.length === 0) return { deleted: false, reason: 'not_found' };
      const msg = row.recordset[0];
      if (Number(msg.SenderID) !== Number(requesterId)) return { deleted: false, reason: 'forbidden' };

      // Delete message images first (if table exists)
      try {
        await pool.request()
          .input('MessageID', sql.Int, parseInt(messageId))
          .query('DELETE FROM [MessageImage] WHERE MessageID = @MessageID');
      } catch (imgDelErr) {
        // non-fatal
        console.warn('Could not delete MessageImage rows (table might be missing):', imgDelErr && imgDelErr.message ? imgDelErr.message : imgDelErr);
      }

      // Delete the message row
      await pool.request()
        .input('MessageID', sql.Int, parseInt(messageId))
        .query('DELETE FROM [Message] WHERE MessageID = @MessageID');

      return { deleted: true };
    } catch (error) {
      console.error('MessageDAL.deleteById error:', error);
      throw error;
    }
  }

  /**
   * Update message content by id if requester is the sender
   * Only updates textual content; images editing is not supported here.
   */
  static async updateById(messageId, requesterId, data) {
    try {
      const pool = await poolPromise;

      // Verify exists and permission
      const row = await pool.request()
        .input('MessageID', sql.Int, parseInt(messageId))
        .query('SELECT MessageID, SenderID FROM [Message] WHERE MessageID = @MessageID');

      if (!row.recordset || row.recordset.length === 0) return { updated: false, reason: 'not_found' };
      const msg = row.recordset[0];
      if (Number(msg.SenderID) !== Number(requesterId)) return { updated: false, reason: 'forbidden' };

      // Only update Content for now
      await pool.request()
        .input('MessageID', sql.Int, parseInt(messageId))
        .input('Content', sql.NVarChar(sql.MAX), data.Content || '')
        .query(`
          UPDATE [Message]
          SET Content = @Content
          WHERE MessageID = @MessageID
        `);

      // return updated message
      const updated = await MessageDAL.getById(parseInt(messageId));
      return { updated: true, message: updated };
    } catch (error) {
      console.error('MessageDAL.updateById error:', error);
      throw error;
    }
  }

  /**
   * Get message by ID with user info
   */
  static async getById(messageId) {
    try {
      const pool = await poolPromise;
      
      const result = await pool.request()
        .input("MessageID", sql.Int, messageId)
          .query(`
            SELECT m.*, 
                   sender.Username as SenderUsername, sender.FullName as SenderFullName, sender.AvatarUrl as SenderAvatar,
                   receiver.Username as ReceiverUsername, receiver.FullName as ReceiverFullName, receiver.AvatarUrl as ReceiverAvatar
            FROM [Message] m
            JOIN [Account] sender ON m.SenderID = sender.AccountID
            JOIN [Account] receiver ON m.ReceiverID = receiver.AccountID
            WHERE m.MessageID = @MessageID
          `);
      
      if (result.recordset.length === 0) {
        return null;
      }
      
      // fetch images for this message (safe: if table missing, return empty array)
      let images = [];
      try {
        const imagesRes = await pool.request()
          .input('MessageID', sql.Int, messageId)
          .query(`SELECT ImageID, ImageData, ImageUrl, CreatedAt FROM [MessageImage] WHERE MessageID = @MessageID ORDER BY ImageID ASC`);
        images = imagesRes.recordset.map(r => ({ id: r.ImageID, data: r.ImageData, url: r.ImageUrl }));
      } catch (imgSelErr) {
        console.warn('⚠️ Could not read MessageImage rows (table may be missing):', imgSelErr && imgSelErr.message ? imgSelErr.message : imgSelErr);
        images = [];
      }

      const msg = new Message(result.recordset[0]);
      msg.Images = images;
      return msg;
    } catch (error) {
      console.error('MessageDAL.getById error:', error);
      throw error;
    }
  }

  /**
   * Get conversation between two users
   */
  static async getConversation(userId1, userId2, limit = 50) {
    try {
      const pool = await poolPromise;
      // Normalize inputs
      const limitNum = parseInt(limit, 10) || 50;

      // Simpler query: fetch messages ordered desc, then slice to limit in JS
      const result = await pool.request()
        .input('UserID1', sql.Int, userId1)
        .input('UserID2', sql.Int, userId2)
        .query(`
          SELECT m.*, 
                 sender.Username as SenderUsername, sender.FullName as SenderFullName, sender.AvatarUrl as SenderAvatar,
                 receiver.Username as ReceiverUsername, receiver.FullName as ReceiverFullName, receiver.AvatarUrl as ReceiverAvatar
          FROM [Message] m
          JOIN [Account] sender ON m.SenderID = sender.AccountID
          JOIN [Account] receiver ON m.ReceiverID = receiver.AccountID
          WHERE (m.SenderID = @UserID1 AND m.ReceiverID = @UserID2)
             OR (m.SenderID = @UserID2 AND m.ReceiverID = @UserID1)
          ORDER BY m.SentDate DESC
        `);

  let rows = result.recordset || [];
  if (rows.length === 0) return [];

  // apply limit in JS (rows already ordered DESC by SentDate)
  rows = rows.slice(0, limitNum);

      // Collect message IDs and fetch all images in a single query
      const messageIds = rows.map(r => r.MessageID).filter(Boolean);
      let imagesByMessage = {};

      if (messageIds.length > 0) {
        const imgReq = pool.request();
        const paramNames = messageIds.map((_, i) => `@id${i}`);
        messageIds.forEach((id, i) => imgReq.input(`id${i}`, sql.Int, id));

  const inClause = paramNames.join(',');
  const imagesQuery = `SELECT ImageID, MessageID, ImageData, ImageUrl FROM [MessageImage] WHERE MessageID IN (${inClause}) ORDER BY ImageID ASC`;
        try {
          const imagesRes = await imgReq.query(imagesQuery);
          // Map images by MessageID
          imagesByMessage = {};
          for (const img of imagesRes.recordset) {
            if (!imagesByMessage[img.MessageID]) imagesByMessage[img.MessageID] = [];
            imagesByMessage[img.MessageID].push({ id: img.ImageID, data: img.ImageData, url: img.ImageUrl });
          }
        } catch (imgFetchErr) {
          console.warn('⚠️ Could not fetch MessageImage rows for messages (table may be missing):', imgFetchErr && imgFetchErr.message ? imgFetchErr.message : imgFetchErr);
          imagesByMessage = {};
        }
      }

      // Build Message objects with attached images
      const messages = rows.map(row => {
        const msg = new Message(row);
        msg.Images = imagesByMessage[row.MessageID] || [];
        return msg;
      });

      return messages;
    } catch (error) {
      // Log full error for debugging but do not throw to avoid 500 in API for recoverable DB issues
      console.error('MessageDAL.getConversation error:', error && error.stack ? error.stack : error);
      // Return empty conversation so the API can respond with success and an empty list
      return [];
    }
  }

  /**
   * Get all conversations for a user (list of users they've chatted with)
   */
  static async getConversations(userId) {
    try {
      const pool = await poolPromise;
      // Check whether the Message table contains the IsRead column in this DB
      let hasIsRead = false;
      try {
        const colRes = await pool.request()
          .input('tableName', sql.NVarChar(200), 'Message')
          .input('colName', sql.NVarChar(200), 'IsRead')
          .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @colName`);
        hasIsRead = (colRes.recordset && colRes.recordset.length > 0);
      } catch (colErr) {
        console.warn('Could not check Message.IsRead column existence, proceeding without unread counts', colErr && colErr.message ? colErr.message : colErr);
        hasIsRead = false;
      }

      if (hasIsRead) {
        const result = await pool.request()
          .input("UserID", sql.Int, userId)
          .query(`
            WITH LastMessages AS (
              SELECT 
                CASE 
                  WHEN SenderID = @UserID THEN ReceiverID 
                  ELSE SenderID 
                END as OtherUserID,
                MAX(SentDate) as LastMessageDate
              FROM [Message]
              WHERE SenderID = @UserID OR ReceiverID = @UserID
              GROUP BY 
                CASE 
                  WHEN SenderID = @UserID THEN ReceiverID 
                  ELSE SenderID 
                END
            )
            SELECT 
              a.AccountID, a.Username, a.FullName, a.AvatarUrl,
              lm.LastMessageDate,
              (SELECT TOP 1 LEFT(m2.Content, 200) FROM [Message] m2
               WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @UserID)
               ORDER BY m2.SentDate DESC) as LastMessageContent,
              (SELECT TOP 1 m2.SenderID FROM [Message] m2
               WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @UserID)
               ORDER BY m2.SentDate DESC) as LastMessageSenderID,
              (SELECT COUNT(*) FROM [Message] 
               WHERE ReceiverID = @UserID AND SenderID = a.AccountID AND IsRead = 0) as UnreadCount
            FROM LastMessages lm
            JOIN [Account] a ON lm.OtherUserID = a.AccountID
            WHERE a.Status = 'Active'
            ORDER BY lm.LastMessageDate DESC
          `);

        return result.recordset;
      } else {
        // DB doesn't have IsRead column — return conversations without unread count
        const result = await pool.request()
          .input("UserID", sql.Int, userId)
          .query(`
            WITH LastMessages AS (
              SELECT 
                CASE 
                  WHEN SenderID = @UserID THEN ReceiverID 
                  ELSE SenderID 
                END as OtherUserID,
                MAX(SentDate) as LastMessageDate
              FROM [Message]
              WHERE SenderID = @UserID OR ReceiverID = @UserID
              GROUP BY 
                CASE 
                  WHEN SenderID = @UserID THEN ReceiverID 
                  ELSE SenderID 
                END
            )
            SELECT 
              a.AccountID, a.Username, a.FullName, a.AvatarUrl,
              lm.LastMessageDate,
              (SELECT TOP 1 LEFT(m2.Content, 200) FROM [Message] m2
               WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @UserID)
               ORDER BY m2.SentDate DESC) as LastMessageContent,
              (SELECT TOP 1 m2.SenderID FROM [Message] m2
               WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @UserID)
               ORDER BY m2.SentDate DESC) as LastMessageSenderID,
              0 as UnreadCount
            FROM LastMessages lm
            JOIN [Account] a ON lm.OtherUserID = a.AccountID
            WHERE a.Status = 'Active'
            ORDER BY lm.LastMessageDate DESC
          `);

        return result.recordset;
      }
    } catch (error) {
      console.error('MessageDAL.getConversations error:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  static async markAsRead(senderId, receiverId) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input("SenderID", sql.Int, senderId)
        .input("ReceiverID", sql.Int, receiverId)
        .query(`
          UPDATE Message 
          SET IsRead = 1
          WHERE SenderID = @SenderID AND ReceiverID = @ReceiverID AND IsRead = 0
        `);
      
      return true;
    } catch (error) {
      console.error('MessageDAL.markAsRead error:', error);
      throw error;
    }
  }
}

module.exports = MessageDAL;
