// Redirect to feature-specific Post model to keep backward compatibility
/**
 * Post Model Class
 * Represents a Post entity with all properties and business logic
 */
const { avatar, idToString, mapImageUrl, truncate } = require('../../utils/modelHelpers');

class Post {
	constructor({ 
		PostID, 
		AccountID, 
		Content, 
		CreatedDate, 
		Status, 
		// Additional fields from joins
		Username,
		FullName,
		AvatarUrl,
		Images = [],
		Reactions = [],
		CommentsCount = 0,
		SharesCount = 0
		,
		SharedPost = null,
		IsShare = false,
		SharedNote = null,
		Booking = null
	}) {
		this.PostID = PostID;
		this.AccountID = AccountID;
		this.Content = Content;
		this.CreatedDate = CreatedDate;
		this.Status = Status || 'Visible';
    
		// Author information
		this.Username = Username;
		this.FullName = FullName;
		this.AvatarUrl = AvatarUrl;
    
		// Related data
		this.Images = Images;
		this.Reactions = Reactions;
		this.CommentsCount = CommentsCount;
		this.SharesCount = SharesCount;
		this.SharedPost = SharedPost;
		this.IsShare = !!IsShare;
		this.SharedNote = SharedNote;
		this.Booking = Booking;
	}

	/**
	 * Convert to frontend-compatible format (MongoDB-like structure)
	 */
	toFrontendFormat() {
		// Determine post type
		let postType = 'text';
		if (this.Images && this.Images.length > 0) {
			postType = this.Content ? 'text_with_image' : 'image';
		}

		// Calculate likes count
		const likesCount = this.Reactions ? 
			this.Reactions.filter(r => r.ReactionType === 'Like').length : 0;

		return {
			_id: idToString(this.PostID),
			user: {
				_id: idToString(this.AccountID),
				username: this.Username,
				full_name: this.FullName,
				profile_picture: avatar(this.AvatarUrl)
			},
			content: this.Content,
			image_urls: this.Images ? this.Images.map(mapImageUrl).filter(Boolean) : [],
			post_type: postType,
			likes_count: Array(likesCount).fill().map((_, i) => `user_${i}`), // Mock likes array
			createdAt: this.CreatedDate,
			updatedAt: this.CreatedDate,
			// Backend-specific fields
			PostID: this.PostID,
			AccountID: this.AccountID,
			reactions: this.Reactions,
			commentsCount: this.CommentsCount,
			sharesCount: this.SharesCount,
			is_shared: this.IsShare,
			shared_note: this.SharedNote,
			shared_post: this.SharedPost,
			booking: this.Booking
		};
	}

	/**
	 * Validate post data
	 */
	static validate(postData) {
		const errors = [];
    
			if (!postData.Content || postData.Content.trim().length === 0) {
				errors.push('Post content must not be empty');
			}
    
			if (postData.Content && postData.Content.length > 2000) {
				errors.push('Post content must not exceed 2000 characters');
			}
    
			if (!postData.AccountID) {
				errors.push('AccountID is required');
			}
    
		return {
			isValid: errors.length === 0,
			errors
		};
	}

	/**
	 * Check if post is active
	 */
	isActive() {
		return this.Status === 'Visible';
	}

	/**
	 * Get post summary (truncated content)
	 */
	getSummary(maxLength = 100) {
		if (!this.Content) return '';
    
		if (this.Content.length <= maxLength) {
			return this.Content;
		}
    
		return this.Content.substring(0, maxLength) + '...';
	}

	/**
	 * Check if post has images
	 */
	hasImages() {
		return this.Images && this.Images.length > 0;
	}

	/**
	 * Get hashtags from content
	 */
	getHashtags() {
		if (!this.Content) return [];
    
		const hashtagRegex = /#[a-zA-Z0-9_]+/g;
		const matches = this.Content.match(hashtagRegex);
		return matches ? matches.map(tag => tag.substring(1)) : [];
	}

	/**
	 * Check if user reacted to this post
	 */
	getUserReaction(accountId) {
		if (!this.Reactions || this.Reactions.length === 0) return null;
    
		const userReaction = this.Reactions.find(r => r.AccountID === accountId);
		return userReaction ? userReaction.ReactionType : null;
	}

	/**
	 * Get reaction counts by type
	 */
	getReactionCounts() {
		if (!this.Reactions || this.Reactions.length === 0) {
			return { Like: 0, Love: 0, Angry: 0, Sad: 0, Wow: 0 };
		}

		const counts = {};
		this.Reactions.forEach(reaction => {
			counts[reaction.ReactionType] = (counts[reaction.ReactionType] || 0) + 1;
		});

		return {
			Like: counts.Like || 0,
			Love: counts.Love || 0,
			Angry: counts.Angry || 0,
			Sad: counts.Sad || 0,
			Wow: counts.Wow || 0
		};
	}
}

module.exports = Post;