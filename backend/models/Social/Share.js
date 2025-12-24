/**
 * Share Model - Handles post sharing
 */
const ShareDAL = require('../../DAL/Social/ShareDAL');

class ShareModel {
  static async createShare(shareData) {
    return ShareDAL.createShare(shareData);
  }

  static async getSharesByPostId(postId) {
    return ShareDAL.getSharesByPostId(postId);
  }

  static async getSharesByAccountId(accountId) {
    return ShareDAL.getSharesByAccountId(accountId);
  }

  static async hasUserSharedPost(accountId, postId) {
    return ShareDAL.hasUserSharedPost(accountId, postId);
  }

  static async deleteShare(shareId) {
    return ShareDAL.deleteShare(shareId);
  }

  static async deleteShareByAccountAndPost(accountId, postId) {
    return ShareDAL.deleteShareByAccountAndPost(accountId, postId);
  }

  static async getShareCount(postId) {
    return ShareDAL.getShareCount(postId);
  }
}

module.exports = ShareModel;