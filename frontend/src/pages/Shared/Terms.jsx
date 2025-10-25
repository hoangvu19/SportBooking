import React from 'react';
import { useI18n } from '../../i18n';

const Terms = () => {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-md p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{t('menu.terms')}</h2>
      <p className="text-sm text-gray-700">This is the terms and conditions page. You can replace this content with real terms.</p>
    </div>
  );
};

export default Terms;
