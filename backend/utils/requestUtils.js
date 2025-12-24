function isBlank(value) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  return false;
}

function getAccountId(req) {
  if (!req || !req.user) {
    return null;
  }

  return req.user.AccountID ?? req.user.accountId ?? req.user.userId ?? req.user.id ?? null;
}

function parseInteger(value, defaultValue = null) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function ensurePositiveInteger(value, fieldName = 'Giá trị') {
  const parsed = parseInteger(value);

  if (parsed === null || parsed <= 0) {
    return {
      ok: false,
      message: `${fieldName} phải là số nguyên dương`
    };
  }

  return {
    ok: true,
    value: parsed
  };
}

function normalizePagination(query = {}, defaults = { page: 1, limit: 10 }) {
  const page = Math.max(1, parseInteger(query.page, defaults.page));
  const limit = Math.max(1, parseInteger(query.limit, defaults.limit));

  return { page, limit };
}

function toAbsoluteUrl(baseUrl, url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // Normalize backslashes
  let u = url.replace(/\\/g, '/').trim();

  if (u.startsWith('http://') || u.startsWith('https://')) {
    return u;
  }

  // protocol-relative //host/path -> prefix with protocol from baseUrl if available
  if (u.startsWith('//')) {
    try {
      const proto = baseUrl && baseUrl.startsWith('https') ? 'https:' : 'http:';
      return proto + u;
    } catch (e) {
      return u;
    }
  }

  // If it already starts with a slash, prefix baseUrl directly
  if (u.startsWith('/')) {
    return `${baseUrl}${u}`;
  }

  // Common case: DB stores 'uploads/...' or just a filename 'abc.mp4'
  if (u.startsWith('uploads/') || u.startsWith('./uploads/') || !u.includes('/')) {
    const clean = u.replace(/^\.\/?/, '');
    return `${baseUrl.replace(/\/$/, '')}/${clean}`;
  }

  // Fallback: return as-is
  return u;
}

module.exports = {
  isBlank,
  getAccountId,
  parseInteger,
  ensurePositiveInteger,
  normalizePagination,
  toAbsoluteUrl
};
