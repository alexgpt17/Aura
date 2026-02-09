import { NativeModules } from 'react-native';
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

/**
 * Service to handle Focus Mode integration with Aura themes
 */
class FocusModeService {
  private listenerInterval: NodeJS.Timeout | null = null;
  private lastFocusMode: string = 'none';

  /**
   * Checks if Focus Filters are available on this device
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!FocusModeManager) {
        return false;
      }
      return await FocusModeManager.isFocusFiltersAvailable();
    } catch (error) {
      console.error('Error checking Focus Filters availability:', error);
      return false;
    }
  }

  /**
   * Gets the current Focus mode
   */
  async getCurrentFocusMode(): Promise<string> {
    try {
      if (!FocusModeManager) {
        return 'none';
      }
      return await FocusModeManager.getCurrentFocusMode() || 'none';
    } catch (error) {
      console.error('Error getting Focus mode:', error);
      return 'none';
    }
  }

  /**
   * Applies the preset mapped to the current Focus mode
   */
  async applyFocusModePreset(focusMode: string): Promise<void> {
    try {
      const themeData = await getThemes();
      const focusSettings = themeData?.focusModeSettings;

      if (!focusSettings?.enabled) {
        return; // Focus mode integration is disabled
      }

      const presetId = focusSettings.mappings[focusMode as keyof FocusModeMapping];
      if (!presetId) {
        return; // No preset mapped for this Focus mode
      }

      // Get the preset from Aura presets (we'll need to import this)
      // For now, we'll use the preset IDs directly
      console.log(`Applying preset ${presetId} for Focus mode: ${focusMode}`);
      
      // This will be implemented to apply the preset
      // Similar to handleApplyPreset in HomeScreen
    } catch (error) {
      console.error('Error applying Focus mode preset:', error);
    }
  }

  /**
   * Starts monitoring Focus mode changes
   */
  async startMonitoring(): Promise<void> {
    if (this.listenerInterval) {
      return; // Already monitoring
    }

    // Poll for Focus mode changes every 5 seconds
    // Note: This is a workaround since iOS doesn't provide direct Focus mode change notifications
    this.listenerInterval = setInterval(async () => {
      const currentMode = await this.getCurrentFocusMode();
      if (currentMode !== this.lastFocusMode) {
        this.lastFocusMode = currentMode;
        await this.applyFocusModePreset(currentMode);
      }
    }, 5000);
  }

  /**
   * Stops monitoring Focus mode changes
   */
  stopMonitoring(): void {
    if (this.listenerInterval) {
      clearInterval(this.listenerInterval);
      this.listenerInterval = null;
    }
  }

  /**
   * Updates Focus mode settings
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
}

export default new FocusModeService();
