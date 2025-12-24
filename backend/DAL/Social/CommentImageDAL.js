const MediaAssetDAL = require('./MediaAssetDAL');

class CommentImageDAL {
  static async createCommentImage(commentImageData) {
    const { commentId, imageUrl, accountId } = commentImageData;
    const created = await MediaAssetDAL.createMedia({ targetType: 'Comment', targetId: commentId, url: imageUrl, mediaType: 'Image', accountId: accountId || null });
    if (!created) return { success: false, data: null };
    return { success: true, data: { ImageID: created.MediaID, CommentID: created.TargetID, ImageUrl: created.URL, UploadedDate: created.UploadedDate } };
  }

  static async getImagesByCommentId(commentId) {
    const rows = await MediaAssetDAL.getByTarget('Comment', commentId);
    return rows.map(r => ({ ImageID: r.MediaID, CommentID: r.TargetID, ImageUrl: r.URL, UploadedDate: r.UploadedDate }));
  }

  static async deleteCommentImage(imageId) {
    return MediaAssetDAL.deleteById(imageId);
  }

  static async deleteImagesByCommentId(commentId) {
    return MediaAssetDAL.deleteByTarget('Comment', commentId);
  }
}

module.exports = CommentImageDAL;
