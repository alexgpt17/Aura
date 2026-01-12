// src/storage.js
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.alexmartens.tint';

export const saveTheme = async (theme) => {
  try {
    await SharedGroupPreferences.setItem('currentTheme', theme, APP_GROUP);
  } catch (e) {
    console.error('Error saving theme:', e);
  }
};

export const getTheme = async () => {
  try {
    const theme = await SharedGroupPreferences.getItem('currentTheme', APP_GROUP);
    return theme;
  } catch (e) {
    console.error('Error reading theme:', e);
    return null;
  }
};

export const saveSiteTheme = async (domain, theme) => {
  try {
    const existingThemes = await getSiteThemes() ?? {};
    const newThemes = {
      ...existingThemes,
      [domain]: theme,
    };
    await SharedGroupPreferences.setItem('siteThemes', newThemes, APP_GROUP);
  } catch (e) {
    console.error('Error saving site-specific theme:', e);
  }
};

export const getSiteThemes = async () => {
  try {
    const themes = await SharedGroupPreferences.getItem('siteThemes', APP_GROUP);
    return themes;
  } catch (e) {
    return null;
  }
};

export const overwriteSiteThemes = async (themes) => {
  try {
    await SharedGroupPreferences.setItem('siteThemes', themes, APP_GROUP);
  } catch (e) {
    console.error('Error overwriting site-specific themes:', e);
  }
};
