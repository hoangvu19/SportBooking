// Re-export the provider component and the hook from their modules so imports
// that use `import { I18nProvider, useI18n } from './i18n'` continue to work.
export { I18nProvider } from './index.jsx';
export { useI18n } from './hooks.js';
