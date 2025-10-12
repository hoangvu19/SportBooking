const sql = require('mssql');
const { poolPromise } = require('../config/db');
const Account = require('../models/Account');

class UserDAL {
    /**
     * Lấy thông tin user theo ID
     * @param {number} userId 
     * @returns {Promise<Account|null>}
     */
    static async getUserById(userId) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        AccountID, Username, FullName, Email,
                       Bio, Gender, Address, Status, AvatarUrl, CreatedAt, UpdatedAt
                    FROM Account
                    WHERE AccountID = @userId AND Status = 'Active'
                `);

            if (result.recordset.length === 0) {
                return null;
            }

            const data = result.recordset[0];
            return new Account({
                AccountID: data.AccountID,
                Username: data.Username,
                FullName: data.FullName,
                Email: data.Email,
                PasswordHash: null, // password không trả về
                // Use actual Bio column from DB
                Bio: data.Bio,
                Gender: data.Gender,
                Address: data.Address,
                Status: data.Status,
                AvatarUrl: data.AvatarUrl,
                CreatedAt: data.CreatedAt,
                UpdatedAt: data.UpdatedAt
            });
        } catch (error) {
            console.error('❌ UserDAL.getUserById Error:', error);
            throw error;
        }
    }

    /**
     * Cập nhật profile user
     * @param {number} userId 
     * @param {Object} updateData 
     * @returns {Promise<Account>}
     */
    static async updateProfile(userId, updateData) {
        try {
            const pool = await poolPromise;
            const request = pool.request();

            const fields = [];
            request.input('userId', sql.Int, userId);

            // Only update fields that exist in DB
            if (updateData.fullName !== undefined) {
                fields.push('FullName = @fullName');
                request.input('fullName', sql.NVarChar, updateData.fullName);
            }
            if (updateData.email !== undefined) {
                fields.push('Email = @email');
                request.input('email', sql.NVarChar, updateData.email);
            }

            if (updateData.bio !== undefined) {
                // Update Bio column independently
                fields.push('Bio = @bio');
                request.input('bio', sql.NVarChar(sql.MAX), updateData.bio);
            }
            if (updateData.gender !== undefined) {
                fields.push('Gender = @gender');
                request.input('gender', sql.NVarChar, updateData.gender);
            }
            if (updateData.address !== undefined) {
                fields.push('Address = @address');
                request.input('address', sql.NVarChar, updateData.address);
            }
            if (updateData.avatarUrl !== undefined) {
                fields.push('AvatarUrl = @avatarUrl');
                // Accept large base64/data URLs, use NVARCHAR(MAX)
                request.input('avatarUrl', sql.NVarChar(sql.MAX), updateData.avatarUrl);
            }

            if (fields.length === 0) {
                throw new Error('Không có dữ liệu để cập nhật');
            }

            // Add UpdatedAt timestamp
            fields.push('UpdatedAt = GETDATE()');

            await request.query(`
                UPDATE Account
                SET ${fields.join(', ')}
                WHERE AccountID = @userId AND Status = 'Active'
            `);

            return await this.getUserById(userId);
        } catch (error) {
            console.error('❌ UserDAL.updateProfile Error:', error);
            throw error;
        }
    }

    /**
     * Tìm kiếm users
     * @param {string} searchQuery 
     * @param {number} limit 
     * @returns {Promise<Account[]>}
     */
    static async searchUsers(searchQuery, limit = 20) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('search', sql.NVarChar, `%${searchQuery}%`)
                .input('limit', sql.Int, limit)
                .query(`
                    SELECT TOP (@limit)
                        AccountID, Username, FullName, Email,
                         Bio, Address, AvatarUrl, Gender, CreatedAt, Status
                    FROM Account
                    WHERE Status = 'Active'
                        AND (
                            FullName LIKE @search 
                            OR Username LIKE @search 
                            OR Address LIKE @search
                        )
                    ORDER BY FullName
                `);

                return result.recordset.map(data => new Account({
                AccountID: data.AccountID,
                Username: data.Username,
                FullName: data.FullName,
                Email: data.Email,
                PasswordHash: null,
                Bio: data.Bio ,
                Gender: data.Gender,
                Address: data.Address,
                Status: data.Status,
                AvatarUrl: data.AvatarUrl,
                CreatedAt: data.CreatedAt,
                UpdatedAt: null
            }));
        } catch (error) {
            console.error('❌ UserDAL.searchUsers Error:', error);
            throw error;
        }
    }

    /**
     * Lấy gợi ý kết bạn cho user
     * @param {number} userId 
     * @param {number} limit 
     * @returns {Promise<Account[]>}
     */
    static async getSuggestions(userId, limit = 10) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('limit', sql.Int, limit)
                .query(`
                    SELECT TOP (@limit)
                        AccountID, Username, FullName, Email,
                       Bio, Address, AvatarUrl, Gender, CreatedAt, Status
                    FROM Account
                    WHERE Status = 'Active'
                        AND AccountID != @userId
                        AND AccountID NOT IN (
                            -- Exclude users already followed
                            SELECT FollowedAccountID 
                            FROM Follow 
                            WHERE FollowerAccountID = @userId
                        )
                    ORDER BY NEWID()
                `);

            return result.recordset.map(data => new Account({
                AccountID: data.AccountID,
                Username: data.Username,
                FullName: data.FullName,
                Email: data.Email,
                PasswordHash: null,
                Bio: data.Bio ,
                Gender: data.Gender,
                Address: data.Address,
                Status: data.Status,
                AvatarUrl: data.AvatarUrl,
                CreatedAt: data.CreatedAt,
                UpdatedAt: null
            }));
        } catch (error) {
            console.error('❌ UserDAL.getSuggestions Error:', error);
            throw error;
        }
    }
}

module.exports = UserDAL;
