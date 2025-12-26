// Lightweight client-side blacklist for quick UI flagging
// Contains common obscene/vulgar tokens (normalized lowercased forms).
// This is not a replacement for server-side moderation but helps immediate UI feedback.

export const VIETNAMESE_BLACKLIST = [
  'địt mẹ',
  'địt',
  'cặc',
  'lồn',
  'đụ',
  'đĩ',
  'vãi',
  'đéo',
  'ngu',
  'đcm',
  'đm',
  'mẹ mày'
];

export const normalize = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ\s]/gi, ' ').replace(/\s+/g, ' ').trim();

export function containsBlacklistedPhrase(text) {
  if (!text) return false;
  const norm = normalize(text);
  for (const token of VIETNAMESE_BLACKLIST) {
    if (norm.includes(token)) return true;
  }
  return false;
}

// (default export defined at bottom)

// --- Additional heuristics ---

// Simple hate speech patterns (targeting protected classes)
const HATE_PATTERNS = [
  /dân tộc|chủng tộc|tôn giáo|tôn giáo của họ|nguoi hoa|nguoi khac/i,
  /đồng tính|gay|lesbian|người đồng tính/i,
  /đĩ điếm|đồ con mẹ/i
];

// Threat / violence keywords
const VIOLENCE_TOKENS = [
  'giết',
  'đánh',
  'làm cho chết',
  'đập',
  'tiêu diệt',
  'nã',
  'bắn',
  'hủy diệt'
];

export { VIOLENCE_TOKENS };

// PII simple regexes
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:(?:\+?84|0)\s?\d{1,2}[\s.-]?\d{3}[\s.-]?\d{3,4})/; // VN-ish
const IDCARD_RE = /số[\s:]*\d{5,}/i; // naive
const PII_KEYWORDS_RE = /địa chỉ|số điện thoại|số nhà|cccd|cmnd|số thẻ|thẻ|stk|tài khoản|mật khẩu/i;

// URL detection
const URL_RE = /https?:\/\//i;

export function containsHateSpeech(text) {
  if (!text) return false;
  const norm = (text || '').toString();
  for (const r of HATE_PATTERNS) if (r.test(norm)) return true;
  return false;
}

export function containsThreat(text) {
  if (!text) return false;
  const norm = normalize(text);
  for (const t of VIOLENCE_TOKENS) if (norm.includes(t)) return true;
  return false;
}

export function containsPII(text) {
  if (!text) return false;
  return EMAIL_RE.test(text) || PHONE_RE.test(text) || IDCARD_RE.test(text) || PII_KEYWORDS_RE.test(text);
}

export function containsLink(text) {
  if (!text) return false;
  return URL_RE.test(text) || /www\./i.test(text);
}

// Heuristic for spam: many links or repeated short posts or excessive punctuation
export function isLikelySpam(text) {
  if (!text) return false;
  const linkCount = (String(text).match(URL_RE) || []).length + (String(text).match(/www\./gi) || []).length;
  if (linkCount >= 2) return true;
  const short = String(text).trim().length < 30;
  const repeated = /(.)\1{6,}/.test(text); // repeated chars
  const manyHashtags = (String(text).match(/#/g) || []).length > 5;
  if (short && linkCount >= 1) return true;
  if (repeated || manyHashtags) return true;
  return false;
}

// Composite check used by UI to display red-flag quickly
export function isFlaggedContent(text) {
  if (!text) return false;
  if (containsBlacklistedPhrase(text)) return true;
  if (containsHateSpeech(text)) return true;
  if (containsThreat(text)) return true;
  if (containsPII(text)) return true;
  if (isLikelySpam(text)) return true;
  return false;
}

// extend default export
export default {
  containsBlacklistedPhrase,
  normalize,
  VIETNAMESE_BLACKLIST,
  containsHateSpeech,
  containsThreat,
  VIOLENCE_TOKENS,
  containsPII,
  containsLink,
  isLikelySpam,
  isFlaggedContent
};
