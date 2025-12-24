// Error types and messages
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_ERROR', 
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR'
};

export const ERROR_MESSAGES = {
  // Network errors
  CONNECTION_REFUSED: 'Cannot connect to server. Please check your network connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  
  // Auth errors  
  INVALID_CREDENTIALS: 'Invalid username or password',
  ACCOUNT_NOT_FOUND: 'Account not found',
  ACCOUNT_LOCKED: 'Account has been locked',
  
  // Validation errors
  EMPTY_FIELDS: 'Please fill in all required fields',
  INVALID_EMAIL: 'Invalid email address', 
  PASSWORD_TOO_SHORT: 'Password must be at least 6 characters',
  PASSWORD_NOT_MATCH: 'Passwords do not match',
  
  // Server errors
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unknown error occurred'
};

// Error handler class
export class AuthError extends Error {
  constructor(type, message, details = null) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.details = details;
  }
}

// Handle fetch errors
export const handleFetchError = (error) => {
  console.error('Fetch error details:', error);
  
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    if (error.message.includes('ERR_CONNECTION_REFUSED')) {
      return new AuthError(ERROR_TYPES.NETWORK, ERROR_MESSAGES.CONNECTION_REFUSED);
    }
    return new AuthError(ERROR_TYPES.NETWORK, ERROR_MESSAGES.CONNECTION_REFUSED);
  }
  
  if (error.name === 'AbortError') {
    return new AuthError(ERROR_TYPES.NETWORK, ERROR_MESSAGES.TIMEOUT);
  }
  
  return new AuthError(ERROR_TYPES.NETWORK, ERROR_MESSAGES.UNKNOWN_ERROR);
};

// Handle API response errors
export const handleApiError = (response, data) => {
  console.error('API error:', { status: response.status, data });
  
  switch (response.status) {
    case 400:
      return new AuthError(ERROR_TYPES.VALIDATION, data.message || ERROR_MESSAGES.EMPTY_FIELDS);
    case 401:
      return new AuthError(ERROR_TYPES.AUTH, data.message || ERROR_MESSAGES.INVALID_CREDENTIALS);
    case 403:
      return new AuthError(ERROR_TYPES.AUTH, data.message || ERROR_MESSAGES.ACCOUNT_LOCKED);
    case 404:
      return new AuthError(ERROR_TYPES.AUTH, data.message || ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    case 500:
      return new AuthError(ERROR_TYPES.SERVER, ERROR_MESSAGES.SERVER_ERROR);
    default:
      return new AuthError(ERROR_TYPES.SERVER, data.message || ERROR_MESSAGES.UNKNOWN_ERROR);
  }
};

// Validate form data
export const validateLoginForm = (usernameOrEmail, password) => {
  const errors = [];
  
  if (!usernameOrEmail?.trim()) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, 'Please enter username or email'));
  }
  
  if (!password?.trim()) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, 'Please enter password'));
  }
  
  return errors;
};

export const validateSignupForm = (formData) => {
  const errors = [];
  
  if (!formData.username?.trim()) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, 'Please enter a username'));
  }
  
  if (!formData.email?.trim()) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, 'Please enter an email'));
  }
  
  if (!formData.fullName?.trim()) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, 'Please enter your full name'));
  }
  
  if (!formData.password?.trim()) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, 'Please enter a password'));
  } else if (formData.password.length < 6) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, ERROR_MESSAGES.PASSWORD_TOO_SHORT));
  }
  
  if (formData.password !== formData.confirmPassword) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, ERROR_MESSAGES.PASSWORD_NOT_MATCH));
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (formData.email && !emailRegex.test(formData.email)) {
    errors.push(new AuthError(ERROR_TYPES.VALIDATION, ERROR_MESSAGES.INVALID_EMAIL));
  }
  
  return errors;
};