/**
 * MessageImage model - represents an image attached to a Message
 */
class MessageImage {
  constructor({ ImageID, MessageID, ImageData, ImageUrl, CreatedAt }) {
    this.ImageID = ImageID;
    this.MessageID = MessageID;
    this.ImageData = ImageData;
    this.ImageUrl = ImageUrl;
    this.CreatedAt = CreatedAt;
  }

  toFrontend() {
    return {
      id: this.ImageID,
      messageId: this.MessageID,
      data: this.ImageData,
      url: this.ImageUrl,
      createdAt: this.CreatedAt
    };
  }
}

module.exports = MessageImage;
