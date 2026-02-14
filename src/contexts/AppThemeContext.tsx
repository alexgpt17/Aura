import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getThemes } from '../storage';

interface AppThemeContextType {
  appThemeColor: string;
  setAppThemeColor: (color: string) => Promise<void>;
  appThemeMode: 'dark' | 'light';
  setAppThemeMode: (mode: 'dark' | 'light') => Promise<void>;
  // Theme color helpers
  backgroundColor: string;
  textColor: string;
  sectionBgColor: string;
  borderColor: string;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

const DEFAULT_APP_THEME_COLOR = '#228B22'; // Forest green
const DEFAULT_APP_THEME_MODE: 'dark' | 'light' = 'dark';

// Theme color constants
const DARK_THEME = {
  backgroundColor: '#000000',
  textColor: '#FFFFFF',
  sectionBgColor: '#1a1a1a',
  borderColor: '#2a2a2a',
};

const LIGHT_THEME = {
  backgroundColor: '#FFFFFF',
  textColor: '#000000',
  sectionBgColor: '#F5F5F5',
  borderColor: '#E0E0E0',
};

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appThemeColor, setAppThemeColorState] = useState<string>(DEFAULT_APP_THEME_COLOR);
  const [appThemeMode, setAppThemeModeState] = useState<'dark' | 'light'>(DEFAULT_APP_THEME_MODE);

  useEffect(() => {
    loadAppThemeSettings();
  }, []);

  const loadAppThemeSettings = async () => {
    try {
      const themeData = await getThemes();
      const savedColor = themeData?.appThemeColor || DEFAULT_APP_THEME_COLOR;
      const savedMode = themeData?.appThemeMode || DEFAULT_APP_THEME_MODE;
      setAppThemeColorState(savedColor);
      setAppThemeModeState(savedMode);
    } catch (error) {
      console.error('Error loading app theme settings:', error);
      setAppThemeColorState(DEFAULT_APP_THEME_COLOR);
      setAppThemeModeState(DEFAULT_APP_THEME_MODE);
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

  const setAppThemeMode = async (mode: 'dark' | 'light') => {
    try {
      const { getThemes, saveThemes } = await import('../storage');
      const themeData = await getThemes();
      const newThemeData = {
        ...themeData,
        appThemeMode: mode,
      };
      await saveThemes(newThemeData);
      setAppThemeModeState(mode);
    } catch (error) {
      console.error('Error saving app theme mode:', error);
    }
  };

  const themeColors = appThemeMode === 'dark' ? DARK_THEME : LIGHT_THEME;

  return (
    <AppThemeContext.Provider 
      value={{ 
        appThemeColor, 
        setAppThemeColor,
        appThemeMode,
        setAppThemeMode,
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
