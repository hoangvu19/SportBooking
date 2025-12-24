const MediaAssetDAL = require('../../DAL/Social/MediaAssetDAL');

class MediaAssetModel {
  static async create(media) {
    return MediaAssetDAL.createMedia(media);
  }

  static async getByTarget(targetType, targetId) {
    return MediaAssetDAL.getByTarget(targetType, targetId);
  }

  static async getByTargets(targetType, targetIdArray) {
    return MediaAssetDAL.getByTargets(targetType, targetIdArray);
  }

  static async deleteById(mediaId) {
    return MediaAssetDAL.deleteById(mediaId);
  }

  static async deleteByTarget(targetType, targetId) {
    return MediaAssetDAL.deleteByTarget(targetType, targetId);
  }
}

module.exports = MediaAssetModel;
