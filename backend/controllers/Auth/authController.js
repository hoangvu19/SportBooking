/**
 * Auth Controller - Database Integration with bcrypt
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const AccountDAL = require('../../DAL/Auth/accountDAL');
const {
  sendSuccess,
  sendCreated,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendNotFound
} = require('../../utils/responseHelper');
const {
  isBlank,
  normalizePagination
} = require('../../utils/requestUtils');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const SALT_ROUNDS = 12;

// In-memory OTP sessions store (no DB) - demo only
// Structure: otpSessions.set(sessionId, { code, AccountID, Email, expiresAt, attempts })
const crypto = require('crypto');
const otpSessions = new Map();

// Note: account activation-by-email flow removed. Registrations now create the DB user immediately.

// Email sending helper: try real SMTP if configured; on missing config or failure,
// automatically create an Ethereal test account and send the email there (dev only),
// and finally fall back to logging the OTP to the server console.
const sendOtpEmail = async (toEmail, code) => {
  const nodemailer = require('nodemailer');

  const host = (process.env.SMTP_HOST || '').trim();
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim(); // remove spaces accidentally inserted
  const from = process.env.SMTP_FROM || `no-reply@${host || 'localhost'}`;

  // Helper to do a send using a given transporter
  const doSend = async (transporter) => {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'Mã xác nhận đăng nhập',
      text: `Mã xác nhận đăng nhập của bạn là: ${code}. Mã có hiệu lực trong 5 phút.`
    });
    return info;
  };

  // 1) Try configured SMTP if available
  if ((host && user && pass) || (user && pass)) {
    try {
      // Special-case Gmail: use service option which configures secure/tls appropriately
      let transportOptions = {};
      if (user.toLowerCase().endsWith('@gmail.com') || (host && host.includes('gmail'))) {
        transportOptions = {
          service: 'gmail',
          auth: { user, pass }
        };
      } else {
        transportOptions = {
          host: host || undefined,
          port: port || 465,
          secure: (port || 465) === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false }
        };
      }

      const transporter = nodemailer.createTransport(transportOptions);

      // Verify transporter before sending to get early failure feedback
      await transporter.verify();

      const info = await doSend(transporter);
      console.info(`OTP email sent via SMTP to ${toEmail} (messageId: ${info && info.messageId})`);
      return { success: true, info };
    } catch (smtpErr) {
      // Log error (message only) and fall through to Ethereal fallback
      console.warn('OTP email send failed using configured SMTP:', smtpErr && (smtpErr.message || smtpErr));
    }
  }

  // 2) Try Ethereal (dev-only) as a reliable fallback so developers can preview emails
  try {
    // createTestAccount may throw in restricted environments, so wrap
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    const info = await doSend(transporter);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.info(`OTP sent to Ethereal preview URL for ${toEmail}: ${previewUrl}`);
    } else {
      console.info(`OTP sent via Ethereal for ${toEmail} (no preview URL available)`);
    }
    return true;
  } catch (ethErr) {
    console.warn('Ethereal fallback failed for OTP email:', ethErr && ethErr.message);
  }

  // 3) Final fallback: log to server console (useful for local/dev)
  // NOTE: This reveals the OTP in server logs; acceptable in local development but not for production.
  console.log(`OTP for ${toEmail}: ${code}`);
  return true;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)); // 6-digit

// Request OTP: validate credentials first, then send OTP to user's email
const requestLoginOtp = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (isBlank(identifier) || isBlank(password)) {
      return sendValidationError(res, 'Vui lòng nhập đầy đủ thông tin đăng nhập');
    }

    const user = await AccountDAL.getByIdentifier(identifier);
    if (!user) return sendUnauthorized(res, 'Tài khoản không tồn tại');

    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
    if (!isPasswordValid) return sendUnauthorized(res, 'Mật khẩu không đúng');

    if (user.Status !== 'Active') return sendUnauthorized(res, 'Tài khoản đã bị khóa');

    // Generate OTP and session
    const code = generateOtp();
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    otpSessions.set(sessionId, { code, AccountID: user.AccountID, Email: user.Email, expiresAt, attempts: 0 });

    // Send email (async)
    sendOtpEmail(user.Email, code).catch(e => console.warn('sendOtpEmail error', e && e.message));

    // If DEV_SHOW_OTP is enabled, include the OTP in the response for local testing only.
    if (String(process.env.DEV_SHOW_OTP).toLowerCase() === 'true') {
      console.warn('DEV_SHOW_OTP is enabled - returning OTP in response (development only)');
      return sendSuccess(res, { otpSessionId: sessionId, otp: code }, 'Mã xác nhận đã được gửi tới email (dev preview)');
    }

    return sendSuccess(res, { otpSessionId: sessionId }, 'Mã xác nhận đã được gửi tới email');
  } catch (error) {
    return sendError(res, 'Lỗi server khi yêu cầu mã xác nhận', 500, { error });
  }
};

  // Passwordless: send OTP to email for login (user provides email only)
  const sendLoginCode = async (req, res) => {
    try {
      const { email } = req.body;
      if (isBlank(email)) return sendValidationError(res, 'Vui lòng cung cấp email');

      const user = await AccountDAL.getByIdentifier(email);
      if (!user) return sendNotFound(res, 'Email không tồn tại trong hệ thống');
      if (user.Status !== 'Active') return sendUnauthorized(res, 'Tài khoản đã bị khóa');

      // Generate OTP and session
      const code = generateOtp();
      const sessionId = crypto.randomUUID();
      const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
      otpSessions.set(sessionId, { code, AccountID: user.AccountID, Email: user.Email, expiresAt, attempts: 0 });

      // Send email (async)
      sendOtpEmail(user.Email, code).catch(e => console.warn('sendOtpEmail error', e && e.message));

      if (String(process.env.DEV_SHOW_OTP).toLowerCase() === 'true') {
        console.warn('DEV_SHOW_OTP is enabled - returning OTP in response (development only)');
        return sendSuccess(res, { otpSessionId: sessionId, otp: code }, 'Mã xác nhận đã được gửi tới email (dev preview)');
      }

      return sendSuccess(res, { otpSessionId: sessionId }, 'Mã xác nhận đã được gửi tới email');
    } catch (error) {
      return sendError(res, 'Lỗi server khi gửi mã đăng nhập', 500, { error });
    }
  };

// Verify OTP and issue JWT
const verifyLoginOtp = async (req, res) => {
  try {
    const { otpSessionId, code } = req.body;
    if (isBlank(otpSessionId) || isBlank(code)) return sendValidationError(res, 'Session hoặc mã xác nhận không hợp lệ');

    const session = otpSessions.get(otpSessionId);
    if (!session) return sendUnauthorized(res, 'Phiên mã không hợp lệ hoặc đã hết hạn');

    if (Date.now() > session.expiresAt) {
      otpSessions.delete(otpSessionId);
      return sendUnauthorized(res, 'Mã xác nhận đã hết hạn');
    }

    session.attempts = (session.attempts || 0) + 1;
    // Limit attempts to 5
    if (session.attempts > 5) {
      otpSessions.delete(otpSessionId);
      return sendUnauthorized(res, 'Vượt quá số lần thử. Vui lòng yêu cầu mã mới');
    }

    if (session.code !== String(code).trim()) {
      // keep session alive but updated attempts
      otpSessions.set(otpSessionId, session);
      return sendUnauthorized(res, 'Mã xác nhận không đúng');
    }

    // OK - issue JWT
    const user = await AccountDAL.getById(session.AccountID);
    if (!user) return sendNotFound(res, 'Người dùng không tồn tại');

    const token = jwt.sign(
      { AccountID: user.AccountID, Username: user.Username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Clean up session
    otpSessions.delete(otpSessionId);

    return sendSuccess(res, { token, user: user.toFrontendFormat() }, 'Đăng nhập thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi xác minh mã', 500, { error });
  }
};

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
    
    // Hash password and create user immediately
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await AccountDAL.create({
      Username: username,
      PasswordHash: hashedPassword,
      FullName: fullName,
      Email: email,
      Bio: bio || null,
      Status: 'Active'
    });

    return sendCreated(res, { user: newUser.toFrontendFormat() }, 'Đăng ký thành công');
    
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

// Exports will be attached after all handlers are defined to avoid TDZ issues

// Note: activation endpoints removed — registrations create users immediately now.

// Final exports (after all functions are declared)
module.exports = {
  register,
  login,
  requestLoginOtp,
  sendLoginCode,
  verifyLoginOtp,
  getCurrentUser,
  updateProfile,
  changePassword,
  searchUsers,
  forgotPassword
};