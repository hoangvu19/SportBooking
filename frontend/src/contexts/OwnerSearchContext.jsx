import React, { createContext, useContext, useState } from 'react';

const OwnerSearchContext = createContext();

export const OwnerSearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <OwnerSearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </OwnerSearchContext.Provider>
  );
};

export const useOwnerSearch = () => {
  const context = useContext(OwnerSearchContext);
  if (!context) {
    throw new Error('useOwnerSearch must be used within OwnerSearchProvider');
  }
  return context;
};
