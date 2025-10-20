/**
 * Message Data Access Layer (DAL)
 * Handles all database operations for Message entity
 */
const { sql, poolPromise } = require("../../config/db");
const Message = require("../../models/Social/MessageClass");

class MessageDAL {
  /**
   * Create message with file uploads (multer files)
   * Converts images to base64 and stores in database (NO file system storage)
   */
  static async createWithImages(messageData, files = []) {
    let transaction;
    const fs = require('fs');
    const sharp = require('sharp');

    try {
      const pool = await poolPromise;
      transaction = new sql.Transaction(pool);
      await transaction.begin();

      // Insert message
      const req = transaction.request()
        .input('SenderID', sql.Int, messageData.SenderID)
        .input('ReceiverID', sql.Int, messageData.ReceiverID)
        .input('Content', sql.NVarChar(sql.MAX), messageData.Content || '');

      const result = await req.query(`INSERT INTO [Message] (SenderID, ReceiverID, Content, SentDate) OUTPUT INSERTED.* VALUES (@SenderID, @ReceiverID, @Content, GETDATE())`);
      const messageId = result.recordset[0].MessageID;

      // Process files sequentially - convert to base64
      for (const f of files || []) {
        // basic mime validation
        if (!f.mimetype || !f.mimetype.startsWith('image/')) {
          throw new Error('Invalid file type');
        }

        // resize and convert to buffer with sharp (max width/height 1200)
        const buffer = await sharp(f.path)
          .resize({ width: 1200, height: 1200, fit: 'inside' })
          .jpeg({ quality: 80 })
          .toBuffer();

        // Convert to base64 data URI
        const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        // remove temp file if exists
        try { fs.unlinkSync(f.path); } catch (e) { /* ignore */ }

        // Store base64 in ImageData column (MessageImage uses ImageData, not ImageUrl)
        try {
          await transaction.request()
            .input('MessageID', sql.Int, messageId)
            .input('ImageData', sql.NVarChar(sql.MAX), base64Image)
            .query(`INSERT INTO MessageImage (MessageID, ImageData, CreatedAt) VALUES (@MessageID, @ImageData, GETDATE())`);
        } catch (imgInsErr) {
          console.warn('MessageDAL.createWithImages - image insert failed:', imgInsErr.message);
        }
      }

      await transaction.commit();

      // return full message object
      const message = await MessageDAL.getById(messageId);
      return message;
    } catch (error) {
      console.error('MessageDAL.createWithImages error:', error);
      if (transaction) {
        try { await transaction.rollback(); } catch (e) { console.error('Rollback failed', e); }
      }

      throw error;
    }
  }

  static async create(messageData) {
    try {
      const pool = await poolPromise;
      const insertRes = await pool.request()
        .input('SenderID', sql.Int, messageData.SenderID)
        .input('ReceiverID', sql.Int, messageData.ReceiverID)
        .input('Content', sql.NVarChar(sql.MAX), messageData.Content || '')
        .query(`INSERT INTO [Message] (SenderID, ReceiverID, Content, SentDate) OUTPUT INSERTED.* VALUES (@SenderID, @ReceiverID, @Content, GETDATE())`);

      const messageId = insertRes.recordset && insertRes.recordset[0] && insertRes.recordset[0].MessageID;

      // Best-effort: insert images if provided
      const images = messageData.Images || messageData.images || [];
      if (images && images.length > 0) {
        try {
          const transaction = new sql.Transaction(pool);
          await transaction.begin();
          try {
            // Store all images (base64 or URL) in ImageData column
            for (let i = 0; i < Math.min(5, images.length); i++) {
              const img = images[i];
              if (typeof img === 'string' && img.trim()) {
                await transaction.request()
                  .input('MessageID', sql.Int, messageId)
                  .input('ImageData', sql.NVarChar(sql.MAX), img)
                  .query('INSERT INTO MessageImage (MessageID, ImageData, CreatedAt) VALUES (@MessageID, @ImageData, GETDATE())');
              }
            }

            await transaction.commit();
          } catch (imgErr) {
            try { await transaction.rollback(); } catch (e) { /* ignore */ }
            console.warn('MessageDAL.create - MessageImage insert failed (non-fatal):', imgErr && imgErr.message ? imgErr.message : imgErr);
          }
        } catch (txErr) {
          // transaction init failed; non-fatal
          console.warn('MessageDAL.create - could not start transaction for images:', txErr && txErr.message ? txErr.message : txErr);
        }
      }

      return await MessageDAL.getById(messageId);
    } catch (error) {
      console.error('MessageDAL.create error:', error && error.message ? error.message : error);
      throw error;
    }
  }

