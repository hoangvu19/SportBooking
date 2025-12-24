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
const crypto = require('crypto');
const otpSessions = new Map();
// Pending registrations waiting for email verification
const pendingRegistrations = new Map();
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
  console.log(`OTP for ${toEmail}: ${code}`);
  return true;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000)); 
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

    // Do not send email for login OTP by design. Return OTP in response so
    // login via OTP works without sending email (inline flow).
    console.debug('Login OTP generated for', user.Email, 'sessionId', sessionId);
    console.warn('Returning OTP in response for login OTP (no-email flow)');
    return sendSuccess(res, { otpSessionId: sessionId, otp: code }, 'Mã xác nhận đã được tạo (inline)');
  } catch (error) {
    return sendError(res, 'Lỗi server khi yêu cầu mã xác nhận', 500, { error });
  }
};
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

      // Do not send email for passwordless login code by design.
      console.debug('Passwordless login OTP generated for', user.Email, 'sessionId', sessionId);

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
    const { username, password, fullName, email, bio, phoneNumber } = req.body;

    if ([username, password, fullName, email, phoneNumber].some(isBlank)) {
      return sendValidationError(res, 'Vui lòng nhập đầy đủ thông tin');
    }

    // Basic validation rules
    const usernameNorm = String(username || '').trim();
    const fullNameNorm = String(fullName || '').trim();
    const passwordStr = String(password || '');
    const phoneStr = String(phoneNumber || '').trim();

    // Username: allow letters, numbers, ., _, - ; length 4-30
    const usernameRegex = /^[A-Za-z0-9._-]{4,30}$/;
    if (!usernameRegex.test(usernameNorm)) {
      return sendValidationError(res, 'Tên đăng nhập không hợp lệ. Vui lòng sử dụng 4-30 ký tự chữ, số hoặc . _ -');
    }

    // Full name: at least 3 characters (letters and spaces)
    if (fullNameNorm.length < 3 || fullNameNorm.length > 80) {
      return sendValidationError(res, 'Họ và tên phải có ít nhất 3 ký tự');
    }

    // Password complexity: at least 8 characters, include upper, lower, digit, special
    if (passwordStr.length < 8 || passwordStr.length > 128) {
      return sendValidationError(res, 'Mật khẩu phải có ít nhất 8 ký tự');
    }
    const pwdRegex = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,128}/;
    if (!pwdRegex.test(passwordStr)) {
      return sendValidationError(res, 'Mật khẩu phải chứa chữ hoa, chữ thường, chữ số và ký tự đặc biệt');
    }

    // Phone: simple digits check (allow leading +). Require 9-15 digits
    if (phoneStr) {
      const digits = phoneStr.replace(/[^0-9]/g, '');
      if (digits.length < 9 || digits.length > 15) {
        return sendValidationError(res, 'Số điện thoại không hợp lệ');
      }
    }

    // Check if username/email/phone already exist in database
    const existingUserByUsername = await AccountDAL.usernameExists(username);
    const existingUserByEmail = await AccountDAL.emailExists(email);
    const existingUserByPhone = await AccountDAL.phoneExists(phoneNumber);

    if (existingUserByUsername) {
      return sendError(res, 'Tên đăng nhập đã tồn tại', 409);
    }
    if (existingUserByEmail) {
      return sendError(res, 'Email đã tồn tại', 409);
    }
    if (existingUserByPhone) {
      return sendError(res, 'Số điện thoại đã được sử dụng', 409);
    }

    // Create a pending registration and send verification OTP to the email.
    // The account will NOT be created until the user verifies the OTP.
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const code = generateOtp();
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes for registration

    pendingRegistrations.set(sessionId, {
      Username: username,
      PasswordHash: hashedPassword,
      FullName: fullName,
      Email: email,
      PhoneNumber: phoneNumber || null,
      Bio: bio || null,
      Status: 'Pending',
      code,
      expiresAt,
      attempts: 0
    });

    // Attempt to send verification email. If sending fails, clean up and return error.
    try {
      await sendOtpEmail(email, code);
    } catch (emailErr) {
      pendingRegistrations.delete(sessionId);
      console.warn('Failed to send registration verification email:', emailErr && (emailErr.message || emailErr));
      return sendError(res, 'Không thể gửi email xác thực', 500, { error: emailErr });
    }

    if (String(process.env.DEV_SHOW_OTP).toLowerCase() === 'true') {
      return sendSuccess(res, { otpSessionId: sessionId, otp: code }, 'Mã xác nhận đã được gửi tới email (dev preview)');
    }

    return sendSuccess(res, { otpSessionId: sessionId }, 'Mã xác nhận đã được gửi tới email. Vui lòng kiểm tra email để hoàn tất đăng ký');

  } catch (error) {
    return sendError(res, 'Lỗi server khi đăng ký', 500, { error });
  }
};

