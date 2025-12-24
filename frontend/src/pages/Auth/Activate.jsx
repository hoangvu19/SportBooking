import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/hooks';

// Activation flow has been removed from this project.
// This page remains for compatibility but simply informs the user and points to login.
const Activate = () => {
  const { t } = useI18n();
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-lg w-full bg-white/5 p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">{t('auth.activateTitle', 'Kích hoạt tài khoản')}</h2>
        <p>{t('auth.activateMessage', 'Luồng kích hoạt qua email đã bị loại bỏ. Tài khoản được tạo ngay lập tức sau khi đăng ký.')}</p>
        <p className="mt-4">{t('auth.activateLoginPrompt', 'Vui lòng đăng nhập tại')} <Link to="/login" className="text-blue-500">{t('auth.loginPage', 'trang đăng nhập')}</Link>.</p>
      </div>
    </div>
  );
};

export default Activate;
