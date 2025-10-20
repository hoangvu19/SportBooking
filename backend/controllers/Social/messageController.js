/**
 * Message Controller - Xử lý logic cho messages
 */
const MessageDAL = require('../../DAL/Social/MessageDAL');
const { buildBaseUrl } = require('../../utils/controllerHelpers');
const { toAbsoluteUrl } = require('../../utils/requestUtils');

const MessageController = {
  /**
   * Send new message
   */
  async sendMessage(req, res) {
    try {
      const { receiverId, content, images } = req.body; // images: optional array of base64 or URLs
      const senderId = req.user.AccountID;
      const files = req.files || []; // multer uploaded files

      // Validate
      if (!receiverId) {
        return res.status(400).json({
          success: false,
          message: 'ReceiverID là bắt buộc'
        });
      }

      // Accept either content text or at least one image (file upload or base64/URL)
      const hasContent = content && typeof content === 'string' && content.trim() !== '';
      const hasImages = Array.isArray(images) && images.length > 0;
      const hasFiles = files.length > 0;

      if (!hasContent && !hasImages && !hasFiles) {
        return res.status(400).json({
          success: false,
          message: 'Content hoặc images là bắt buộc'
        });
      }

      if ((hasImages ? images.length : 0) + files.length > 5) {
        return res.status(400).json({ success: false, message: 'Tối đa 5 hình ảnh cho mỗi tin nhắn' });
      }

      console.log('=== SEND MESSAGE ===');
      console.log('Sender:', senderId);
      console.log('Receiver:', receiverId);
      console.log('Content length:', content ? content.length : 0);
      console.log('Files uploaded:', files.length);
      if (hasImages) {
        console.log('Images from body:', images.length);
        console.log('First image is dataURI?', typeof images[0] === 'string' && images[0].startsWith('data:'));
      }

      let message;
      
      // If files uploaded via multer, use createWithImages; otherwise use create with base64/URL
      if (hasFiles) {
        message = await MessageDAL.createWithImages({
          SenderID: senderId,
          ReceiverID: parseInt(receiverId),
          Content: content || ''
        }, files);
      } else {
        message = await MessageDAL.create({
          SenderID: senderId,
          ReceiverID: parseInt(receiverId),
          Content: content || '',
          Images: images || []
        });
      }

      console.log('✅ Message sent successfully');

      // Normalize URLs to absolute so frontend displays images/avatars like posts
      const baseUrl = buildBaseUrl(req);
      const formatted = message.toFrontendFormat();
      if (Array.isArray(formatted.image_urls)) {
        formatted.image_urls = formatted.image_urls.map(u => toAbsoluteUrl(baseUrl, u));
      }
      if (formatted?.sender?.avatar) formatted.sender.avatar = toAbsoluteUrl(baseUrl, formatted.sender.avatar);
      if (formatted?.receiver?.avatar) formatted.receiver.avatar = toAbsoluteUrl(baseUrl, formatted.receiver.avatar);

      res.status(201).json({
        success: true,
        message: 'Gửi tin nhắn thành công',
        data: formatted
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

      const baseUrl = buildBaseUrl(req);
      const formatted = messages.map(msg => {
        const f = msg.toFrontendFormat();
        if (Array.isArray(f.image_urls)) f.image_urls = f.image_urls.map(u => toAbsoluteUrl(baseUrl, u));
        if (f?.sender?.avatar) f.sender.avatar = toAbsoluteUrl(baseUrl, f.sender.avatar);
        if (f?.receiver?.avatar) f.receiver.avatar = toAbsoluteUrl(baseUrl, f.receiver.avatar);
        return f;
      });

      res.json({ success: true, data: formatted });
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

      if (typeof senderId === 'undefined' || senderId === null) {
        return res.status(400).json({ success: false, message: 'senderId is required in request body' });
      }

      const sId = parseInt(senderId, 10);
      if (Number.isNaN(sId)) {
        return res.status(400).json({ success: false, message: 'senderId must be a valid number' });
      }

      await MessageDAL.markAsRead(sId, receiverId);

      res.json({ success: true, message: 'Đã đánh dấu tin nhắn là đã đọc' });
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

  // Normalize urls in updated message
  const baseUrl = buildBaseUrl(req);
  const f = result.message.toFrontendFormat();
  if (Array.isArray(f.image_urls)) f.image_urls = f.image_urls.map(u => toAbsoluteUrl(baseUrl, u));
  if (f?.sender?.avatar) f.sender.avatar = toAbsoluteUrl(baseUrl, f.sender.avatar);
  if (f?.receiver?.avatar) f.receiver.avatar = toAbsoluteUrl(baseUrl, f.receiver.avatar);

  return res.json({ success: true, message: 'Cập nhật tin nhắn thành công', data: f });
    } catch (error) {
      console.error('Update message error:', error && error.stack ? error.stack : error);
      res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật tin nhắn' });
    }
  }
};

module.exports = MessageController;