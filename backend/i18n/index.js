const fs = require('fs');
const path = require('path');

const load = (fname) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, fname), 'utf8'));
  } catch (e) {
    return {};
  }
};

const LOCALES = {
  en: load('en.json'),
  vi: load('vi.json')
};

function t(key, lang = 'en', vars = {}) {
  const parts = String(key || '').split('.');
  let cur = LOCALES[lang] || LOCALES.en || {};
  for (const p of parts) {
    if (!cur) return key;
    cur = cur[p];
  }
  if (typeof cur !== 'string') return key;
  return cur.replace(/\{(\w+)\}/g, (_, n) => (vars[n] !== undefined ? String(vars[n]) : `{${n}}`));
}

module.exports = { t };