// Verify registration OTP and create account
const verifyRegister = async (req, res) => {
  try {
    const { otpSessionId, code } = req.body;
    if (isBlank(otpSessionId) || isBlank(code)) return sendValidationError(res, 'Session hoặc mã xác nhận không hợp lệ');

    const pending = pendingRegistrations.get(otpSessionId);
    if (!pending) return sendUnauthorized(res, 'Phiên đăng ký không hợp lệ hoặc đã hết hạn');

    if (Date.now() > pending.expiresAt) {
      pendingRegistrations.delete(otpSessionId);
      return sendUnauthorized(res, 'Mã xác nhận đã hết hạn');
    }

    pending.attempts = (pending.attempts || 0) + 1;
    if (pending.attempts > 5) {
      pendingRegistrations.delete(otpSessionId);
      return sendUnauthorized(res, 'Vượt quá số lần thử. Vui lòng đăng ký lại');
    }

    if (String(pending.code).trim() !== String(code).trim()) {
      pendingRegistrations.set(otpSessionId, pending);
      return sendUnauthorized(res, 'Mã xác nhận không đúng');
    }

    // Double-check uniqueness before creating account (race conditions)
    const existingUserByUsername = await AccountDAL.usernameExists(pending.Username);
    const existingUserByEmail = await AccountDAL.emailExists(pending.Email);
    const existingUserByPhone = await AccountDAL.phoneExists(pending.PhoneNumber);

    if (existingUserByUsername || existingUserByEmail || existingUserByPhone) {
      pendingRegistrations.delete(otpSessionId);
      return sendError(res, 'Không thể tạo tài khoản vì thông tin đã được sử dụng', 409);
    }

    const newUser = await AccountDAL.create({
      Username: pending.Username,
      PasswordHash: pending.PasswordHash,
      FullName: pending.FullName,
      Email: pending.Email,
      PhoneNumber: pending.PhoneNumber,
      Bio: pending.Bio,
      Status: 'Active'
    });

    pendingRegistrations.delete(otpSessionId);

    return sendCreated(res, { user: newUser.toFrontendFormat() }, 'Đăng ký thành công');
  } catch (error) {
    return sendError(res, 'Lỗi server khi xác minh đăng ký', 500, { error });
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
    const { username, email } = req.body;

    if (isBlank(username) || isBlank(email)) {
      return sendValidationError(res, 'Vui lòng nhập username và email');
    }

    // Lookup by username to ensure user exists and email matches
    const user = await AccountDAL.getByUsername(username);
    if (!user) return sendNotFound(res, 'Người dùng không tồn tại');

    if (!user.Email || user.Email.toString().toLowerCase() !== email.toString().toLowerCase()) {
      return sendUnauthorized(res, 'Username và email không khớp');
    }

    // generate temporary password ensuring it meets complexity (upper, lower, digit, special)
    const genTemp = (len = 12) => {
      const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      const lower = 'abcdefghjkmnpqrstuvwxyz';
      const digits = '23456789';
      const special = '!@#$%&*?';
      const all = upper + lower + digits + special;
      const pick = (set) => set[Math.floor(Math.random() * set.length)];

      // ensure at least one of each
      let arr = [pick(upper), pick(lower), pick(digits), pick(special)];
      for (let i = arr.length; i < len; i++) arr.push(pick(all));
      // shuffle
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.join('');
    };

    const newPassword = genTemp(12);
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Persist new password hash
    await AccountDAL.setPassword(user.AccountID, newHash);

    // send email with the new password
    const sendResetEmail = async (toEmail, pwd) => {
      const nodemailer = require('nodemailer');
      const host = (process.env.SMTP_HOST || '').trim();
      const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
      const userCfg = (process.env.SMTP_USER || '').trim();
      const passCfg = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
      const from = process.env.SMTP_FROM || `no-reply@${host || 'localhost'}`;

      const doSend = async (transporter) => {
        const info = await transporter.sendMail({
          from,
          to: toEmail,
          subject: 'Yêu cầu khôi phục mật khẩu',
          text: `Mật khẩu tạm thời của bạn là: ${pwd}\nVui lòng đăng nhập và đổi mật khẩu ngay.`
        });
        return info;
      };

      if ((host && userCfg && passCfg) || (userCfg && passCfg)) {
        try {
          let transportOptions = {};
          if (userCfg.toLowerCase().endsWith('@gmail.com') || (host && host.includes('gmail'))) {
            transportOptions = { service: 'gmail', auth: { user: userCfg, pass: passCfg } };
          } else {
            transportOptions = { host: host || undefined, port: port || 465, secure: (port || 465) === 465, auth: { user: userCfg, pass: passCfg }, tls: { rejectUnauthorized: false } };
          }
          const transporter = nodemailer.createTransport(transportOptions);
          await transporter.verify();
          const info = await doSend(transporter);
          console.info('Reset email sent via SMTP to', toEmail, info && info.messageId);
          return { success: true, info };
        } catch (smtpErr) {
          console.warn('Reset email send failed using configured SMTP:', smtpErr && (smtpErr.message || smtpErr));
        }
      }

      try {
        const testAccount = await nodemailer.createTestAccount();
        const transporter = nodemailer.createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } });
        const info = await doSend(transporter);
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) console.info(`Reset email preview URL: ${previewUrl}`);
        return { success: true, info };
      } catch (ethErr) {
        console.warn('Ethereal fallback failed for reset email:', ethErr && ethErr.message);
      }

      // last resort: log the password to console (dev convenience)
      console.log(`Temporary password for ${toEmail}: ${pwd}`);
      return { success: true };
    };

    await sendResetEmail(user.Email, newPassword);

    return sendSuccess(res, null, 'Mật khẩu mới đã được gửi tới email (nếu có)');

  } catch (error) {
    return sendError(res, 'Lỗi server khi xử lý yêu cầu khôi phục mật khẩu', 500, { error });
  }
};

// Exports will be attached after all handlers are defined to avoid TDZ issues

// Note: activation endpoints removed — registrations create users immediately now.

// Final exports (after all functions are declared)
module.exports = {
  register,
  verifyRegister,
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