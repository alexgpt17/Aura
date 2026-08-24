import React, { createContext, useContext, ReactNode } from 'react';

interface AppThemeContextType {
  appThemeColor: string;
  /** No-op — in-app appearance is fixed for MVP. */
  setAppThemeColor: (color: string) => Promise<void>;
  appThemeMode: 'dark' | 'light';
  /** No-op — in-app appearance is fixed for MVP. */
  setAppThemeMode: (mode: 'dark' | 'light') => Promise<void>;
  backgroundColor: string;
  textColor: string;
  sectionBgColor: string;
  borderColor: string;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

const DEFAULT_APP_THEME_COLOR = '#228B22'; // Forest green
const DEFAULT_APP_THEME_MODE: 'dark' | 'light' = 'dark';

const DARK_THEME = {
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  sectionBgColor: '#1a1a1a',
  borderColor: '#2a2a2a',
};

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const themeColors = DARK_THEME;

  return (
    <AppThemeContext.Provider
      value={{
        appThemeColor: DEFAULT_APP_THEME_COLOR,
        setAppThemeColor: async () => {},
        appThemeMode: DEFAULT_APP_THEME_MODE,
        setAppThemeMode: async () => {},
        backgroundColor: themeColors.backgroundColor,
        textColor: themeColors.textColor,
        sectionBgColor: themeColors.sectionBgColor,
        borderColor: themeColors.borderColor,
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(AppThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return context;
};
