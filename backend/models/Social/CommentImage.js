/**
 * CommentImage Model - Handles comment images
 */
const CommentImageDAL = require('../../DAL/Social/CommentImageDAL');

class CommentImageModel {
  static async createCommentImage(commentImageData) {
    return CommentImageDAL.createCommentImage(commentImageData);
  }

  static async getImagesByCommentId(commentId) {
    return CommentImageDAL.getImagesByCommentId(commentId);
  }

  static async deleteCommentImage(imageId) {
    return CommentImageDAL.deleteCommentImage(imageId);
  }

  static async deleteImagesByCommentId(commentId) {
    return CommentImageDAL.deleteImagesByCommentId(commentId);
  }
}

module.exports = CommentImageModel;