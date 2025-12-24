const FollowDAL = require('../../DAL/Auth/followDAL');

class FollowModel {
    static async followUser(followerAccountId, followedAccountId) {
        return FollowDAL.followUser(followerAccountId, followedAccountId);
    }

    static async unfollowUser(followerAccountId, followedAccountId) {
        return FollowDAL.unfollowUser(followerAccountId, followedAccountId);
    }

    static async getFollowers(userId) {
        return FollowDAL.getFollowers(userId);
    }

    static async getFollowing(userId) {
        return FollowDAL.getFollowing(userId);
    }

    static async isFollowing(followerAccountId, followedAccountId) {
        return FollowDAL.isFollowing(followerAccountId, followedAccountId);
    }

    static async getFollowersCount(userId) {
        return FollowDAL.getFollowersCount(userId);
    }

    static async getFollowingCount(userId) {
        return FollowDAL.getFollowingCount(userId);
    }
}

module.exports = FollowModel;
