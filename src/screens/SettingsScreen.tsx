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
  const { appThemeColor, setAppThemeColor } = useAppTheme();
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* App Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Appearance</Text>
          <Text style={styles.sectionDescription}>
            Customize the accent color used throughout the app.
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: appThemeColor }]}>App Color</Text>
              <Text style={styles.settingDescription}>
                Choose the accent color for buttons, highlights, and UI elements.
              </Text>
            </View>
          </View>
          <View style={styles.colorPickerContainer}>
            <ColorPickerDropdown
              selectedColor={appThemeColor}
              onColorSelect={setAppThemeColor}
            />
          </View>
        </View>

        {/* Default Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionDescription}>
            These settings apply to every website, unless you have custom settings set up for a website.
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Enabled</Text>
              <Text style={styles.settingDescription}>
                Aura will enhance websites when enabled.
              </Text>
            </View>
            <Switch
              value={globalEnabled}
              onValueChange={handleToggleGlobal}
              trackColor={{ false: '#333', true: appThemeColor }}
              thumbColor={globalEnabled ? '#FFFFFF' : '#888'}
            />
          </View>

        </View>

        {/* Focus Mode Integration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus Mode Integration</Text>
          <Text style={styles.sectionDescription}>
            Automatically apply Aura presets based on your iOS Focus mode.
          </Text>
          
          {!focusModeAvailable && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Focus Filters require iOS 15.0 or later.
              </Text>
            </View>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Enabled</Text>
              <Text style={styles.settingDescription}>
                Aura will automatically change themes when your Focus mode changes.
              </Text>
            </View>
            <Switch
              value={focusModeEnabled && focusModeAvailable}
              onValueChange={handleToggleFocusMode}
              disabled={!focusModeAvailable}
              trackColor={{ false: '#333', true: appThemeColor }}
              thumbColor={focusModeEnabled && focusModeAvailable ? '#FFFFFF' : '#888'}
            />
          </View>

          {focusModeEnabled && focusModeAvailable && (
            <>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => handleSelectFocusPreset('work')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Work Focus</Text>
                  <Text style={styles.settingDescription}>
                    {focusModeMappings.work ? `Preset: ${focusModeMappings.work}` : 'No preset selected'}
                  </Text>
                </View>
                <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => handleSelectFocusPreset('sleep')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Sleep Focus</Text>
                  <Text style={styles.settingDescription}>
                    {focusModeMappings.sleep ? `Preset: ${focusModeMappings.sleep}` : 'No preset selected'}
                  </Text>
                </View>
                <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => handleSelectFocusPreset('personal')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Personal Focus</Text>
                  <Text style={styles.settingDescription}>
                    {focusModeMappings.personal ? `Preset: ${focusModeMappings.personal}` : 'No preset selected'}
                  </Text>
                </View>
                <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => handleSelectFocusPreset('doNotDisturb')}
              >
                <View style={styles.settingContent}>
                  <Text style={[styles.settingLabel, { color: appThemeColor }]}>Do Not Disturb</Text>
                  <Text style={styles.settingDescription}>
                    {focusModeMappings.doNotDisturb ? `Preset: ${focusModeMappings.doNotDisturb}` : 'No preset selected'}
                  </Text>
                </View>
                <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Purchase Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Themes</Text>
          <Text style={styles.sectionDescription}>
            Create and manage your own custom themes for Safari and Keyboard.
          </Text>
          <View style={styles.settingRow}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Purchase Status</Text>
              <Text style={styles.settingDescription}>
                {hasPurchased 
                  ? 'You have unlocked custom theme creation. You can create up to 5 custom themes.' 
                  : 'Unlock custom theme creation with a one-time purchase of $4.99.'}
              </Text>
            </View>
            <View style={styles.purchaseStatusBadge}>
              <Text style={[styles.purchaseStatusText, { color: hasPurchased ? '#4CAF50' : '#FF9800' }]}>
                {hasPurchased ? '✓ Unlocked' : 'Locked'}
              </Text>
            </View>
          </View>
          {!hasPurchased && (
            <TouchableOpacity
              style={[styles.purchaseButton, { borderColor: appThemeColor }]}
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
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutContent}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0</Text>
          </View>
          <View style={styles.aboutContentContact}>
            <Text style={styles.aboutLabel}>Contact Developer:</Text>
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
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#FFFFFF', // White for explanations
    marginBottom: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // White by default, App Color will override
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#888888',
    lineHeight: 18,
  },
  arrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
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
    backgroundColor: '#2a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4a2a2a',
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
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
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
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 80,
  },
  aboutLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 16,
    color: '#FFFFFF', // White for values
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
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  purchaseStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  purchaseButton: {
    backgroundColor: '#1a1a1a',
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
