const UserDAL = require('../../DAL/Auth/userDAL');
const PostDAL = require('../../DAL/Social/PostDAL');
const FollowDAL = require('../../DAL/Auth/followDAL');
const path = require('path');
const fs = require('fs');
class UserController {
    static async getUserProfile(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user?.userId;

            const user = await UserDAL.getUserById(parseInt(userId));
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            const [followersCount, followingCount, isFollowing] = await Promise.all([
                FollowDAL.getFollowersCount(parseInt(userId)),
                FollowDAL.getFollowingCount(parseInt(userId)),
                currentUserId ? FollowDAL.isFollowing(currentUserId, parseInt(userId)) : Promise.resolve(false)
            ]);

            const userData = user.toFrontendFormat();
            userData.followersCount = followersCount;
            userData.followingCount = followingCount;
            userData.isFollowing = isFollowing;

            res.json({
                success: true,
                data: userData
            });
        } catch (error) {
            console.error('❌ getUserProfile Error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy thông tin user'
            });
        }
    }

    static async updateProfile(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.userId;
            if (parseInt(userId) !== currentUserId) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền cập nhật profile này'
                });
            }

            const updateData = req.body;
            const updatedUser = await UserDAL.updateProfile(parseInt(userId), updateData);

            res.json({
                success: true,
                message: 'Cập nhật profile thành công',
                data: updatedUser.toFrontendFormat()
            });
        } catch (error) {
            console.error('❌ updateProfile Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Lỗi khi cập nhật profile'
            });
        }
    }
    static async uploadAvatar(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.userId;

            if (parseInt(userId) !== currentUserId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật ảnh này' });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có file được gửi' });
            }
            const storage = require('../../lib/storage');
            const original = req.file.originalname || 'avatar';
            const result = await storage.saveFile({ bufferPath: req.file.path, originalName: original, userId: currentUserId });
            const updatedUser = await UserDAL.updateProfile(parseInt(userId), { avatarUrl: result.url });

            res.json({ success: true, data: updatedUser.toFrontendFormat(), url: result.url, storage: result.storage });
        } catch (error) {
            console.error('❌ uploadAvatar Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi upload avatar' });
        }
    }
    static async getUserPosts(req, res) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const posts = await PostDAL.getPostsByUserId(
                parseInt(userId),
                parseInt(limit),
                parseInt(page)
            );

            res.json({
                success: true,
                data: posts.map(post => post.toFrontendFormat()),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    hasMore: posts.length === parseInt(limit)
                }
            });
        } catch (error) {
            console.error('❌ getUserPosts Error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy bài viết của user'
            });
        }
    }
        static async getUserLikedPosts(req, res) {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 20 } = req.query;
                const offset = (parseInt(page) - 1) * parseInt(limit);

                const pool = await require('../../config/db').poolPromise;
                const mssql = require('mssql');
                const likesResult = await pool.request()
                    .input('AccountID', mssql.Int, parseInt(userId))
                    .input('Offset', mssql.Int, offset)
                    .input('Limit', mssql.Int, parseInt(limit))
                    .query(`
                        SELECT r.PostID AS PostID, r.CreatedDate
                        FROM Reaction r
                        WHERE r.AccountID = @AccountID AND r.ReactionType = 'Like' AND r.PostID IS NOT NULL
                        ORDER BY r.CreatedDate DESC
                        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
                    `);

                const postIds = (likesResult.recordset || []).map(r => r.PostID).filter(Boolean);

                if (!postIds || postIds.length === 0) {
                    return res.json({
                        success: true,
                        data: [],
                        pagination: { page: parseInt(page), limit: parseInt(limit), hasMore: false }
                    });
                }

                const PostDAL = require('../../DAL/Social/PostDAL');
                const posts = await PostDAL.getByIds(postIds);

                res.json({
                    success: true,
                    data: posts.map(p => p.toFrontendFormat()),
                    pagination: { page: parseInt(page), limit: parseInt(limit), hasMore: posts.length === parseInt(limit) }
                });
            } catch (error) {
                console.error('❌ getUserLikedPosts Error:', error && error.message ? error.message : error);
                if (error && error.stack) console.error(error.stack);
                res.status(500).json({ success: false, message: 'Lỗi khi lấy bài viết đã like' });
            }
        }

    static async searchUsers(req, res) {
        try {
            const { q, limit = 20 } = req.query;

            if (!q || q.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập từ khóa tìm kiếm'
                });
            }

            const users = await UserDAL.searchUsers(q.trim(), parseInt(limit));

            res.json({
                success: true,
                data: users.map(user => user.toFrontendFormat())
            });
        } catch (error) {
            console.error('❌ searchUsers Error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tìm kiếm users'
            });
        }
    }

    static async getSuggestions(req, res) {
        try {
            const currentUserId = req.user.userId;
            const { limit = 10 } = req.query;

            const users = await UserDAL.getSuggestions(currentUserId, parseInt(limit));

            res.json({
                success: true,
                data: users.map(user => user.toFrontendFormat())
            });
        } catch (error) {
            console.error('❌ getSuggestions Error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy gợi ý kết bạn'
            });
        }
    }

    static async getFollowers(req, res) {
        try {
            const currentUserId = req.user.userId;

            const followers = await FollowDAL.getFollowers(currentUserId);

            res.json({
                success: true,
                data: followers
            });
        } catch (error) {
            console.error('❌ getFollowers Error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách followers'
            });
        }
    }

    static async getFollowing(req, res) {
        try {
            const currentUserId = req.user.userId;

            const following = await FollowDAL.getFollowing(currentUserId);

            res.json({
                success: true,
                data: following
            });
        } catch (error) {
            console.error('❌ getFollowing Error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách following'
            });
        }
    }

    static async followUser(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.userId;

            if (parseInt(userId) === currentUserId) {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể follow chính mình'
                });
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
            res.status(500).json({
                success: false,
                message: 'Lỗi khi follow user'
            });
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
            res.status(500).json({
                success: false,
                message: 'Lỗi khi unfollow user'
            });
        }
    }
}

module.exports = UserController;
