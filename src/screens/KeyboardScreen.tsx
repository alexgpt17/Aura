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
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  keyColor?: string;
  returnKeyColor?: string;
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
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [appThemes, setAppThemes] = useState<Record<string, any>>({});

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
              keyColor: matchingPreset.keyboardTheme.keyColor,
              returnKeyColor: matchingPreset.keyboardTheme.returnKeyColor,
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
              keyColor: current.keyColor || '#2a2a2a',
              returnKeyColor: current.returnKeyColor || current.link || '#228B22',
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
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Keyboard</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <GearIcon size={24} color={appThemeColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Preview Section - Non-clickable */}
        {currentTheme && (
          <TouchableOpacity
            style={[
              styles.themeCard,
              { backgroundColor: currentTheme.background, marginBottom: 20 },
            ]}
            onPress={() => {}}
          >
            <View style={styles.themeContent}>
              <View style={styles.themeTextContainer}>
                <Text style={[styles.themeName, { color: currentTheme.text }]}>
                  {currentTheme.name}
                </Text>
                <View style={styles.previewColors}>
                  <View style={[styles.colorIndicator, { backgroundColor: currentTheme.background }]} />
                  <View style={[styles.colorIndicator, { backgroundColor: currentTheme.keyColor || '#2a2a2a' }]} />
                  <View style={[styles.colorIndicator, { backgroundColor: currentTheme.text }]} />
                  <View style={[styles.colorIndicator, { backgroundColor: currentTheme.link }]} />
                </View>
              </View>
              <View style={styles.keyboardPreviewContainer}>
                <View style={styles.keyboardRow}>
                  <View style={[styles.key, { backgroundColor: currentTheme.keyColor || '#2a2a2a' }]}>
                    <Text style={[styles.keyText, { color: currentTheme.text }]}>A</Text>
                  </View>
                  <View style={[styles.key, { backgroundColor: currentTheme.keyColor || '#2a2a2a' }]}>
                    <Text style={[styles.keyText, { color: currentTheme.text }]}>U</Text>
                  </View>
                  <View style={[styles.key, { backgroundColor: currentTheme.keyColor || '#2a2a2a' }]}>
                    <Text style={[styles.keyText, { color: currentTheme.text }]}>R</Text>
                  </View>
                  <View style={[styles.key, { backgroundColor: currentTheme.keyColor || '#2a2a2a' }]}>
                    <Text style={[styles.keyText, { color: currentTheme.text }]}>A</Text>
                  </View>
                </View>
                <View style={styles.keyboardRow}>
                  <View style={[styles.spaceKey, { backgroundColor: currentTheme.keyColor || '#2a2a2a' }]}>
                    <Text style={[styles.keyText, { color: currentTheme.text }]}>space</Text>
                  </View>
                  <View style={[styles.returnKey, { backgroundColor: currentTheme.returnKeyColor || currentTheme.link || '#228B22' }]}>
                    <Text style={[styles.keyText, { color: currentTheme.text }]}>↵</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Browse Themes Button */}
        <TouchableOpacity
          style={[styles.selectMoreButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('BrowseThemes', { forKeyboard: true })}
        >
          <Text style={[styles.selectMoreButtonText, { color: textColor }]}>Browse Themes</Text>
          <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Your Themes Button */}
        <TouchableOpacity
          style={[styles.selectMoreButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomThemesList', { forKeyboard: true })}
        >
          <Text style={[styles.selectMoreButtonText, { color: textColor }]}>Your Themes</Text>
          <Ionicons name="folder" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Create Theme Button */}
        <TouchableOpacity
          style={[styles.selectMoreButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomKeyboardTheme')}
        >
          <Text style={[styles.selectMoreButtonText, { color: textColor }]}>Create Theme</Text>
          <Ionicons name="add" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Per-App Settings Section */}
        <View style={styles.appSettingsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Per-App Settings</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Customize keyboard themes for specific apps.
          </Text>

          {Object.keys(appThemes).length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: sectionBgColor, borderColor }]}>
              <Text style={[styles.emptyStateText, { color: textColor }]}>No app-specific settings yet</Text>
              <Text style={[styles.emptyStateSubtext, { color: textColor }]}>
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
                  style={[styles.appRow, { backgroundColor: sectionBgColor, borderColor }]}
                  onPress={() => navigation.navigate('AppSettings', { bundleId })}
                >
                  <View style={styles.appRowContent}>
                    <Text style={[styles.appName, { color: textColor }]}>{displayName}</Text>
                    {appThemes[bundleId].enabled ? (
                      <Text style={[styles.appStatus, { color: appThemeColor }]}>Enabled</Text>
                    ) : (
                      <Text style={[styles.appStatusDisabled, { color: '#FF4444' }]}>Disabled</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={[styles.addAppButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => navigation.navigate('AppSettings', { bundleId: '' })}
          >
            <Text style={[styles.addAppButtonText, { color: appThemeColor }]}>Add App</Text>
            <Ionicons name="add" size={20} color={appThemeColor} />
          </TouchableOpacity>
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
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
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
  themeCard: {
    borderRadius: 16,
    padding: 28,
    borderWidth: 2,
  },
  themeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeTextContainer: {
    flex: 1,
  },
  themeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
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
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  currentThemeName: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewColors: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewTextContainer: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 20,
  },
  previewText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  arrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    width: 20,
  },
  selectMoreButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    marginBottom: 24,
  },
  selectMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  browseThemesArrow: {
    // Style no longer used - replaced with Ionicons
  },
  appSettingsSection: {
    marginTop: 32,
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
  appRow: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
  },
  appRowContent: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  addAppButton: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    marginTop: 8,
  },
  addAppButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addAppButtonIcon: {
    // Style no longer used - replaced with Ionicons
  },
  keyboardPreviewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 20,
    minWidth: 120,
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  key: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceKey: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  returnKey: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default KeyboardScreen;
