/**
 * Message Controller - Xử lý logic cho messages
 */
const MessageDAL = require('../DAL/MessageDAL');
// const Message = require('../models/MessageClass');

const MessageController = {
  /**
   * Send new message
   */
  async sendMessage(req, res) {
    try {
  const { receiverId, content, images } = req.body; // images: optional array of base64 or URLs
      const senderId = req.user.AccountID;

      // Validate
      if (!receiverId) {
        return res.status(400).json({
          success: false,
          message: 'ReceiverID là bắt buộc'
        });
      }

      // Accept either content text or at least one image
      const hasContent = content && typeof content === 'string' && content.trim() !== '';
      const hasImages = Array.isArray(images) && images.length > 0;

      if (!hasContent && !hasImages) {
        return res.status(400).json({
          success: false,
          message: 'Content hoặc images là bắt buộc'
        });
      }

      if (hasImages && images.length > 5) {
        return res.status(400).json({ success: false, message: 'Tối đa 5 hình ảnh cho mỗi tin nhắn' });
      }

  console.log('=== SEND MESSAGE ===');
  console.log('Sender:', senderId);
  console.log('Receiver:', receiverId);
  console.log('Content length:', content ? content.length : 0);
      if (hasImages) {
        console.log('Images count:', images.length);
        console.log('First image is dataURI?', typeof images[0] === 'string' && images[0].startsWith('data:'));
      }

      const message = await MessageDAL.create({
        SenderID: senderId,
        ReceiverID: parseInt(receiverId),
        Content: content || '',
        Images: images || []
      });

      console.log('✅ Message sent successfully');

      res.status(201).json({
        success: true,
        message: 'Gửi tin nhắn thành công',
        data: message.toFrontendFormat()
      });
    } catch (error) {
      console.error('❌ Send message error:', error && error.stack ? error.stack : error);
      const payload = { success: false, message: 'Lỗi server khi gửi tin nhắn' };
      if (process.env.NODE_ENV !== 'production') {
        payload.error = error && error.message ? error.message : String(error);
        payload.stack = error && error.stack ? error.stack : null;
      }
      res.status(500).json(payload);
    }
  },

  /**
   * Get conversation between current user and another user
   */
  async getConversation(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user.AccountID;
      const { limit = 50 } = req.query;

      console.log('=== GET CONVERSATION ===');
      console.log('User 1:', currentUserId);
      console.log('User 2:', userId);

      const messages = await MessageDAL.getConversation(
        currentUserId, 
        parseInt(userId), 
        parseInt(limit)
      );

      console.log(`✅ Found ${messages.length} messages`);

      res.json({
        success: true,
        data: messages.map(msg => msg.toFrontendFormat())
      });
    } catch (error) {
      console.error('❌ Get conversation error:', error && error.stack ? error.stack : error);
      const payload = { success: false, message: 'Lỗi server khi lấy cuộc trò chuyện' };
      if (process.env.NODE_ENV !== 'production') {
        payload.error = error && error.message ? error.message : String(error);
        payload.stack = error && error.stack ? error.stack : null;
      }
      res.status(500).json(payload);
    }
  },

  /**
   * Get all conversations for current user
   */
  async getConversations(req, res) {
    try {
      const currentUserId = req.user.AccountID;

      console.log('=== GET CONVERSATIONS ===');
      console.log('User:', currentUserId);

      const conversations = await MessageDAL.getConversations(currentUserId);

      console.log(`✅ Found ${conversations.length} conversations`);

      res.json({
        success: true,
        data: conversations
      });
    } catch (error) {
      console.error('❌ Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách cuộc trò chuyện'
      });
    }
  },

  /**
   * Mark messages as read
   */
  async markAsRead(req, res) {
    try {
      const { senderId } = req.body;
      const receiverId = req.user.AccountID;

      await MessageDAL.markAsRead(parseInt(senderId), receiverId);

      res.json({
        success: true,
        message: 'Đã đánh dấu tin nhắn là đã đọc'
      });
    } catch (error) {
      console.error('❌ Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi đánh dấu đã đọc'
      });
    }
  },

  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const requesterId = req.user.AccountID;
      if (!messageId) return res.status(400).json({ success: false, message: 'messageId là bắt buộc' });

      const result = await MessageDAL.deleteById(messageId, requesterId);
      if (!result.deleted) {
        if (result.reason === 'not_found') return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        if (result.reason === 'forbidden') return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa tin nhắn này' });
        return res.status(400).json({ success: false, message: 'Không thể xóa tin nhắn' });
      }

      return res.json({ success: true, message: 'Xóa tin nhắn thành công' });
    } catch (error) {
      console.error('Delete message error:', error && error.stack ? error.stack : error);
      res.status(500).json({ success: false, message: 'Lỗi server khi xóa tin nhắn' });
    }
  },

  async updateMessage(req, res) {
    try {
      const { messageId } = req.params;
      const requesterId = req.user.AccountID;
      const { content } = req.body;

      if (!messageId) return res.status(400).json({ success: false, message: 'messageId là bắt buộc' });

      const result = await MessageDAL.updateById(messageId, requesterId, { Content: content });
      if (!result.updated) {
        if (result.reason === 'not_found') return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
        if (result.reason === 'forbidden') return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa tin nhắn này' });
        return res.status(400).json({ success: false, message: 'Không thể sửa tin nhắn' });
      }

      return res.json({ success: true, message: 'Cập nhật tin nhắn thành công', data: result.message.toFrontendFormat() });
    } catch (error) {
      console.error('Update message error:', error && error.stack ? error.stack : error);
      res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật tin nhắn' });
    }
  }
};

module.exports = MessageController;