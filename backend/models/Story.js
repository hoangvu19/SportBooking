/**
 * Story Model Class
 * Represents a Story entity with all properties
 */
const { avatar, idToString } = require('../utils/modelHelpers');

class Story {
  constructor({ 
    StoryID, 
    AccountID, 
    Content, 
    MediaUrl,
    MediaType,
    BackgroundColor,
    CreatedDate, 
    ExpiresAt,
    Status,
    ViewCount,
    // Additional fields from joins
    Username,
    FullName,
    AvatarUrl
  }) {
    this.StoryID = StoryID;
    this.AccountID = AccountID;
    this.Content = Content;
    this.MediaUrl = MediaUrl;
    this.MediaType = MediaType || 'text';
    this.BackgroundColor = BackgroundColor;
    this.CreatedDate = CreatedDate;
    this.ExpiresAt = ExpiresAt;
    this.Status = Status || 'Active';
    this.ViewCount = ViewCount || 0;
    
    // Author information
    this.Username = Username;
    this.FullName = FullName;
    this.AvatarUrl = AvatarUrl;
  }

  /**
   * Convert to frontend-compatible format
   */
  toFrontendFormat() {
    return {
      _id: idToString(this.StoryID),
      user: {
        _id: idToString(this.AccountID),
        username: this.Username,
        full_name: this.FullName,
        profile_picture: avatar(this.AvatarUrl)
      },
      content: this.Content || '',
      media_url: this.MediaUrl || '',
      media_type: this.MediaType,
      background_color: this.BackgroundColor || '#4f46e5',
      createdAt: this.CreatedDate,
      expiresAt: this.ExpiresAt,
      viewCount: this.ViewCount,
      // Backend-specific fields
      StoryID: this.StoryID,
      AccountID: this.AccountID,
      Status: this.Status
    };
  }

  /**
   * Validate story data
   */
  static validate(storyData) {
    const errors = [];
    
    if (!storyData.Content && !storyData.MediaUrl) {
      errors.push('Story phải có nội dung hoặc media');
    }
    
    if (storyData.Content && storyData.Content.length > 500) {
      errors.push('Nội dung story không được vượt quá 500 ký tự');
    }
    
    if (!storyData.AccountID) {
      errors.push('AccountID là bắt buộc');
    }

    const validMediaTypes = ['text', 'image', 'video'];
    if (storyData.MediaType && !validMediaTypes.includes(storyData.MediaType)) {
      errors.push('MediaType không hợp lệ');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if story is still active (not expired)
   */
  isActive() {
    return this.Status === 'Active' && new Date(this.ExpiresAt) > new Date();
  }

  /**
   * Check if story has expired
   */
  isExpired() {
    return new Date(this.ExpiresAt) <= new Date();
  }
}

module.exports = Story;
