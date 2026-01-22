// src/storage.js
import SharedGroupPreferences from 'react-native-shared-group-preferences';

// The App Group ID must match the one used in the native Safari Extension.
const APP_GROUP = 'group.com.alexmartens.tint';

// The key for the single data object shared with the extension.
const THEME_DATA_KEY = 'tintThemeData';

/**
 * Returns default theme data structure
 */
const getDefaultThemeData = () => {
  return {
    globalTheme: {
      backgroundType: "color",
      background: "#FFFFFF",
      text: "#000000",
      link: "#0000EE",
      enabled: true,
      backgroundImage: null,
    },
    siteThemes: {}
  };
};

/**
 * Validates theme data structure to prevent corrupted data
 */
const validateThemeData = (themeData) => {
  if (!themeData || typeof themeData !== 'object') {
    return false;
  }
  
  // Check if it's an array (which would be wrong)
  if (Array.isArray(themeData)) {
    return false;
  }
  
  // Count properties to detect corruption
  const propertyCount = Object.keys(themeData).length;
  if (propertyCount > 1000) { // Sanity check - should be 2 (globalTheme, siteThemes)
    console.error('Theme data has too many properties:', propertyCount);
    return false;
  }
  
  // Check for required structure: must have globalTheme or be empty
  if (propertyCount > 0 && !themeData.globalTheme && !themeData.siteThemes) {
    console.error('Theme data missing required structure:', Object.keys(themeData));
    return false;
  }
  
  // If globalTheme exists, validate it's an object
  if (themeData.globalTheme && (typeof themeData.globalTheme !== 'object' || Array.isArray(themeData.globalTheme))) {
    console.error('globalTheme is not a valid object:', themeData.globalTheme);
    return false;
  }
  
  return true;
};

/**
 * Saves the entire theme configuration (global and site-specific) to the App Group.
 * @param {object} themeData - An object containing globalTheme and siteThemes.
 *                             Example: { globalTheme: {...}, siteThemes: {...} }
 */
export const saveThemes = async (themeData) => {
  try {
    // Validate before saving
    if (!validateThemeData(themeData)) {
      console.error('Invalid theme data structure, not saving');
      throw new Error('Invalid theme data structure');
    }
    
    console.log('Saving all theme data to App Group:', themeData);
    await SharedGroupPreferences.setItem(THEME_DATA_KEY, themeData, APP_GROUP);
    console.log('Theme data saved successfully.');
  } catch (e) {
    console.error('Error saving theme data:', e);
    throw e;
  }
};

/**
 * Clears corrupted data from App Group storage
 * Attempts multiple strategies to overwrite corrupted data
 */
export const clearThemes = async () => {
  try {
    console.log('Clearing theme data from App Group...');
    
    // Strategy 1: Set to valid default structure (this overwrites corrupted data better than empty object)
    try {
      const defaultData = getDefaultThemeData();
      await SharedGroupPreferences.setItem(THEME_DATA_KEY, defaultData, APP_GROUP);
      console.log('Theme data cleared and set to defaults.');
      
      // Verify it worked by reading it back
      let verify = await SharedGroupPreferences.getItem(THEME_DATA_KEY, APP_GROUP);
      // Parse if string
      if (typeof verify === 'string') {
        try {
          verify = JSON.parse(verify);
        } catch (e) {
          console.log('Could not parse verify data:', e);
        }
      }
      if (verify && validateThemeData(verify)) {
        console.log('Clear successful - verified valid data in storage');
        return;
      }
    } catch (e) {
      console.log('Strategy 1 failed, trying empty object:', e);
    }
    
    // Strategy 2: Try setting to empty object
    try {
      await SharedGroupPreferences.setItem(THEME_DATA_KEY, {}, APP_GROUP);
      console.log('Theme data cleared (empty object).');
    } catch (e) {
      console.error('Could not clear via setItem - data may be too corrupted to overwrite');
      console.error('You may need to delete and reinstall the app to clear UserDefaults');
      throw new Error('Could not clear corrupted data - app reinstall required');
    }
  } catch (e) {
    console.error('Error clearing theme data:', e);
    throw e; // Re-throw so the UI can show an error
  }
};

/**
 * Retrieves the entire theme configuration from the App Group.
 * @returns {Promise<object|null>} A promise that resolves to the theme data object,
 *                                  or null if it doesn't exist or an error occurs.
 */
export const getThemes = async () => {
  try {
    console.log('Loading all theme data from App Group...');
    let themeDataRaw = await SharedGroupPreferences.getItem(THEME_DATA_KEY, APP_GROUP);
    console.log('Retrieved raw theme data:', themeDataRaw);
    console.log('Raw data type:', typeof themeDataRaw);
    
    // If no data is present, return a default structure.
    if (!themeDataRaw) {
      console.log('No theme data found, returning defaults');
      const defaults = getDefaultThemeData();
      // Auto-save defaults so they persist
      try {
        await SharedGroupPreferences.setItem(THEME_DATA_KEY, defaults, APP_GROUP);
      } catch (e) {
        console.error('Could not save defaults:', e);
      }
      return defaults;
    }
    
    // Parse JSON string if needed (library may return string instead of object)
    let themeData = themeDataRaw;
    if (typeof themeDataRaw === 'string') {
      try {
        themeData = JSON.parse(themeDataRaw);
        console.log('Parsed JSON string to object:', themeData);
      } catch (parseError) {
        console.error('Failed to parse JSON string:', parseError);
        console.error('Invalid JSON string:', themeDataRaw);
        // Try to clear and return defaults
        try {
          await clearThemes();
        } catch (clearError) {
          console.error('Failed to clear corrupted data:', clearError);
        }
        return getDefaultThemeData();
      }
    }
    
    // Validate parsed data
    if (!validateThemeData(themeData)) {
      console.error('Retrieved theme data is corrupted after parsing:', themeData);
      console.error('Type:', typeof themeData, 'Is Array:', Array.isArray(themeData));
      if (themeData && typeof themeData === 'object') {
        console.error('Keys:', Object.keys(themeData));
        console.error('Property count:', Object.keys(themeData).length);
      }
      
      // Try to clear and set defaults
      try {
        await clearThemes();
        return getDefaultThemeData();
      } catch (clearError) {
        console.error('Failed to clear corrupted data:', clearError);
        // Still return defaults even if clear failed
        return getDefaultThemeData();
      }
    }
    
    return themeData;
  } catch (e) {
    console.error('Error reading theme data:', e);
    // If error suggests corruption (Property storage limit), return defaults
    // We can't clear it here because the read itself is failing
    const errorMsg = e?.message || String(e);
    if (errorMsg.includes('Property storage') || errorMsg.includes('196607')) {
      console.error('CORRUPTED DATA DETECTED - App Group storage has corrupted data');
      console.error('SOLUTION: Delete the app and reinstall to clear UserDefaults');
    }
    
    // Return defaults even on error
    const defaults = getDefaultThemeData();
    // Try to save defaults (may fail if storage is corrupted)
    try {
      await SharedGroupPreferences.setItem(THEME_DATA_KEY, defaults, APP_GROUP);
    } catch (saveError) {
      console.error('Could not save defaults after error:', saveError);
    }
    return defaults;
  }
};
