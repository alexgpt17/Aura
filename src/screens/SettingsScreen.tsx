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
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import ColorPickerDropdown from '../components/ColorPickerDropdown';
import ThemeModePicker from '../components/ThemeModePicker';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface SettingsScreenProps {
  navigation: any;
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
        
        // Load Focus Mode enabled state (for display in settings link)
        const focusSettings = themeData.focusModeSettings;
        if (focusSettings) {
          setFocusModeEnabled(focusSettings.enabled || false);
        }
      }
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

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text>
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
              <Text style={[styles.settingLabel, { color: textColor }]}>App Theme</Text>
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

        {/* Focus Mode Integration Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Focus Mode Integration</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Automatically apply Aura presets based on your iOS Focus mode.
          </Text>
          
          <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'FocusTab' })}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: appThemeColor }]}>
                {focusModeEnabled ? 'Focus Mode Enabled' : 'Set Up Focus Mode'}
              </Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                {focusModeEnabled
                  ? 'Tap to manage Focus mode preset mappings'
                  : 'Map Aura presets to iOS Focus modes for automatic switching'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
          </TouchableOpacity>
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
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
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
});

export default SettingsScreen;
