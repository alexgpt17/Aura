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
