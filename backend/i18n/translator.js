const TRANSLATIONS = require('./translations');

function normalizeLocale(loc) {
  if (!loc) return 'vi';
  const l = loc.toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('vi')) return 'vi';
  return 'vi';
}

function getLocaleFromReq(req) {
  if (!req) return 'vi';
  const header = req.headers && (req.headers['x-locale'] || req.headers['accept-language']);
  return normalizeLocale(header);
}

function t(key, locale = 'vi', params = {}) {
  const parts = key.split('.');
  const lang = TRANSLATIONS[locale] ? locale : 'vi';
  let cur = TRANSLATIONS[lang];
  for (const p of parts) {
    if (!cur) break;
    cur = cur[p];
  }
  if (!cur) return key;
  // simple param replace: {name}
  let text = cur;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return text;
}

module.exports = {
  t,
  getLocaleFromReq
};
