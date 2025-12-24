import React from 'react';
import useI18n from '../i18n/hooks';

const LanguageSwitcher = () => {
  const { lang, setLang } = useI18n();

  const change = (l) => {
    try {
      console.debug('[components/LanguageSwitcher] request setLang', l, 'current', lang);
      setLang(l);
      try { console.debug('[components/LanguageSwitcher] localStorage ui_lang after set:', localStorage.getItem('ui_lang')); } catch (err) { console.debug('ls read failed', err && err.message); }
      try {
        const desired = l;
        setTimeout(() => {
          try {
            const stored = localStorage.getItem('ui_lang');
            if (stored !== desired) {
              console.debug('[components/LanguageSwitcher] reload fallback, stored:', stored, 'desired:', desired);
              window.location.reload();
            }
          } catch (e) {
            console.debug('reload fallback check failed', e && e.message);
            try { window.location.reload(); } catch  { /* ignore */ }
          }
        }, 120);
      } catch { /* ignore fallback errors */ }
    } catch (e) {
      console.debug('language change failed', e && e.message);
    }
  };

  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      <button disabled={lang === 'vi'} onClick={() => change('vi')}>VI</button>
      <button disabled={lang === 'en'} onClick={() => change('en')}>EN</button>
    </div>
  );
};

export default LanguageSwitcher;
