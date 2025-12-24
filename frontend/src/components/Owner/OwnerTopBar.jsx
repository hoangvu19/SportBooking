import React from 'react';
import { Search, Edit2, User } from 'lucide-react';
import LanguageSwitcher from '../../components/Shared/LanguageSwitcher';
import { useI18n } from '../../i18n/hooks';

const OwnerTopBar = () => {
  const { t } = useI18n();

  return (
    <div className="w-full flex items-center justify-between mb-4">
      <div className="flex-1" />

      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-3xl">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input placeholder={t('common.searchPlaceholder') || 'Search ...'} className="w-full pl-10 pr-10 py-3 rounded-full border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-100" />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Edit2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex justify-end items-center gap-4">
        <div className="hidden sm:flex items-center">
          <LanguageSwitcher />
        </div>
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-500" />
        </div>
      </div>
    </div>
  );
};

export default OwnerTopBar;
