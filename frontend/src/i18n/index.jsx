import React, {  useState, useEffect } from 'react';
import TRANSLATIONS from './translations';
import I18nContext from './context';
import enLocale from '../locales/en/translation.json';
import viLocale from '../locales/vi/translation.json';

// Simple deep merge: prefer locale overrides, fall back to base
function deepMerge(a, b) {
  if (!a) return b || {};
  if (!b) return a || {};
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const k of Object.keys(b)) {
    const va = a[k];
    const vb = b[k];
    if (va && typeof va === 'object' && !Array.isArray(va) && vb && typeof vb === 'object' && !Array.isArray(vb)) {
      out[k] = deepMerge(va, vb);
    } else {
      out[k] = vb;
    }
  }
  return out;
}

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('ui_lang') || 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    try { localStorage.setItem('ui_lang', lang); } catch { /* ignore */ }
    try { console.debug('[I18nProvider] active lang', lang); } catch { }
  }, [lang]);

  // Merge in JSON locale files so runtime lookups pick up keys added by scripts
  const LOCALES = {
    en: deepMerge(TRANSLATIONS.en || {}, enLocale || {}),
    vi: deepMerge(TRANSLATIONS.vi || {}, viLocale || {}),
  };

  const t = (path, fallback) => {
    if (!path) return fallback || '';
    const parts = path.split('.');
  let cur = LOCALES[lang] || LOCALES.en || TRANSLATIONS[lang] || TRANSLATIONS.en;
    for (let p of parts) {
      if (!cur) return fallback || path;
      cur = cur[p];
    }
    if (!cur) {
      try { console.debug('[i18n] missing translation', { path, lang, fallback }); } catch { }
      return fallback || path;
    }
    return cur;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};
