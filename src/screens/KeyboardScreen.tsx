import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { getThemes } from '../storage';
import GearIcon from '../components/GearIcon';
import { useAppTheme } from '../contexts/AppThemeContext';
import { AURA_PRESETS } from './AuraPresetsScreen';

// App name lookup for displaying app names instead of bundle IDs
const COMMON_APPS = [
  { bundleId: 'com.apple.mail', name: 'Mail' },
  { bundleId: 'com.apple.mobilesafari', name: 'Safari' },
  { bundleId: 'com.apple.MobileSMS', name: 'Messages' },
  { bundleId: 'com.apple.mobilephone', name: 'Phone' },
  { bundleId: 'com.apple.calculator', name: 'Calculator' },
  { bundleId: 'com.apple.mobilecal', name: 'Calendar' },
  { bundleId: 'com.apple.mobilecontacts', name: 'Contacts' },
  { bundleId: 'com.apple.reminders', name: 'Reminders' },
  { bundleId: 'com.apple.notes', name: 'Notes' },
  { bundleId: 'com.apple.Music', name: 'Music' },
  { bundleId: 'com.apple.mobileslideshow', name: 'Photos' },
  { bundleId: 'com.apple.camera', name: 'Camera' },
  { bundleId: 'com.apple.mobiletimer', name: 'Clock' },
  { bundleId: 'com.apple.mobileweather', name: 'Weather' },
  { bundleId: 'com.apple.mobilemaps', name: 'Maps' },
  { bundleId: 'com.apple.Preferences', name: 'Settings' },
  { bundleId: 'com.apple.AppStore', name: 'App Store' },
  { bundleId: 'com.apple.mobileme.fmf1', name: 'Find My' },
  { bundleId: 'com.apple.podcasts', name: 'Podcasts' },
  { bundleId: 'com.apple.tv', name: 'TV' },
  { bundleId: 'com.burbn.instagram', name: 'Instagram' },
  { bundleId: 'com.spotify.client', name: 'Spotify' },
  { bundleId: 'com.netflix.Netflix', name: 'Netflix' },
  { bundleId: 'com.google.ios.youtube', name: 'YouTube' },
  { bundleId: 'net.whatsapp.WhatsApp', name: 'WhatsApp' },
];

interface KeyboardScreenProps {
  navigation: any;
}

interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
}

// All available themes (same as Safari)
const ALL_THEMES: Theme[] = [
  {
    id: 'forest',
    name: 'Forest',
    background: '#1a3d1a',
    text: '#c8e6c9',
    link: '#81c784',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#001f3f',
    text: '#b3d9ff',
    link: '#4da6ff',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    background: '#000000',
    text: '#ffffff',
    link: '#1E90FF',
  },
  {
    id: 'light',
    name: 'Light Mode',
    background: '#ffffff',
    text: '#000000',
    link: '#0066cc',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0a0e27',
    text: '#6c5ce7',
    link: '#6c5ce7',
  },
  {
    id: 'chroma',
    name: 'Chroma',
    background: '#1a1a2e',
    text: '#f0f0f0',
    link: '#ff6b6b',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    background: '#F1EADF',
    text: '#4A3F35',
    link: '#006A71',
  },
  {
    id: 'amoled',
    name: 'AMOLED',
    background: '#000000',
    text: '#ffffff',
    link: '#1E90FF',
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    background: '#1E1E1E',
    text: '#E0E0E0',
    link: '#BB86FC',
  },
];

