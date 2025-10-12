/**
 * Account Model Class
 * Represents an Account entity with all properties and business logic
 */
const { avatar, idToString } = require('../utils/modelHelpers');

class Account {
  constructor({ 
    AccountID, 
    Username, 
    PasswordHash, 
    FullName, 
    Email, 
    Bio, 
    Gender, 
    Address, 
    Status, 
    AvatarUrl, 
    CreatedAt, 
    UpdatedAt 
  }) {
    this.AccountID = AccountID;
    this.Username = Username;
    this.PasswordHash = PasswordHash;
    this.FullName = FullName;
    this.Email = Email;
    this.Bio = Bio;
    this.Gender = Gender;
    this.Address = Address;
    this.Status = Status || 'Active';
    this.AvatarUrl = AvatarUrl;
    this.CreatedAt = CreatedAt;
    this.UpdatedAt = UpdatedAt;
  }

  /**
   * Convert to frontend-compatible format
   */
  toFrontendFormat() {
    return {
      _id: idToString(this.AccountID),
      AccountID: this.AccountID, // Keep for backend compatibility
      username: this.Username,
      full_name: this.FullName,
      email: this.Email,
      bio: this.Bio,
      gender: this.Gender,
      address: this.Address,
      status: this.Status,
      profile_picture: avatar(this.AvatarUrl),
      createdAt: this.CreatedAt,
      updatedAt: this.UpdatedAt,
      // Legacy field names for backend compatibility
      Username: this.Username,
      FullName: this.FullName,
      Email: this.Email
    };
  }

  /**
   * Validate account data
   */
  static validate(accountData) {
    const errors = [];
    
    if (!accountData.Username || accountData.Username.trim().length < 3) {
      errors.push('Username phải có ít nhất 3 ký tự');
    }
    
    if (!accountData.Email || !this.isValidEmail(accountData.Email)) {
      errors.push('Email không hợp lệ');
    }
    
    if (!accountData.FullName || accountData.FullName.trim().length < 2) {
      errors.push('Họ tên phải có ít nhất 2 ký tự');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if email format is valid
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if account is active
   */
  isActive() {
    return this.Status === 'Active';
  }

  /**
   * Get display name
   */
  getDisplayName() {
    return this.FullName || this.Username;
  }
}

module.exports = Account;