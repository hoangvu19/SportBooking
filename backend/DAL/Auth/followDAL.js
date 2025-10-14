const sql = require('mssql');
const { poolPromise } = require('../../config/db');

class FollowDAL {
    /**
     * Follow một user
     * @param {number} followerAccountId - User thực hiện follow
     * @param {number} followedAccountId - User được follow
     * @returns {Promise<object>}
     */
    static async followUser(followerAccountId, followedAccountId) {
        try {
            const pool = await poolPromise;
            
            // Kiểm tra đã follow chưa
            const checkResult = await pool.request()
                .input('followerAccountId', sql.Int, followerAccountId)
                .input('followedAccountId', sql.Int, followedAccountId)
                .query(`
                    SELECT FollowID 
                    FROM Follow 
                    WHERE FollowerAccountID = @followerAccountId 
                        AND FollowedAccountID = @followedAccountId
                `);

            if (checkResult.recordset.length > 0) {
                return {
                    success: false,
                    message: 'Đã follow user này rồi'
                };
            }

            const result = await pool.request()
                .input('followerAccountId', sql.Int, followerAccountId)
                .input('followedAccountId', sql.Int, followedAccountId)
                .query(`
                    INSERT INTO Follow (FollowerAccountID, FollowedAccountID, CreatedDate)
                    VALUES (@followerAccountId, @followedAccountId, GETDATE());
                    SELECT SCOPE_IDENTITY() AS FollowID;
                `);

            return {
                success: true,
                followId: result.recordset[0].FollowID,
                message: 'Follow thành công'
            };
        } catch (error) {
            console.error('❌ FollowDAL.followUser Error:', error);
            throw error;
        }
    }

    /**
     * Unfollow một user
     * @param {number} followerAccountId 
     * @param {number} followedAccountId 
     * @returns {Promise<object>}
     */
    static async unfollowUser(followerAccountId, followedAccountId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('followerAccountId', sql.Int, followerAccountId)
                .input('followedAccountId', sql.Int, followedAccountId)
                .query(`
                    DELETE FROM Follow
                    WHERE FollowerAccountID = @followerAccountId
                        AND FollowedAccountID = @followedAccountId
                `);

            return {
                success: result.rowsAffected[0] > 0,
                message: result.rowsAffected[0] > 0 ? 'Unfollow thành công' : 'Không tìm thấy follow'
            };
        } catch (error) {
            console.error('❌ FollowDAL.unfollowUser Error:', error);
            throw error;
        }
    }

    /**
     * Lấy danh sách followers của user
     * @param {number} userId 
     * @returns {Promise<Array>}
     */
    static async getFollowers(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        a.AccountID, a.Username, a.FullName, 
                        a.AvatarUrl as ProfilePictureURL, a.Bio,
                        f.CreatedDate as FollowedDate
                    FROM Follow f
                    INNER JOIN Account a ON f.FollowerAccountID = a.AccountID
                    WHERE f.FollowedAccountID = @userId
                        AND a.Status = 'Active'
                    ORDER BY f.CreatedDate DESC
                `);

            return result.recordset;
        } catch (error) {
            console.error('❌ FollowDAL.getFollowers Error:', error);
            throw error;
        }
    }

    /**
     * Lấy danh sách following của user
     * @param {number} userId 
     * @returns {Promise<Array>}
     */
    static async getFollowing(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        a.AccountID, a.Username, a.FullName, 
                        a.AvatarUrl as ProfilePictureURL, a.Bio,
                        f.CreatedDate as FollowedDate
                    FROM Follow f
                    INNER JOIN Account a ON f.FollowedAccountID = a.AccountID
                    WHERE f.FollowerAccountID = @userId
                        AND a.Status = 'Active'
                    ORDER BY f.CreatedDate DESC
                `);

            return result.recordset;
        } catch (error) {
            console.error('❌ FollowDAL.getFollowing Error:', error);
            throw error;
        }
    }

    /**
     * Kiểm tra user A có follow user B không
     * @param {number} followerAccountId 
     * @param {number} followedAccountId 
     * @returns {Promise<boolean>}
     */
    static async isFollowing(followerAccountId, followedAccountId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('followerAccountId', sql.Int, followerAccountId)
                .input('followedAccountId', sql.Int, followedAccountId)
                .query(`
                    SELECT FollowID 
                    FROM Follow 
                    WHERE FollowerAccountID = @followerAccountId 
                        AND FollowedAccountID = @followedAccountId
                `);

            return result.recordset.length > 0;
        } catch (error) {
            console.error('❌ FollowDAL.isFollowing Error:', error);
            throw error;
        }
    }

    /**
     * Đếm số followers của user
     * @param {number} userId 
     * @returns {Promise<number>}
     */
    static async getFollowersCount(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT COUNT(*) as Count
                    FROM Follow
                    WHERE FollowedAccountID = @userId
                `);

            return result.recordset[0].Count;
        } catch (error) {
            console.error('❌ FollowDAL.getFollowersCount Error:', error);
            throw error;
        }
    }

    /**
     * Đếm số following của user
     * @param {number} userId 
     * @returns {Promise<number>}
     */
    static async getFollowingCount(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT COUNT(*) as Count
                    FROM Follow
                    WHERE FollowerAccountID = @userId
                `);

            return result.recordset[0].Count;
        } catch (error) {
            console.error('❌ FollowDAL.getFollowingCount Error:', error);
            throw error;
        }
    }
}

module.exports = FollowDAL;
