/**
 * Comment Model Class
 * Represents a Comment entity with all properties and business logic
 */
// Note: frontend is responsible for providing DEFAULT_AVATAR fallback
class Comment {
  constructor({ 
    CommentID, 
    PostID, 
    AccountID, 
    Content, 
    CommentDate,
    Status,
    ParentCommentID,
    // Additional fields from joins
    Username,
    FullName,
    AvatarUrl,
    Images = []
  }) {
    this.CommentID = CommentID;
    this.PostID = PostID;
    this.AccountID = AccountID;
    this.Content = Content;
    this.CommentDate = CommentDate;
    this.Status = Status || 'Active';
  this.ParentCommentID = ParentCommentID || null;
    
    // Author information
    this.Username = Username;
    this.FullName = FullName;
    this.AvatarUrl = AvatarUrl;
    
    // Related data
    this.Images = Images;
  }


  /**
   * Convert to frontend-compatible format
   */
  toFrontendFormat() {
    return {
      _id: this.CommentID?.toString(),
      CommentID: this.CommentID,
      PostID: this.PostID,
      user: {
        _id: this.AccountID?.toString(),
        username: this.Username,
        full_name: this.FullName,
  profile_picture: this.AvatarUrl || null
      },
      content: this.Content,
      images: this.Images,
  parentCommentId: this.ParentCommentID,
      commentDate: this.CommentDate,
      status: this.Status,
      createdAt: this.CommentDate,
      // Backend fields
      AccountID: this.AccountID
    };
  }

  /**
   * Validate comment data
   */
  static validate(commentData) {
    const errors = [];
    
    if (!commentData.Content || commentData.Content.trim().length === 0) {
      errors.push('Nội dung comment không được để trống');
    }
    
    if (commentData.Content && commentData.Content.length > 500) {
      errors.push('Nội dung comment không được vượt quá 500 ký tự');
    }
    
    if (!commentData.PostID) {
      errors.push('PostID là bắt buộc');
    }
    
    if (!commentData.AccountID) {
      errors.push('AccountID là bắt buộc');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if comment is active
   */
  isActive() {
    return this.Status === 'Active';
  }

  /**
   * Get comment summary (truncated content)
   */
  getSummary(maxLength = 50) {
    if (!this.Content) return '';
    
    if (this.Content.length <= maxLength) {
      return this.Content;
    }
    
    return this.Content.substring(0, maxLength) + '...';
  }

  /**
   * Check if comment has images
   */
  hasImages() {
    return this.Images && this.Images.length > 0;
  }
}

module.exports = Comment;