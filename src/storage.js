// src/storage.js
import SharedGroupPreferences from 'react-native-shared-group-preferences';

// The App Group ID must match the one used in the native Safari Extension.
const APP_GROUP = 'group.com.alexmartens.tint';

// The key for the single data object shared with the extension.
const THEME_DATA_KEY = 'tintThemeData';

/**
 * Returns default theme data structure
 */
export const getDefaultThemeData = () => {
  return {
    globalTheme: null, // No theme selected by default
    siteThemes: {},
    customThemes: [], // Array of custom themes (max 5)
    focusModeSettings: {
      enabled: false,
      mappings: {
        work: null, // Preset ID or null
        sleep: null,
        personal: null,
        doNotDisturb: null,
      }
    },
    timeBasedRule: {
      enabled: false,
      mode: 'manual', // 'manual' | 'sunset'
      dayTheme: null, // Preset/custom theme ID (for UI)
      nightTheme: null, // Preset/custom theme ID (for UI)
      // Resolved theme color objects so the Safari extension can apply day/night
      // without needing the full preset catalog. Written when a theme is selected.
      dayThemeColors: null,
      nightThemeColors: null,
      dayStartTime: '07:00', // HH:MM format (manual mode, or computed sunrise for sunset mode)
      nightStartTime: '19:00', // HH:MM format (manual mode, or computed sunset for sunset mode)
      locationLat: null, // Latitude for sunset/sunrise calculation
      locationLon: null, // Longitude for sunset/sunrise calculation
    },
    contentBlockerSettings: {
      enabled: true,
      categories: {
        ads: true,
        trackers: true,
        socialWidgets: false,
        annoyances: true,
      }
    },
    appThemeColor: "#228B22", // Default forest green
    appThemeMode: "dark", // Default dark mode
    favoriteThemes: [], // Array of theme IDs (preset or custom)
    recentlyUsedThemes: [], // Array of { themeId, timestamp, type: 'preset' | 'custom' | 'safari' }
    hasCompletedOnboarding: false, // Track if user has completed onboarding
    hasCompletedSafariSetup: false, // True after Safari extension has run once
  };
};

/**
 * Validates theme data structure to prevent corrupted data
 */
export const validateThemeData = (themeData) => {
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
  
  // Check for required structure: must have at least one theme type
  if (propertyCount > 0 && !themeData.globalTheme && !themeData.siteThemes && !themeData.customThemes && !themeData.appThemeColor) {
    console.error('Theme data missing required structure:', Object.keys(themeData));
    return false;
  }
  
  // Validate customThemes is an array if it exists
  if (themeData.customThemes && (!Array.isArray(themeData.customThemes) || themeData.customThemes.length > 5)) {
    console.error('customThemes must be an array with max 5 items');
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
 * Simple checksum function for theme data
 * Excludes metadata fields (_lastSaved, _saveCount, _version, _checksum) to prevent mismatches
 */
const calculateChecksum = (data) => {
  // Create a copy without metadata fields
  const { _lastSaved, _saveCount, _version, _checksum, ...dataWithoutMetadata } = data;
  const str = JSON.stringify(dataWithoutMetadata);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
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
    // Add metadata to force UserDefaults to recognize the change
    const dataToSave = {
      ...themeData,
      _lastSaved: Date.now(),
      _saveCount: (themeData._saveCount || 0) + 1,
      _version: (themeData._version || 0) + 1
    };
    
    // Calculate checksum for cache detection
    const checksum = calculateChecksum(dataToSave);
    dataToSave._checksum = checksum;
    
    
    // Save with retry logic
    let saved = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!saved && attempts < maxAttempts) {
      try {
        await SharedGroupPreferences.setItem(THEME_DATA_KEY, dataToSave, APP_GROUP);
        saved = true;
      } catch (saveError) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw saveError;
        }
        console.warn('STORAGE: Save attempt', attempts, 'failed, retrying...', saveError);
        await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // Exponential backoff
      }
    }
    
    // Verify it was saved by reading it back
    try {
      await SharedGroupPreferences.getItem(THEME_DATA_KEY, APP_GROUP);
    } catch (verifyError) {
      console.error('STORAGE: Verification read failed:', verifyError);
    }
    
    // Add a delay to ensure the write completes before extension reads
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Force a second write to ensure UserDefaults flushes to disk
    try {
      await SharedGroupPreferences.setItem(THEME_DATA_KEY, dataToSave, APP_GROUP);
    } catch (e) {
      console.warn('STORAGE: Second save attempt failed (non-critical):', e);
    }
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
/**
 * Saves onboarding completion status
 */
export const setOnboardingCompleted = async (completed = true) => {
  try {
    const currentData = await getThemes();
    const updatedData = {
      ...currentData,
      hasCompletedOnboarding: completed,
    };
    await saveThemes(updatedData);
  } catch (e) {
    console.error('Error saving onboarding status:', e);
  }
};

/**
 * Checks if user has completed onboarding
 */
export const hasCompletedOnboarding = async () => {
  try {
    const data = await getThemes();
    // Explicitly check for true - if undefined/null/missing, return false (show onboarding)
    const completed = data?.hasCompletedOnboarding;
    console.log('Onboarding status check:', completed, 'Type:', typeof completed);
    return completed === true;
  } catch (e) {
    console.error('Error checking onboarding status:', e);
    return false; // Default to showing onboarding on error
  }
};

export const getThemes = async () => {
  try {
    console.log('Loading all theme data from App Group...');
    
    // Retry logic for reading
    let themeDataRaw = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!themeDataRaw && attempts < maxAttempts) {
      try {
        themeDataRaw = await SharedGroupPreferences.getItem(THEME_DATA_KEY, APP_GROUP);
        if (themeDataRaw) break;
      } catch (readError) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw readError;
        }
        console.warn('STORAGE: Read attempt', attempts, 'failed, retrying...', readError);
        await new Promise(resolve => setTimeout(resolve, 100 * attempts));
      }
    }
    
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
    
    // Verify checksum if present
    if (themeData._checksum) {
      const expectedChecksum = calculateChecksum(themeData);
      if (themeData._checksum !== expectedChecksum) {
        console.warn('STORAGE: Checksum mismatch - data may be stale. Expected:', expectedChecksum, 'Got:', themeData._checksum);
      }
    }
    
    // Ensure hasCompletedOnboarding exists (for backward compatibility with old data)
    if (themeData.hasCompletedOnboarding === undefined) {
      themeData.hasCompletedOnboarding = false;
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

