/**
 * Reaction Class
 * Represents a Reaction entity with all properties and business logic
 */
class Reaction {
  constructor({ 
    ReactionID, 
    AccountID, 
    PostID, 
    ReactionType, 
    CreatedDate,
    // Additional fields from joins
    Username,
    FullName,
    AvatarUrl
  }) {
    this.ReactionID = ReactionID;
    this.AccountID = AccountID;
    this.PostID = PostID;
    this.ReactionType = ReactionType;
    this.CreatedDate = CreatedDate;
    
    // User information
    this.Username = Username;
    this.FullName = FullName;
    this.AvatarUrl = AvatarUrl;
  }

  /**
   * Convert to frontend-compatible format (MongoDB-like structure)
   */
  toFrontendFormat() {
    return {
      _id: this.ReactionID?.toString(),
      user: {
        _id: this.AccountID?.toString(),
        username: this.Username,
        full_name: this.FullName,
        avatar_url: this.AvatarUrl
      },
      reaction_type: this.ReactionType,
      created_date: this.CreatedDate,
      // Backend-specific fields
      ReactionID: this.ReactionID,
      AccountID: this.AccountID,
      PostID: this.PostID
    };
  }

  /**
   * Validate reaction data
   */
  static validate(reactionData) {
    const errors = [];
    
    if (!reactionData.AccountID) {
      errors.push('AccountID là bắt buộc');
    }
    
    if (!reactionData.PostID) {
      errors.push('PostID là bắt buộc');
    }
    
    if (!reactionData.ReactionType) {
      errors.push('ReactionType là bắt buộc');
    }
    
    const validTypes = ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry'];
    if (reactionData.ReactionType && !validTypes.includes(reactionData.ReactionType)) {
      errors.push(`ReactionType phải là một trong: ${validTypes.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if reaction is like
   */
  isLike() {
    return this.ReactionType === 'Like';
  }

  /**
   * Check if reaction is love
   */
  isLove() {
    return this.ReactionType === 'Love';
  }
}

module.exports = Reaction;
