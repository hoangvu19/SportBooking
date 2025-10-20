const FollowDAL = require('../../models/Auth/Follow');

class FollowController {
    static async getFollowers(req, res) {
        try {
            const currentUserId = req.user.userId;
            const followers = await FollowDAL.getFollowers(currentUserId);
            res.json({ success: true, data: followers });
        } catch (error) {
            console.error('❌ getFollowers Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách followers' });
        }
    }

    static async getFollowing(req, res) {
        try {
            const currentUserId = req.user.userId;
            const following = await FollowDAL.getFollowing(currentUserId);
            res.json({ success: true, data: following });
        } catch (error) {
            console.error('❌ getFollowing Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách following' });
        }
    }

    static async followUser(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.userId;

            if (parseInt(userId) === currentUserId) {
                return res.status(400).json({ success: false, message: 'Không thể follow chính mình' });
            }

            const result = await FollowDAL.followUser(currentUserId, parseInt(userId));

            if (result && result.success !== false) {
                try {
                    const notifications = require('../../lib/notifications');
                    const UserDAL = require('../../DAL/Auth/userDAL');
                    const fromUser = await UserDAL.getUserById(currentUserId);
                    if (fromUser) {
                        const notify = {
                            type: 'follow',
                            fromUser: {
                                id: fromUser.AccountID,
                                fullName: fromUser.FullName,
                                username: fromUser.Username,
                                avatar: fromUser.AvatarUrl
                            },
                            message: `${fromUser.FullName || fromUser.Username} đã theo dõi bạn!`,
                            link: `/profile/${fromUser.AccountID}`,
                            createdAt: new Date(),
                            read: false
                        };
                        if (!notifications[parseInt(userId)]) notifications[parseInt(userId)] = [];
                        notifications[parseInt(userId)].unshift(notify);
                    }
                } catch (notifyErr) {
                    console.error('❌ follow notification error:', notifyErr);
                }
            }

            res.json(result);
        } catch (error) {
            console.error('❌ followUser Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi follow user' });
        }
    }

    static async unfollowUser(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.userId;
            const result = await FollowDAL.unfollowUser(currentUserId, parseInt(userId));
            res.json(result);
        } catch (error) {
            console.error('❌ unfollowUser Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi unfollow user' });
        }
    }
}

module.exports = FollowController;