  static async deleteById(messageId, requesterId) {
    try {
      const pool = await poolPromise;
      const row = await pool.request().input('MessageID', sql.Int, parseInt(messageId, 10)).query('SELECT MessageID, SenderID FROM [Message] WHERE MessageID = @MessageID');
      if (!row.recordset || row.recordset.length === 0) return { deleted: false, reason: 'not_found' };
      const msg = row.recordset[0];
      if (Number(msg.SenderID) !== Number(requesterId)) return { deleted: false, reason: 'forbidden' };

      try {
        await pool.request().input('MessageID', sql.Int, parseInt(messageId, 10)).query('DELETE FROM MessageImage WHERE MessageID = @MessageID');
      } catch (imgDelErr) {
        console.warn('Could not delete MessageImage rows (table might be missing):', imgDelErr && imgDelErr.message ? imgDelErr.message : imgDelErr);
      }

      await pool.request().input('MessageID', sql.Int, parseInt(messageId, 10)).query('DELETE FROM [Message] WHERE MessageID = @MessageID');
      return { deleted: true };
    } catch (error) {
      console.error('MessageDAL.deleteById error:', error && error.message ? error.message : error);
      throw error;
    }
  }

  static async updateById(messageId, requesterId, data) {
    try {
      const pool = await poolPromise;
      const row = await pool.request().input('MessageID', sql.Int, parseInt(messageId, 10)).query('SELECT MessageID, SenderID FROM [Message] WHERE MessageID = @MessageID');
      if (!row.recordset || row.recordset.length === 0) return { updated: false, reason: 'not_found' };
      const msg = row.recordset[0];
      if (Number(msg.SenderID) !== Number(requesterId)) return { updated: false, reason: 'forbidden' };

      await pool.request().input('MessageID', sql.Int, parseInt(messageId, 10)).input('Content', sql.NVarChar(sql.MAX), data.Content || '').query('UPDATE [Message] SET Content = @Content WHERE MessageID = @MessageID');
      const updated = await MessageDAL.getById(parseInt(messageId, 10));
      return { updated: true, message: updated };
    } catch (error) {
      console.error('MessageDAL.updateById error:', error && error.message ? error.message : error);
      throw error;
    }
  }

