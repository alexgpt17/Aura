import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getThemes } from '../storage';

interface AppThemeContextType {
  appThemeColor: string;
  setAppThemeColor: (color: string) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

const DEFAULT_APP_THEME_COLOR = '#228B22'; // Forest green

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appThemeColor, setAppThemeColorState] = useState<string>(DEFAULT_APP_THEME_COLOR);

  useEffect(() => {
    loadAppThemeColor();
  }, []);

  const loadAppThemeColor = async () => {
    try {
      const themeData = await getThemes();
      const savedColor = themeData?.appThemeColor || DEFAULT_APP_THEME_COLOR;
      setAppThemeColorState(savedColor);
    } catch (error) {
      console.error('Error loading app theme color:', error);
      setAppThemeColorState(DEFAULT_APP_THEME_COLOR);
    }
  };

  const setAppThemeColor = async (color: string) => {
    try {
      const { getThemes, saveThemes } = await import('../storage');
      const themeData = await getThemes();
      const newThemeData = {
        ...themeData,
        appThemeColor: color,
      };
      await saveThemes(newThemeData);
      setAppThemeColorState(color);
    } catch (error) {
      console.error('Error saving app theme color:', error);
    }
  };

  return (
    <AppThemeContext.Provider value={{ appThemeColor, setAppThemeColor }}>
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
