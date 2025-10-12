const UserDAL = require('../DAL/userDAL');
const PostDAL = require('../DAL/PostDAL');
const FollowDAL = require('../DAL/followDAL');
const path = require('path');
const fs = require('fs');

class UserController {
    /**
     * GET /api/users/:userId - Lấy thông tin profile user
     */
    static async getUserProfile(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user?.userId; // Từ auth middleware

            const user = await UserDAL.getUserById(parseInt(userId));
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy user'
                });
            }

            // Lấy thống kê
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

    /**
     * PUT /api/users/:userId - Cập nhật profile
     */
    static async updateProfile(req, res) {
        try {
            const { userId } = req.params;
            const currentUserId = req.user.userId;

            // Chỉ cho phép update profile của chính mình
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

    /**
     * POST /api/users/:userId/avatar - Upload avatar file (multipart)
     */
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

            // Delegate storage (S3 or disk)
            const storage = require('../lib/storage');
            const original = req.file.originalname || 'avatar';
            const result = await storage.saveFile({ bufferPath: req.file.path, originalName: original, userId: currentUserId });

            // Persist returned URL in DB
            const updatedUser = await UserDAL.updateProfile(parseInt(userId), { avatarUrl: result.url });

            res.json({ success: true, data: updatedUser.toFrontendFormat(), url: result.url, storage: result.storage });
        } catch (error) {
            console.error('❌ uploadAvatar Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi khi upload avatar' });
        }
    }

    /**
     * GET /api/users/:userId/posts - Lấy bài viết của user
     */
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

        /**
         * GET /api/users/:userId/likes - lấy danh sách bài viết user đã like
         */
        static async getUserLikedPosts(req, res) {
            try {
                const { userId } = req.params;
                const { page = 1, limit = 20 } = req.query;
                const offset = (parseInt(page) - 1) * parseInt(limit);

                const pool = await require('../config/db').poolPromise;
                const mssql = require('mssql');

                // Find PostIDs that this user has reacted with 'Like'
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

                const PostDAL = require('../DAL/PostDAL');
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

    /**
     * GET /api/users/search - Tìm kiếm users
     */
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

    /**
     * GET /api/users/suggestions - Lấy gợi ý kết bạn
     */
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

    /**
     * GET /api/users/followers - Lấy danh sách followers
     */
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

    /**
     * GET /api/users/following - Lấy danh sách following
     */
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

    /**
     * POST /api/users/follow/:userId - Follow user
     */
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

            // Nếu follow thành công thì gửi thông báo cho user được follow
            if (result && result.success !== false) {
                try {
                    const notifications = require('../lib/notifications');
                    const UserDAL = require('../DAL/userDAL');
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

    /**
     * DELETE /api/users/unfollow/:userId - Unfollow user
     */
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
