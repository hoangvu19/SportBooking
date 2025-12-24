import React from 'react';
import { useI18n } from '../../i18n/hooks';
import toast from 'react-hot-toast';

const LanguageSwitcher = ({ className }) => {
  const { lang, setLang } = useI18n();
  return (
    <div className={className || 'flex items-center gap-2'}>
      <button
        onClick={async (e) => {
          try {
            console.debug('[LanguageSwitcher] requesting setLang en', { current: lang });
            if (setLang) setLang('en');
            try { console.debug('[LanguageSwitcher] localStorage ui_lang after set:', localStorage.getItem('ui_lang')); } catch (err) { console.debug('ls read failed', err && err.message); }
          } catch (e) { console.debug('setLang failed', e && e.message); }
          // Fallback: reload if localStorage doesn't reflect the requested language
          try {
            const desired = 'en';
            setTimeout(() => {
              try {
                const stored = localStorage.getItem('ui_lang');
                if (stored !== desired) {
                  console.debug('[Shared/LanguageSwitcher] reload fallback, stored:', stored, 'desired:', desired);
                  window.location.reload();
                }
              } catch {
                console.debug('reload fallback failed');
                try { window.location.reload(); } catch { /* ignore */ }
              }
            }, 120);
          } catch  { /* ignore */ }
          try {
            if ((e && (e.ctrlKey || e.altKey)) && window && window.location && window.location.hostname === 'localhost') {
              const resp = await fetch('/api/internal/scan-i18n', { method: 'POST' });
              if (resp && resp.ok) {
                const json = await resp.json();
                console.log('i18n scan result', json);
                toast.success(`Scanned ${json.scannedFiles} files, ${json.hardStrings.length} hard strings, ${json.missingTKeys.length} missing keys`);
              }
            }
          } catch (e2) {
            console.debug('scan request failed', e2 && e2.message);
          }
        }}
        aria-pressed={lang === 'en'}
        className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-gray-100 text-gray-900' : 'hover:text-cyan-500 text-gray-600'}`}
      >
        En
      </button>
      <div className="text-gray-300">|</div>
      <button
        onClick={async (e) => {
          try {
            console.debug('[LanguageSwitcher] requesting setLang vi', { current: lang });
            if (setLang) setLang('vi');
            try { console.debug('[LanguageSwitcher] localStorage ui_lang after set:', localStorage.getItem('ui_lang')); } catch (err) { console.debug('ls read failed', err && err.message); }
          } catch (e) { console.debug('setLang failed', e && e.message); }
          // Fallback: reload if localStorage doesn't reflect the requested language
          try {
            const desired = 'vi';
            setTimeout(() => {
              try {
                const stored = localStorage.getItem('ui_lang');
                if (stored !== desired) {
                  console.debug('[Shared/LanguageSwitcher] reload fallback, stored:', stored, 'desired:', desired);
                  window.location.reload();
                }
              } catch {
                console.debug('reload fallback failed');
                try { window.location.reload(); } catch { /* ignore */ }
              }
            }, 120);
          } catch  { /* ignore */ }
          try {
            if ((e && (e.ctrlKey || e.altKey)) && window && window.location && window.location.hostname === 'localhost') {
              const resp = await fetch('/api/internal/scan-i18n', { method: 'POST' });
              if (resp && resp.ok) {
                const json = await resp.json();
                console.log('i18n scan result', json);
                toast.success(`Đã quét ${json.scannedFiles} file, ${json.hardStrings.length} chuỗi cứng, ${json.missingTKeys.length} key thiếu`);
              }
            }
          } catch (e2) {
            console.debug('scan request failed', e2 && e2.message);
          }
        }}
        aria-pressed={lang === 'vi'}
        className={`px-2 py-1 rounded ${lang === 'vi' ? 'bg-gray-100 text-gray-900' : 'hover:text-cyan-500 text-gray-600'}`}
      >
        VN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
