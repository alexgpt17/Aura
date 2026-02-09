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
      backgroundGradient: null,
    },
    siteThemes: {},
    appThemes: {}, // Per-app keyboard themes (bundleId -> theme)
    customThemes: [], // Array of custom themes (max 5)
    keyboardTheme: {
      backgroundType: "color",
      background: "#000000",
      text: "#FFFFFF",
      link: "#228B22",
      keyColor: "#2a2a2a",
      enabled: true,
      backgroundImage: null,
      backgroundGradient: null,
    },
    auraPresets: [], // Array of custom Aura presets (user-created)
    focusModeSettings: {
      enabled: false,
      mappings: {
        work: null, // Preset ID or null
        sleep: null,
        personal: null,
        doNotDisturb: null,
      }
    },
    appThemeColor: "#228B22", // Default forest green
    favoriteThemes: [], // Array of theme IDs (preset or custom)
    recentlyUsedThemes: [], // Array of { themeId, timestamp, type: 'preset' | 'custom' | 'keyboard' | 'safari' }
    hasCompletedOnboarding: false, // Track if user has completed onboarding
    hasPurchasedCustomThemes: false, // Track if user has purchased custom theme creation
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
  
  // Check for required structure: must have at least one theme type
  if (propertyCount > 0 && !themeData.globalTheme && !themeData.siteThemes && !themeData.customThemes && !themeData.keyboardTheme && !themeData.appThemeColor) {
    console.error('Theme data missing required structure:', Object.keys(themeData));
    return false;
  }
  
  // Validate customThemes is an array if it exists
  if (themeData.customThemes && (!Array.isArray(themeData.customThemes) || themeData.customThemes.length > 5)) {
    console.error('customThemes must be an array with max 5 items');
    return false;
  }
  
  // Validate keyboardTheme is an object if it exists
  if (themeData.keyboardTheme && (typeof themeData.keyboardTheme !== 'object' || Array.isArray(themeData.keyboardTheme))) {
    console.error('keyboardTheme is not a valid object:', themeData.keyboardTheme);
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
    
    console.log('🔥🔥🔥 STORAGE: Saving all theme data to App Group');
    console.log('🔥🔥🔥 STORAGE: Full theme data:', JSON.stringify(themeData, null, 2));
    if (themeData.globalTheme) {
      console.log('🔥🔥🔥 STORAGE: Global theme - background:', themeData.globalTheme.background, 
                 'text:', themeData.globalTheme.text, 'link:', themeData.globalTheme.link,
                 'enabled:', themeData.globalTheme.enabled);
    }
    if (themeData.keyboardTheme) {
      console.log('🔥🔥🔥 STORAGE: Keyboard theme - background:', themeData.keyboardTheme.background, 
                 'text:', themeData.keyboardTheme.text, 'link:', themeData.keyboardTheme.link,
                 'enabled:', themeData.keyboardTheme.enabled);
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
    
    console.log('🔥🔥🔥 STORAGE: About to save with timestamp:', dataToSave._lastSaved, 'checksum:', checksum);
    
    // Save with retry logic
    let saved = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!saved && attempts < maxAttempts) {
      try {
        await SharedGroupPreferences.setItem(THEME_DATA_KEY, dataToSave, APP_GROUP);
        saved = true;
        console.log('🔥🔥🔥 STORAGE: Theme data saved successfully to App Group (attempt', attempts + 1, ')');
      } catch (saveError) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw saveError;
        }
        console.warn('🔥🔥🔥 STORAGE: Save attempt', attempts, 'failed, retrying...', saveError);
        await new Promise(resolve => setTimeout(resolve, 100 * attempts)); // Exponential backoff
      }
    }
    
    // Verify it was saved by reading it back
    try {
      const verify = await SharedGroupPreferences.getItem(THEME_DATA_KEY, APP_GROUP);
      console.log('🔥🔥🔥 STORAGE: Verification read - got data:', verify ? 'YES' : 'NO');
      if (verify && typeof verify === 'object') {
        console.log('🔥🔥🔥 STORAGE: Verification - globalTheme exists:', !!verify.globalTheme);
        console.log('🔥🔥🔥 STORAGE: Verification - keyboardTheme exists:', !!verify.keyboardTheme);
        console.log('🔥🔥🔥 STORAGE: Verification - checksum:', verify._checksum);
        if (verify.globalTheme) {
          console.log('🔥🔥🔥 STORAGE: Verification - globalTheme.background:', verify.globalTheme.background);
        }
        if (verify.keyboardTheme) {
          console.log('🔥🔥🔥 STORAGE: Verification - keyboardTheme.background:', verify.keyboardTheme.background);
        }
      }
    } catch (verifyError) {
      console.error('🔥🔥🔥 STORAGE: Verification read failed:', verifyError);
    }
    
    // Add a delay to ensure the write completes before extension reads
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Force a second write to ensure UserDefaults flushes to disk
    try {
      await SharedGroupPreferences.setItem(THEME_DATA_KEY, dataToSave, APP_GROUP);
      console.log('🔥🔥🔥 STORAGE: Theme data re-saved to force UserDefaults flush.');
    } catch (e) {
      console.warn('🔥🔥🔥 STORAGE: Second save attempt failed (non-critical):', e);
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
    return data?.hasCompletedOnboarding === true;
  } catch (e) {
    console.error('Error checking onboarding status:', e);
    return false;
  }
};

/**
 * Saves custom themes purchase status
 */
export const setCustomThemesPurchased = async (purchased = true) => {
  try {
    const currentData = await getThemes();
    const updatedData = {
      ...currentData,
      hasPurchasedCustomThemes: purchased,
    };
    await saveThemes(updatedData);
  } catch (e) {
    console.error('Error saving purchase status:', e);
  }
};

/**
 * Checks if user has purchased custom themes
 */
export const hasPurchasedCustomThemes = async () => {
  try {
    const data = await getThemes();
    return data?.hasPurchasedCustomThemes === true;
  } catch (e) {
    console.error('Error checking purchase status:', e);
    return false;
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
        console.warn('🔥🔥🔥 STORAGE: Read attempt', attempts, 'failed, retrying...', readError);
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
        console.warn('🔥🔥🔥 STORAGE: Checksum mismatch - data may be stale. Expected:', expectedChecksum, 'Got:', themeData._checksum);
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

/**
 * Saves a custom Aura preset to the auraPresets array
 * @param {object} preset - The Aura preset object to save
 */
export const saveAuraPreset = async (preset) => {
  try {
    const currentData = await getThemes();
    const auraPresets = currentData?.auraPresets || [];
    
    // Add the new preset
    const updatedAuraPresets = [...auraPresets, preset];
    
    const newThemeData = {
      ...currentData,
      auraPresets: updatedAuraPresets,
    };
    
    await saveThemes(newThemeData);
    console.log('Aura preset saved:', preset.id);
  } catch (error) {
    console.error('Error saving Aura preset:', error);
    throw error;
  }
};

/**
 * Deletes a custom Aura preset from the auraPresets array
 * @param {string} presetId - The ID of the preset to delete
 */
export const deleteAuraPreset = async (presetId) => {
  try {
    const currentData = await getThemes();
    const auraPresets = currentData?.auraPresets || [];
    
    // Filter out the preset with the given ID
    const updatedAuraPresets = auraPresets.filter(preset => preset.id !== presetId);
    
    const newThemeData = {
      ...currentData,
      auraPresets: updatedAuraPresets,
    };
    
    await saveThemes(newThemeData);
    console.log('Aura preset deleted:', presetId);
  } catch (error) {
    console.error('Error deleting Aura preset:', error);
    throw error;
  }
};
