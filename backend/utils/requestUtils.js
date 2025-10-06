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

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  return url.startsWith('/') ? `${baseUrl}${url}` : url;
}

module.exports = {
  isBlank,
  getAccountId,
  parseInteger,
  ensurePositiveInteger,
  normalizePagination,
  toAbsoluteUrl
};
