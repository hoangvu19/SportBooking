import React, {  useState, useEffect } from 'react';
import TRANSLATIONS from './translations';
import I18nContext from './context';

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('ui_lang') || 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    try { localStorage.setItem('ui_lang', lang); } catch { /* ignore */ }
  }, [lang]);

  const t = (path, fallback) => {
    if (!path) return fallback || '';
    const parts = path.split('.');
  let cur = TRANSLATIONS[lang] || TRANSLATIONS.en;
    for (let p of parts) {
      if (!cur) return fallback || path;
      cur = cur[p];
    }
    return cur || fallback || path;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};
