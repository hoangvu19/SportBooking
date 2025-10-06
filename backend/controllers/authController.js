/**
 * Auth Controller - Database Integration with bcrypt
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const AccountDAL = require('../DAL/accountDAL');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendNotFound
} = require('../utils/responseHelper');
const {
  isBlank,
  normalizePagination
} = require('../utils/requestUtils');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const SALT_ROUNDS = 12;

const register = async (req, res) => {
  try {
    const { username, password, fullName, email, bio } = req.body;
    
    if ([username, password, fullName, email].some(isBlank)) {
      return sendValidationError(res, 'Vui lòng nhập đầy đủ thông tin');
    }
    
    // Check if user already exists in database
    const existingUser1 = await AccountDAL.getByIdentifier(username);
    const existingUser2 = await AccountDAL.getByIdentifier(email);
    if (existingUser1 || existingUser2) {
      return sendError(res, 'Tên đăng nhập hoặc email đã tồn tại', 409);
    }
    
    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Create new user in database
    const newUser = await AccountDAL.create({
      Username: username,
      PasswordHash: hashedPassword, // Use bcrypt hashed password
      FullName: fullName,
      Email: email,
      // Store bio in Bio column (independent from Address)
      Bio: bio || null,
      Status: 'Active'
    });
    
    // Generate token
    const token = jwt.sign(
      { 
        AccountID: newUser.AccountID, 
        Username: newUser.Username 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    return sendCreated(res, {
      token,
      user: newUser.toFrontendFormat()
    }, 'Đăng ký thành công');
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi đăng ký', 500, { error });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (isBlank(identifier) || isBlank(password)) {
      return sendValidationError(res, 'Vui lòng nhập đầy đủ thông tin đăng nhập');
    }
    
    
    // Find user in database
    const user = await AccountDAL.getByIdentifier(identifier);
    if (!user) {
      return sendUnauthorized(res, 'Tài khoản không tồn tại');
    }

    // FIX: SỬ DỤNG BCRYPT.COMPARE() để so sánh mật khẩu đã hash
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
    
    if (!isPasswordValid) {
      return sendUnauthorized(res, 'Mật khẩu không đúng');
    }
    
    if (user.Status !== 'Active') {
      return sendUnauthorized(res, 'Tài khoản đã bị khóa');
    }
    
    
    // Generate token
    const token = jwt.sign(
      { 
        AccountID: user.AccountID, 
        Username: user.Username 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    return sendSuccess(res, {
      token,
      user: user.toFrontendFormat()
    }, 'Đăng nhập thành công');
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi đăng nhập', 500, { error });
  }
};

// NOTE: Các hàm bên dưới (getCurrentUser, updateProfile, changePassword, searchUsers)
// hiện tại vẫn đang sử dụng mockUsers (từ code gốc của bạn) thay vì AccountModel đã được sửa.
// Nếu muốn sử dụng database, cần thay thế logic mockUsers bằng AccountModel.findById
// và dùng bcrypt.hash/compare cho changePassword.

const getCurrentUser = async (req, res) => {
  try {
    const user = await AccountDAL.getById(req.user.AccountID); 
    
    if (!user) {
      return sendNotFound(res, 'Không tìm thấy thông tin người dùng');
    }

    return sendSuccess(res, user.toFrontendFormat());
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi lấy thông tin người dùng', 500, { error });
  }
};

const updateProfile = async (req, res) => {
  try {
  const { fullName, email, bio, gender, address, avatarUrl } = req.body;
  const accountId = req.user.AccountID;

  // Lấy thông tin hiện tại từ DB
  const currentUser = await AccountDAL.getById(accountId);
  if (!currentUser) {
    return sendNotFound(res, 'Không tìm thấy người dùng');
  }

  // Build update payload; store bio into Bio column and keep Address separate
  const updatePayload = {};
  if (fullName !== undefined) updatePayload.FullName = fullName;
  if (email !== undefined) updatePayload.Email = email;
  if (gender !== undefined) updatePayload.Gender = gender;
  if (avatarUrl !== undefined) updatePayload.AvatarUrl = avatarUrl;
  // If client sent bio, store into Bio column
  if (bio !== undefined) updatePayload.Bio = bio;
  // If client sent explicit address, set Address (separate field)
  if (address !== undefined) updatePayload.Address = address;

  // If no fields provided, return error
  if (Object.keys(updatePayload).length === 0) {
    return sendValidationError(res, 'Không có dữ liệu để cập nhật');
  }

  const updatedUser = await AccountDAL.update(accountId, updatePayload);

    return sendSuccess(res, {
      AccountID: updatedUser.AccountID,
      Username: updatedUser.Username,
      FullName: updatedUser.FullName,
      Email: updatedUser.Email
    }, 'Cập nhật thông tin thành công');
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi cập nhật thông tin', 500, { error });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const accountId = req.user.AccountID;
    
    if (isBlank(oldPassword) || isBlank(newPassword)) {
      return sendValidationError(res, 'Vui lòng cung cấp đầy đủ mật khẩu cũ và mới');
    }

    if (oldPassword === newPassword) {
      return sendValidationError(res, 'Mật khẩu mới phải khác mật khẩu cũ');
    }

    const user = await AccountDAL.getById(accountId);
    if (!user) {
      return sendNotFound(res, 'Không tìm thấy người dùng');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!isOldPasswordValid) {
      return sendUnauthorized(res, 'Mật khẩu cũ không đúng');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await AccountDAL.setPassword(accountId, newPasswordHash);

    return sendSuccess(res, null, 'Đổi mật khẩu thành công');
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi đổi mật khẩu', 500, { error });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    const { page: normalizedPage, limit: normalizedLimit } = normalizePagination({ page, limit }, { page: 1, limit: 20 });

    const accounts = await AccountDAL.search(query || '', normalizedPage, normalizedLimit);

    return sendSuccess(res, accounts.map((u) => ({
      AccountID: u.AccountID,
      Username: u.Username,
      FullName: u.FullName,
      Email: u.Email
    })), 'Tìm kiếm người dùng thành công', {
      meta: {
        page: normalizedPage,
        limit: normalizedLimit,
        returned: accounts.length
      }
    });
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi tìm kiếm người dùng', 500, { error });
  }
};

// Simple forgot password implementation (for demo)
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (isBlank(email)) {
      return sendValidationError(res, 'Vui lòng nhập email');
    }
    
    const user = await AccountDAL.getByIdentifier(email);
    if (!user) {
      return sendNotFound(res, 'Email không tồn tại trong hệ thống');
    }
    
    return sendSuccess(res, null, 'Email khôi phục mật khẩu đã được gửi! (Demo mode)');
    
  } catch (error) {
    return sendError(res, 'Lỗi server khi xử lý yêu cầu khôi phục mật khẩu', 500, { error });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  changePassword,
  searchUsers,
  forgotPassword
};