const KeyboardScreen: React.FC<KeyboardScreenProps> = ({ navigation }) => {
  const { appThemeColor } = useAppTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [appThemes, setAppThemes] = useState<AppSettings>({});

  useEffect(() => {
    loadCurrentTheme();
    loadAppThemes();
  }, []);

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentTheme();
      loadAppThemes();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.keyboardTheme) {
        const current = themeData.keyboardTheme;
        
        // First check if it's an Aura preset (by presetId or by matching colors)
        let matchingPreset = null;
        if (current.presetId) {
          matchingPreset = AURA_PRESETS.find(p => p.id === current.presetId);
        } else {
          matchingPreset = AURA_PRESETS.find(
            (preset) =>
              preset.keyboardTheme.background === current.background &&
              preset.keyboardTheme.text === current.text &&
              preset.keyboardTheme.link === current.link
          );
        }
        
        if (matchingPreset) {
          setCurrentTheme({
            id: matchingPreset.id,
            name: matchingPreset.name,
            background: matchingPreset.keyboardTheme.background,
            text: matchingPreset.keyboardTheme.text,
            link: matchingPreset.keyboardTheme.link,
          });
        } else {
          // Check against ALL_THEMES
          const matchingTheme = ALL_THEMES.find(
            (theme) =>
              theme.background === current.background &&
              theme.text === current.text &&
              theme.link === current.link
          );
          if (matchingTheme) {
            setCurrentTheme(matchingTheme);
          } else {
            // Create a custom theme object from current settings
            setCurrentTheme({
              id: 'custom',
              name: 'Custom',
              background: current.background || '#000000',
              text: current.text || '#ffffff',
              link: current.link || '#228B22',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading current keyboard theme:', error);
    }
  };

  const loadAppThemes = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.appThemes) {
        setAppThemes(themeData.appThemes || {});
      }
    } catch (error) {
      console.error('Error loading app themes:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Keyboard</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <GearIcon size={24} color={appThemeColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Current Theme Button - Enlarged */}
        {currentTheme && (
          <TouchableOpacity
            style={[
              styles.currentThemeButton,
              { backgroundColor: currentTheme.background },
            ]}
            onPress={() => navigation.navigate('ThemeSelection', { forKeyboard: true })}
          >
            <View style={styles.currentThemeContent}>
              <View style={styles.currentThemeTextContainer}>
                <View style={styles.currentThemeHeader}>
                  <Text style={[styles.currentThemeLabel, { color: currentTheme.text }]}>
                    Current Theme
                  </Text>
                  <View style={[styles.activeBadge, { backgroundColor: appThemeColor }]}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                </View>
                <Text style={[styles.currentThemeName, { color: currentTheme.text }]}>
                  {currentTheme.name}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.arrow,
                { color: currentTheme.link || appThemeColor },
              ]}
            >
              →
            </Text>
          </TouchableOpacity>
        )}

        {/* Browse Themes Button */}
        <TouchableOpacity
          style={styles.selectMoreButton}
          onPress={() => navigation.navigate('ThemeSelection', { forKeyboard: true })}
        >
          <Text style={[styles.selectMoreButtonText, { color: appThemeColor }]}>Browse Themes</Text>
          <Text style={[styles.browseThemesArrow, { color: appThemeColor }]}>→</Text>
        </TouchableOpacity>

        {/* Create Theme Button */}
        <TouchableOpacity
          style={styles.selectMoreButton}
          onPress={() => navigation.navigate('CustomKeyboardTheme')}
        >
          <Text style={[styles.selectMoreButtonText, { color: appThemeColor }]}>Create Theme</Text>
          <Text style={[styles.browseThemesArrow, { color: appThemeColor }]}>→</Text>
        </TouchableOpacity>

        {/* Per-App Settings Section */}
        <View style={styles.appSettingsSection}>
          <Text style={styles.sectionTitle}>Per-App Settings</Text>
          <Text style={styles.sectionDescription}>
            Customize keyboard themes for specific apps.
          </Text>

          {Object.keys(appThemes).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No app-specific settings yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add custom settings for individual apps.
              </Text>
            </View>
          ) : (
            Object.keys(appThemes).map((bundleId) => {
              const app = COMMON_APPS.find(a => a.bundleId === bundleId);
              const displayName = app ? app.name : bundleId;
              return (
                <TouchableOpacity
                  key={bundleId}
                  style={styles.appRow}
                  onPress={() => navigation.navigate('AppSettings', { bundleId })}
                >
                  <View style={styles.appRowContent}>
                    <Text style={styles.appName}>{displayName}</Text>
                    {appThemes[bundleId].enabled ? (
                      <Text style={styles.appStatus}>Enabled</Text>
                    ) : (
                      <Text style={styles.appStatusDisabled}>Disabled</Text>
                    )}
                  </View>
                  <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={styles.addAppButton}
            onPress={() => navigation.navigate('AppSettings', { bundleId: '' })}
          >
            <Text style={[styles.addAppButtonText, { color: appThemeColor }]}>+ Add App</Text>
          </TouchableOpacity>
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
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
    color: '#228B22',
    fontWeight: 'normal',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  currentThemeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  currentThemeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currentThemeTextContainer: {
    flex: 1,
  },
  currentThemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  currentThemeLabel: {
    fontSize: 14,
    color: '#888888',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  currentThemeName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  arrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectMoreButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 24,
  },
  selectMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  browseThemesArrow: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  appSettingsSection: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
    lineHeight: 20,
  },
  appRow: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  appRowContent: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  appStatus: {
    fontSize: 12,
    color: '#4CAF50', // Green for enabled
    fontWeight: '600',
  },
  appStatusDisabled: {
    fontSize: 12,
    color: '#FF4444', // Red for disabled
    fontWeight: '600',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 16,
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
  addAppButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 8,
  },
  addAppButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default KeyboardScreen;
