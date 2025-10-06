/**
 * PostImage Model - Handles post images
 */
const PostImageDAL = require('../DAL/PostImageDAL');

class PostImageModel {
	static async createPostImage(postImageData) {
		return PostImageDAL.createPostImage(postImageData);
	}

	static async getImagesByPostId(postId) {
		return PostImageDAL.getImagesByPostId(postId);
	}

	static async deletePostImage(imageId) {
		return PostImageDAL.deletePostImage(imageId);
	}

	static async deleteImagesByPostId(postId) {
		return PostImageDAL.deleteImagesByPostId(postId);
	}
}

module.exports = PostImageModel;