  static async getById(messageId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request().input('MessageID', sql.Int, messageId).query('SELECT m.*, sender.Username as SenderUsername, sender.FullName as SenderFullName, sender.AvatarUrl as SenderAvatar, receiver.Username as ReceiverUsername, receiver.FullName as ReceiverFullName, receiver.AvatarUrl as ReceiverAvatar FROM [Message] m JOIN [Account] sender ON m.SenderID = sender.AccountID JOIN [Account] receiver ON m.ReceiverID = receiver.AccountID WHERE m.MessageID = @MessageID');
      if (!result.recordset || result.recordset.length === 0) return null;

      let images = [];
      try {
        // Get images from ImageData column (contains base64)
        const imagesRes = await pool.request()
          .input('MessageID', sql.Int, messageId)
          .query(`SELECT ImageID, ImageData FROM MessageImage WHERE MessageID = @MessageID ORDER BY ImageID ASC`);
        images = imagesRes.recordset.map(r => ({ id: r.ImageID, data: r.ImageData }));
      } catch (imgErr) {
        images = [];
      }

      const msg = new Message(result.recordset[0]);
      msg.Images = images;
      return msg;
    } catch (error) {
      console.error('MessageDAL.getById error:', error && error.message ? error.message : error);
      throw error;
    }
  }

  static async getConversation(userId1, userId2, limit = 50) {
    try {
      const pool = await poolPromise;
      const limitNum = parseInt(limit, 10) || 50;
      const result = await pool.request().input('UserID1', sql.Int, userId1).input('UserID2', sql.Int, userId2).query('SELECT m.*, sender.Username as SenderUsername, sender.FullName as SenderFullName, sender.AvatarUrl as SenderAvatar, receiver.Username as ReceiverUsername, receiver.FullName as ReceiverFullName, receiver.AvatarUrl as ReceiverAvatar FROM [Message] m JOIN [Account] sender ON m.SenderID = sender.AccountID JOIN [Account] receiver ON m.ReceiverID = receiver.AccountID WHERE (m.SenderID = @UserID1 AND m.ReceiverID = @UserID2) OR (m.SenderID = @UserID2 AND m.ReceiverID = @UserID1) ORDER BY m.SentDate DESC');
      let rows = result.recordset || [];
      if (rows.length === 0) return [];
      rows = rows.slice(0, limitNum);

      const messageIds = rows.map(r => r.MessageID).filter(Boolean);
      let imagesByMessage = {};
      if (messageIds.length > 0) {
        const imgReq = pool.request();
        const paramNames = messageIds.map((_, i) => `@id${i}`);
        messageIds.forEach((id, i) => imgReq.input(`id${i}`, sql.Int, id));
        const inClause = paramNames.join(',');
        // Get images from ImageData column (contains base64)
        const imagesQuery = `SELECT ImageID, MessageID, ImageData FROM MessageImage WHERE MessageID IN (${inClause}) ORDER BY ImageID ASC`;

        try {
          const imagesRes = await imgReq.query(imagesQuery);
          imagesByMessage = {};
          for (const img of imagesRes.recordset) {
            if (!imagesByMessage[img.MessageID]) imagesByMessage[img.MessageID] = [];
            imagesByMessage[img.MessageID].push({ id: img.ImageID, data: img.ImageData });
          }
        } catch (imgFetchErr) {
          imagesByMessage = {};
        }
      }

      const messages = rows.map(row => {
        const msg = new Message(row);
        msg.Images = imagesByMessage[row.MessageID] || [];
        return msg;
      });
      return messages;
    } catch (error) {
      console.error('MessageDAL.getConversation error:', error && error.message ? error.message : error);
      return [];
    }
  }

  static async getConversations(userId) {
    try {
      const pool = await poolPromise;
      let hasIsRead = false;
      try {
        const colRes = await pool.request().input('tableName', sql.NVarChar(200), 'Message').input('colName', sql.NVarChar(200), 'IsRead').query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @colName");
        hasIsRead = (colRes.recordset && colRes.recordset.length > 0);
      } catch (colErr) {
        hasIsRead = false;
      }

      if (hasIsRead) {
        const result = await pool.request().input('UserID', sql.Int, userId).query(`WITH LastMessages AS (SELECT CASE WHEN SenderID = @UserID THEN ReceiverID ELSE SenderID END as OtherUserID, MAX(SentDate) as LastMessageDate FROM [Message] WHERE SenderID = @UserID OR ReceiverID = @UserID GROUP BY CASE WHEN SenderID = @UserID THEN ReceiverID ELSE SenderID END) SELECT a.AccountID, a.Username, a.FullName, a.AvatarUrl, lm.LastMessageDate, (SELECT TOP 1 LEFT(m2.Content, 200) FROM [Message] m2 WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @USERID) ORDER BY m2.SentDate DESC) as LastMessageContent, (SELECT TOP 1 m2.SenderID FROM [Message] m2 WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @USERID) ORDER BY m2.SentDate DESC) as LastMessageSenderID, (SELECT COUNT(*) FROM [Message] WHERE ReceiverID = @USERID AND SenderID = a.AccountID AND IsRead = 0) as UnreadCount FROM LastMessages lm JOIN [Account] a ON lm.OtherUserID = a.AccountID WHERE a.Status = 'Active' ORDER BY lm.LastMessageDate DESC`);
        return result.recordset;
      } else {
        const result = await pool.request().input('UserID', sql.Int, userId).query(`WITH LastMessages AS (SELECT CASE WHEN SenderID = @UserID THEN ReceiverID ELSE SenderID END as OtherUserID, MAX(SentDate) as LastMessageDate FROM [Message] WHERE SenderID = @UserID OR ReceiverID = @UserID GROUP BY CASE WHEN SenderID = @UserID THEN ReceiverID ELSE SenderID END) SELECT a.AccountID, a.Username, a.FullName, a.AvatarUrl, lm.LastMessageDate, (SELECT TOP 1 LEFT(m2.Content, 200) FROM [Message] m2 WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @USERID) ORDER BY m2.SentDate DESC) as LastMessageContent, (SELECT TOP 1 m2.SenderID FROM [Message] m2 WHERE (m2.SenderID = @UserID AND m2.ReceiverID = a.AccountID) OR (m2.SenderID = a.AccountID AND m2.ReceiverID = @USERID) ORDER BY m2.SentDate DESC) as LastMessageSenderID, 0 as UnreadCount FROM LastMessages lm JOIN [Account] a ON lm.OtherUserID = a.AccountID WHERE a.Status = 'Active' ORDER BY lm.LastMessageDate DESC`);
        return result.recordset;
      }
    } catch (error) {
      console.error('MessageDAL.getConversations error:', error && error.message ? error.message : error);
      throw error;
    }
  }

  static async markAsRead(senderId, receiverId) {
    try {
      const pool = await poolPromise;
      const sId = parseInt(senderId, 10);
      const rId = parseInt(receiverId, 10);
      if (Number.isNaN(sId) || Number.isNaN(rId)) {
        throw new Error('Invalid senderId or receiverId');
      }

      let hasIsRead = false;
      try {
        const colCheck = await pool.request().input('tableName', sql.NVarChar(200), 'Message').input('colName', sql.NVarChar(200), 'IsRead').query('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @colName');
        hasIsRead = (colCheck.recordset || []).length > 0;
      } catch (colErr) {
        hasIsRead = false;
      }

      if (!hasIsRead) {
        // Table doesn't support IsRead — nothing to do
        return true;
      }

      await pool.request().input('SenderID', sql.Int, sId).input('ReceiverID', sql.Int, rId).query('UPDATE [Message] SET IsRead = 1 WHERE SenderID = @SenderID AND ReceiverID = @ReceiverID AND IsRead = 0');
      return true;
    } catch (error) {
      console.error('MessageDAL.markAsRead error:', error && error.message ? error.message : error);
      throw error;
    }
  }
}

module.exports = MessageDAL;
