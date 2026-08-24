import { NativeModules, Platform } from 'react-native';

const { ContentBlockerManager } = NativeModules;

export type SafariExtensionState = {
  /**
   * True when the Safari extension has run recently (heartbeat in the App Group).
   *
   * iOS exposes no way to query Safari web extension enablement before iOS 26.2,
   * so this is a liveness signal, not an authoritative setting. Use it only to
   * decide whether to show setup guidance.
   */
  isEnabled: boolean;
  /** Epoch ms of the last extension run, or 0 if never seen. */
  lastSeen: number;
};

export async function getSafariExtensionState(): Promise<SafariExtensionState> {
  if (Platform.OS !== 'ios' || !ContentBlockerManager?.getSafariExtensionState) {
    return { isEnabled: false, lastSeen: 0 };
  }
  try {
    const state = await ContentBlockerManager.getSafariExtensionState();
    return {
      isEnabled: !!state?.isEnabled,
      lastSeen: Number(state?.lastSeen) || 0,
    };
  } catch {
    return { isEnabled: false, lastSeen: 0 };
  }
}

export function getSafariExtensionEnableInstructions(): string {
  return (
    'To apply themes in Safari:\n\n' +
    '1. Open the Settings app\n' +
    '2. Scroll down and tap Safari\n' +
    '3. Tap Extensions\n' +
    '4. Find “Aura” and toggle it ON\n' +
    '5. Allow access on All Websites\n\n' +
    'Then return here, pick a theme, and open any site in Safari.'
  );
}
