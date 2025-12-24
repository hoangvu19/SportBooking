/**
 * StoryView Model Class
 * Represents a story view record - who viewed which story and when
 */
const { avatar, idToString } = require('../../utils/modelHelpers');

class StoryView {
  constructor({ 
    StoryViewID, 
    StoryID, 
    ViewerAccountID,
    ViewedAt,
    ViewerUsername,
    ViewerFullName,
    ViewerAvatarUrl
  }) {
    this.StoryViewID = StoryViewID;
    this.StoryID = StoryID;
    this.ViewerAccountID = ViewerAccountID;
    this.ViewedAt = ViewedAt;
    this.ViewerUsername = ViewerUsername;
    this.ViewerFullName = ViewerFullName;
    this.ViewerAvatarUrl = ViewerAvatarUrl;
  }

  toFrontendFormat() {
    return {
      _id: idToString(this.StoryViewID),
      story_id: idToString(this.StoryID),
      viewer: {
        _id: idToString(this.ViewerAccountID),
        username: this.ViewerUsername,
        full_name: this.ViewerFullName,
        profile_picture: avatar(this.ViewerAvatarUrl)
      },
      viewed_at: this.ViewedAt,
      StoryViewID: this.StoryViewID,
      StoryID: this.StoryID,
      ViewerAccountID: this.ViewerAccountID
    };
  }

  static validate(viewData) {
    const errors = [];
    
    if (!viewData.StoryID) {
      errors.push('StoryID là bắt buộc');
    }
    
    if (!viewData.ViewerAccountID) {
      errors.push('ViewerAccountID là bắt buộc');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = StoryView;
