
const BookingPostDAL = require('../../DAL/Social/BookingPostDAL');

class BookingPost {
  static async createBookingPost(data) {
    return BookingPostDAL.createBookingPost(data);
  }

  static async addPlayerFromComment(postId, playerId, ownerId) {
    return BookingPostDAL.addPlayerFromComment(postId, playerId, ownerId);
  }

  static async acceptInvitation(postId, playerId) {
    return BookingPostDAL.acceptInvitation(postId, playerId);
  }

  static async rejectInvitation(postId, playerId) {
    return BookingPostDAL.rejectInvitation(postId, playerId);
  }

  static async getPlayers(postId) {
    return BookingPostDAL.getPlayers(postId);
  }

  static async getBySportType(sportTypeId, limit = 20, offset = 0) {
    return BookingPostDAL.getBySportType(sportTypeId, limit, offset);
  }

  static async getAll(limit = 20, offset = 0) {
    return BookingPostDAL.getAll(limit, offset);
  }

  static async getById(postId) {
    return BookingPostDAL.getById(postId);
  }

  static async getByBookingId(bookingId) {
    return BookingPostDAL.getByBookingId(bookingId);
  }

  static async autoHideExpiredPosts() {
    return BookingPostDAL.autoHideExpiredPosts();
  }

  static async getByUserId(userId, limit = 20, offset = 0) {
    return BookingPostDAL.getByUserId(userId, limit, offset);
  }
}

module.exports = BookingPost;
