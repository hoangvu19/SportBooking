import { useContext } from 'react';
import I18nContext from './context';

export const useI18n = () => {
  return useContext(I18nContext);
};

export default useI18n;
