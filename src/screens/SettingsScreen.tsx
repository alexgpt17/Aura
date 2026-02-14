import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { saveThemes, getThemes, hasPurchasedCustomThemes } from '../storage';
import FocusModeService from '../services/FocusModeService';
import { useAppTheme } from '../contexts/AppThemeContext';
import ColorPickerDropdown from '../components/ColorPickerDropdown';
import ThemeModePicker from '../components/ThemeModePicker';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface SettingsScreenProps {
  navigation: any;
}

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

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { 
    appThemeColor, 
    setAppThemeColor, 
    appThemeMode, 
    setAppThemeMode,
    backgroundColor,
    textColor,
    sectionBgColor,
    borderColor,
  } = useAppTheme();
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [focusModeMappings, setFocusModeMappings] = useState<FocusModeMapping>({
    work: null,
    sleep: null,
    personal: null,
    doNotDisturb: null,
  });
  const [focusModeAvailable, setFocusModeAvailable] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [displayUppercaseKeys, setDisplayUppercaseKeys] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    try {
      const themeData = await getThemes();
      if (themeData) {
        setGlobalEnabled(themeData.globalTheme?.enabled ?? true);
        
        // Load keyboard settings
        setDisplayUppercaseKeys(themeData.keyboardTheme?.displayUppercaseKeys ?? true);
        
        // Load Focus Mode settings
        const focusSettings = themeData.focusModeSettings;
        if (focusSettings) {
          setFocusModeEnabled(focusSettings.enabled || false);
          setFocusModeMappings(focusSettings.mappings || {
            work: null,
            sleep: null,
            personal: null,
            doNotDisturb: null,
          });
        }
      }
      
      // Check if Focus Filters are available
      const available = await FocusModeService.isAvailable();
      setFocusModeAvailable(available);
      
      // Check purchase status
      const purchased = await hasPurchasedCustomThemes();
      setHasPurchased(purchased);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleToggleGlobal = async (value: boolean) => {
    try {
      const currentData = await getThemes();
      const newThemeData = {
        ...currentData,
        globalTheme: {
          ...currentData?.globalTheme,
          enabled: value,
        },
      };
      await saveThemes(newThemeData);
      setGlobalEnabled(value);
    } catch (error) {
      console.error('Error toggling global theme:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const handleToggleDisplayUppercaseKeys = async (value: boolean) => {
    try {
      const currentData = await getThemes();
      const newThemeData = {
        ...currentData,
        keyboardTheme: {
          ...currentData?.keyboardTheme,
          displayUppercaseKeys: value,
        },
      };
      await saveThemes(newThemeData);
      setDisplayUppercaseKeys(value);
    } catch (error) {
      console.error('Error toggling keyboard setting:', error);
      Alert.alert('Error', 'Failed to update keyboard setting. Please try again.');
    }
  };

  const handleToggleFocusMode = async (value: boolean) => {
    try {
      await FocusModeService.updateSettings({ enabled: value });
      setFocusModeEnabled(value);
      
      if (value) {
        await FocusModeService.startMonitoring();
      } else {
        FocusModeService.stopMonitoring();
      }
    } catch (error) {
      console.error('Error toggling Focus Mode:', error);
      Alert.alert('Error', 'Failed to update Focus Mode setting. Please try again.');
    }
  };

  const handleSelectFocusPreset = (focusMode: keyof FocusModeMapping) => {
    navigation.navigate('FocusModePresetSelection', { focusMode });
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* App Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>App Appearance</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Customize the accent color and theme used throughout the app.
          </Text>

          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: appThemeColor }]}>App Color</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Choose the accent color for buttons, highlights, and UI elements.
              </Text>
            </View>
          </View>
          <View style={[styles.colorPickerContainer, { marginBottom: 16 }]}>
            <ColorPickerDropdown
              selectedColor={appThemeColor}
              onColorSelect={setAppThemeColor}
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: appThemeColor }]}>App Theme</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Choose between dark and light mode for the app interface.
              </Text>
            </View>
          </View>
          <View style={styles.colorPickerContainer}>
            <ThemeModePicker
              selectedMode={appThemeMode}
              onModeSelect={setAppThemeMode}
              backgroundColor={sectionBgColor}
              textColor={textColor}
              borderColor={borderColor}
              sectionBgColor={backgroundColor}
            />
          </View>
        </View>

        {/* Safari Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Safari Settings</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            These settings apply to every website, unless you have custom settings set up for a website.
          </Text>

          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Enabled</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Aura will enhance websites when enabled.
              </Text>
            </View>
            <Switch
              value={globalEnabled}
              onValueChange={handleToggleGlobal}
              trackColor={{ false: appThemeMode === 'dark' ? '#333' : '#CCC', true: appThemeColor }}
              thumbColor={globalEnabled ? (appThemeMode === 'dark' ? '#FFFFFF' : '#FFFFFF') : (appThemeMode === 'dark' ? '#888' : '#999')}
            />
          </View>

        </View>

        {/* Keyboard Settings Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Keyboard Settings</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Customize the behavior of your Aura keyboard.
          </Text>

          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Display Uppercase Letters</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                {displayUppercaseKeys 
                  ? 'Keys display in uppercase like iOS (shift affects typing behavior only)'
                  : 'Keys display in lowercase (shift changes key appearance)'}
              </Text>
            </View>
            <Switch
              value={displayUppercaseKeys}
              onValueChange={handleToggleDisplayUppercaseKeys}
              trackColor={{ false: appThemeMode === 'dark' ? '#333' : '#CCC', true: appThemeColor }}
              thumbColor={displayUppercaseKeys ? (appThemeMode === 'dark' ? '#FFFFFF' : '#FFFFFF') : (appThemeMode === 'dark' ? '#888' : '#999')}
            />
          </View>
        </View>

        {/* Focus Mode Integration Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Focus Mode Integration</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Automatically apply Aura presets based on your iOS Focus mode.
          </Text>
          
          {!focusModeAvailable && (
            <View style={[styles.warningBox, { backgroundColor: sectionBgColor, borderColor }]}>
              <Text style={styles.warningText}>
                Focus Filters require iOS 15.0 or later.
              </Text>
            </View>
          )}

          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Enabled</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Aura will automatically change themes when your Focus mode changes.
              </Text>
            </View>
            <Switch
              value={focusModeEnabled && focusModeAvailable}
              onValueChange={handleToggleFocusMode}
              disabled={!focusModeAvailable}
              trackColor={{ false: appThemeMode === 'dark' ? '#333' : '#CCC', true: appThemeColor }}
              thumbColor={focusModeEnabled && focusModeAvailable ? (appThemeMode === 'dark' ? '#FFFFFF' : '#FFFFFF') : (appThemeMode === 'dark' ? '#888' : '#999')}
            />
          </View>

          {focusModeEnabled && focusModeAvailable && (
            <>
              <TouchableOpacity
                style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => handleSelectFocusPreset('work')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Work Focus</Text>
                  <Text style={[styles.settingDescription, { color: textColor }]}>
                    {focusModeMappings.work ? `Preset: ${focusModeMappings.work}` : 'No preset selected'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => handleSelectFocusPreset('sleep')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Sleep Focus</Text>
                  <Text style={[styles.settingDescription, { color: textColor }]}>
                    {focusModeMappings.sleep ? `Preset: ${focusModeMappings.sleep}` : 'No preset selected'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => handleSelectFocusPreset('personal')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Personal Focus</Text>
                  <Text style={[styles.settingDescription, { color: textColor }]}>
                    {focusModeMappings.personal ? `Preset: ${focusModeMappings.personal}` : 'No preset selected'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => handleSelectFocusPreset('doNotDisturb')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Do Not Disturb</Text>
                  <Text style={[styles.settingDescription, { color: textColor }]}>
                    {focusModeMappings.doNotDisturb ? `Preset: ${focusModeMappings.doNotDisturb}` : 'No preset selected'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Purchase Status Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Custom Themes</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Create and manage your own custom themes for Safari and Keyboard.
          </Text>
          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Purchase Status</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                {hasPurchased 
                  ? 'You have unlocked custom theme creation. You can create up to 5 custom themes.' 
                  : 'Unlock custom theme creation with a one-time purchase of $4.99.'}
              </Text>
            </View>
            <View style={[styles.purchaseStatusBadge, { backgroundColor: sectionBgColor, borderColor }]}>
              <Text style={[styles.purchaseStatusText, { color: hasPurchased ? '#4CAF50' : '#FF9800' }]}>
                {hasPurchased ? '✓ Unlocked' : 'Locked'}
              </Text>
            </View>
          </View>
          {!hasPurchased && (
            <TouchableOpacity
              style={[styles.purchaseButton, { borderColor: appThemeColor, backgroundColor: sectionBgColor }]}
              onPress={() => navigation.navigate('Purchase')}
            >
              <Text style={[styles.purchaseButtonText, { color: appThemeColor }]}>
                Unlock Custom Themes
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>About</Text>
          <View style={[styles.aboutContent, { backgroundColor: sectionBgColor, borderBottomColor: borderColor }]}>
            <Text style={[styles.aboutLabel, { color: textColor }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: textColor }]}>1.0</Text>
          </View>
          <View style={[styles.aboutContentContact, { backgroundColor: sectionBgColor, borderBottomColor: borderColor }]}>
            <Text style={[styles.aboutLabel, { color: textColor }]}>Contact Developer:</Text>
            <TouchableOpacity onPress={() => {
              // Open email client
              Alert.alert('Contact', 'Email: alexmartens1111@gmail.com');
            }}>
              <Text style={[styles.aboutValue, styles.aboutLink]}>alexmartens1111@gmail.com</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#228B22',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  arrow: {
    // Style no longer used - replaced with Ionicons
    marginLeft: 12,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  warningBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 14,
    color: '#ff6b6b',
    lineHeight: 20,
  },
  colorPickerContainer: {
    marginTop: 8,
  },
  aboutContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  aboutContentContact: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 80,
  },
  aboutLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 16,
  },
  aboutLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
    marginTop: 8,
    textAlign: 'center',
  },
  purchaseStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  purchaseStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  purchaseButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
