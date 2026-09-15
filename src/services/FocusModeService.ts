import { NativeModules, Platform } from 'react-native';
import { saveThemes, getThemes } from '../storage';

const { FocusModeManager } = NativeModules;

interface FocusModeMapping {
  work: string | null;
  sleep: string | null;
  personal: string | null;
  doNotDisturb: string | null;
}

interface FocusModeSettings {
  enabled: boolean;
  mappings: FocusModeMapping;
}

interface ThemeInfo {
  id: string;
  name: string;
  background?: string;
  text?: string;
  link?: string;
}

/**
 * Service to handle Focus Mode integration with Aura themes.
 * 
 * The actual theme switching is handled by the native FocusFilterExtension,
 * which runs automatically when iOS Focus modes change — even when the app is closed.
 * 
 * This service is a simple settings manager that:
 * - Checks if Focus Filters are available (iOS 16+)
 * - Checks if the Focus Filter extension is configured
 * - Updates Focus mode settings (enable/disable, theme mappings)
 * - Gets available themes for mapping
 */
class FocusModeService {

  /**
   * Checks if Focus Filters are available on this device (iOS 16+)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Focus Filters are only available on iOS
      if (Platform.OS !== 'ios') {
        return false;
      }

      // Check iOS version directly as a fallback
      const iosVersion = parseInt(Platform.Version as string, 10);
      if (iosVersion < 16) {
        return false;
      }

      if (!FocusModeManager) {
        // Native module not loaded — but if we're on iOS 16+, Focus Filters should work
        // The FocusFilterExtension runs independently of this module
        return true;
      }

      return await FocusModeManager.isFocusFiltersAvailable();
    } catch (error) {
      console.error('Error checking Focus Filters availability:', error);
      // Fallback: if on iOS 16+, assume available
      if (Platform.OS === 'ios') {
        const iosVersion = parseInt(Platform.Version as string, 10);
        return iosVersion >= 16;
      }
      return false;
    }
  }

  /**
   * Checks if the Focus Filter extension is properly configured
   * (i.e., focus mode settings exist and are enabled in App Group storage)
   */
  async isConfigured(): Promise<boolean> {
    try {
      if (!FocusModeManager) {
        // Fallback: check storage directly
        const themeData = await getThemes();
        return themeData?.focusModeSettings?.enabled || false;
      }
      return await FocusModeManager.isFocusFilterConfigured();
    } catch (error) {
      console.error('Error checking Focus Filter configuration:', error);
      return false;
    }
  }

  /**
   * Gets the list of available themes (built-in + custom) for Focus mode mapping
   */
  async getAvailableThemes(): Promise<ThemeInfo[]> {
    try {
      if (FocusModeManager) {
        return await FocusModeManager.getAvailablePresets();
      }
      // Fallback: return empty array if native module not available
      return [];
    } catch (error) {
      console.error('Error getting available themes:', error);
      return [];
    }
  }

  /**
   * Updates Focus mode settings (enable/disable, theme mappings)
   * The FocusFilterExtension reads these settings from App Group storage
   * when iOS triggers a Focus mode change.
   */
  async updateSettings(settings: Partial<FocusModeSettings>): Promise<void> {
    try {
      const themeData = await getThemes();
      const newSettings = {
        ...themeData?.focusModeSettings,
        ...settings,
      };
      
      const newThemeData = {
        ...themeData,
        focusModeSettings: newSettings,
      };
      
      await saveThemes(newThemeData);
    } catch (error) {
      console.error('Error updating Focus mode settings:', error);
      throw error;
    }
  }

  /**
   * Gets the current Focus mode settings
   */
  async getSettings(): Promise<FocusModeSettings | null> {
    try {
      const themeData = await getThemes();
      return themeData?.focusModeSettings || null;
    } catch (error) {
      console.error('Error getting Focus mode settings:', error);
      return null;
    }
  }
}

export default new FocusModeService();
