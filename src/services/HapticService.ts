import { Platform } from 'react-native';

/**
 * Haptic Feedback Service
 * 
 * Provides haptic feedback functionality throughout the app.
 * Uses react-native-haptic-feedback library for iOS and Android support.
 * 
 * Usage:
 *   import HapticService from './services/HapticService';
 *   HapticService.impact('light');
 *   HapticService.success();
 *   HapticService.selection();
 */

// Try to import haptic feedback library (will be null if not installed)
let ReactNativeHapticFeedback: any = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback');
} catch (e) {
  // Library not installed - will use fallback
}

export type HapticImpactType = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';

class HapticService {
  private isAvailable(): boolean {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return false;
    }
    return ReactNativeHapticFeedback !== null;
  }

  /**
   * Light impact feedback - for subtle interactions (button taps, selections)
   */
  impact(type: HapticImpactType = 'light'): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const options = {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      };

      const hapticType = `impact${type.charAt(0).toUpperCase() + type.slice(1)}` as 
        'impactLight' | 'impactMedium' | 'impactHeavy';

      ReactNativeHapticFeedback.trigger(hapticType, options);
    } catch (error) {
      console.warn('Haptic feedback error:', error);
    }
  }

  /**
   * Light impact - for subtle interactions
   */
  light(): void {
    this.impact('light');
  }

  /**
   * Medium impact - for standard button presses
   */
  medium(): void {
    this.impact('medium');
  }

  /**
   * Heavy impact - for important actions
   */
  heavy(): void {
    this.impact('heavy');
  }

  /**
   * Selection feedback - for picker/selection changes
   */
  selection(): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      });
    } catch (error) {
      console.warn('Haptic feedback error:', error);
    }
  }

  /**
   * Success notification - for successful actions
   */
  success(): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      ReactNativeHapticFeedback.trigger('notificationSuccess', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      });
    } catch (error) {
      console.warn('Haptic feedback error:', error);
    }
  }

  /**
   * Warning notification - for warnings
   */
  warning(): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      ReactNativeHapticFeedback.trigger('notificationWarning', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      });
    } catch (error) {
      console.warn('Haptic feedback error:', error);
    }
  }

  /**
   * Error notification - for errors
   */
  error(): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      ReactNativeHapticFeedback.trigger('notificationError', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: false,
      });
    } catch (error) {
      console.warn('Haptic feedback error:', error);
    }
  }
}

export default new HapticService();
