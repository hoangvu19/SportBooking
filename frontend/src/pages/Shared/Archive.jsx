import React from 'react';
import { useI18n } from '../../i18n';

const Archive = () => {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-md p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{t('menu.archive')}</h2>
      <p className="text-sm text-gray-700">Archived items will be shown here.</p>
    </div>
  );
};

export default Archive;
