// Redirect legacy imports from `src/i18n.js` to the canonical in-folder implementation
// so components that import `from '../i18n'` (file) or `from '../i18n/'` (folder)
// get the same API (I18nProvider + useI18n).
export { I18nProvider } from './i18n/index.jsx';
export { useI18n } from './i18n/hooks.js';
export { default as TRANSLATIONS } from './i18n/translations';
// keep a default export for compatibility
export * from './i18n/index.jsx';
