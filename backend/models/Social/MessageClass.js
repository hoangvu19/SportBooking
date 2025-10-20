/**
 * Message Class
 * Represents a Message entity with all properties and business logic
 */
const { idToString, avatar, mapImageUrl } = require('../../utils/modelHelpers');

class Message {
  constructor({ 
    MessageID, 
    SenderID, 
    ReceiverID, 
    Content,
    SentDate,
    // Additional fields from joins
    SenderUsername,
    SenderFullName,
    SenderAvatar,
    ReceiverUsername,
    ReceiverFullName,
    ReceiverAvatar
  }) {
    this.MessageID = MessageID;
    this.SenderID = SenderID;
    this.ReceiverID = ReceiverID;
    this.Content = Content;
    this.SentDate = SentDate;
    
    // Sender information
    this.SenderUsername = SenderUsername;
    this.SenderFullName = SenderFullName;
  this.SenderAvatar = SenderAvatar;
    
    // Receiver information
    this.ReceiverUsername = ReceiverUsername;
    this.ReceiverFullName = ReceiverFullName;
    this.ReceiverAvatar = ReceiverAvatar;
  }

  /**
   * Convert to frontend-compatible format (MongoDB-like structure)
   */
  toFrontendFormat() {
    const isBase64Image = typeof this.Content === 'string' && this.Content.startsWith('data:image/');
    // images array populated by DAL: each item { id, data } - data contains base64
    const images = Array.isArray(this.Images) ? this.Images.map(i => {
      // Return ImageData (base64) directly
      return i.data || i.url;
    }).filter(Boolean) : (isBase64Image ? [this.Content] : []);

    return {
      _id: idToString(this.MessageID),
      sender: {
        _id: idToString(this.SenderID),
        username: this.SenderUsername,
        full_name: this.SenderFullName,
        avatar: this.SenderAvatar ? avatar(this.SenderAvatar) : null
      },
      receiver: {
        _id: idToString(this.ReceiverID),
        username: this.ReceiverUsername,
        full_name: this.ReceiverFullName,
        avatar: this.ReceiverAvatar ? avatar(this.ReceiverAvatar) : null
      },
      content: images.length === 0 ? (this.Content || '') : '',
      image_urls: images,
      sent_date: this.SentDate,
      is_read: false,
      // Backend-specific fields
      MessageID: this.MessageID,
      SenderID: this.SenderID,
      ReceiverID: this.ReceiverID
    };
  }

  /**
   * Validate message data
   */
  static validate(messageData) {
    const errors = [];
    
    if (!messageData.SenderID) {
      errors.push('SenderID là bắt buộc');
    }
    
    if (!messageData.ReceiverID) {
      errors.push('ReceiverID là bắt buộc');
    }
    
    if (!messageData.Content || messageData.Content.trim() === '') {
      errors.push('Content là bắt buộc');
    }
    
    // Allow large content if it's an image (base64 dataURI)
    if (messageData.Content && typeof messageData.Content === 'string' && !messageData.Content.startsWith('data:image/') && messageData.Content.length > 1000) {
      errors.push('Nội dung tin nhắn không được vượt quá 1000 ký tự');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if message has content
   */
  hasContent() {
    return !!(this.Content && this.Content.trim());
  }

  /**
   * Get message type
   */
  getType() {
    return 'text';
  }
}

module.exports = Message;
