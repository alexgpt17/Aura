import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { saveThemes, getThemes } from '../storage';
import GearIcon from '../components/GearIcon';
import { useAppTheme } from '../contexts/AppThemeContext';
import { AURA_PRESETS } from './AuraPresetsScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface SafariScreenProps {
  navigation: any;
}

interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
}

// All available themes
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

interface WebsiteTheme {
  enabled: boolean;
  background: string;
  text: string;
  link: string;
  backgroundType: string;
  backgroundImage: string | null;
}

interface WebsiteSettings {
  [hostname: string]: WebsiteTheme;
}

const SafariScreen: React.FC<SafariScreenProps> = ({ navigation }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);
  const [siteThemes, setSiteThemes] = useState<WebsiteSettings>({});

  useEffect(() => {
    loadCurrentTheme();
    loadSiteThemes();
  }, []);

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentTheme();
      loadSiteThemes();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.globalTheme) {
        const current = themeData.globalTheme;
        
        // First check if it's an Aura preset (by presetId or by matching colors)
        let matchingPreset = null;
        if (current.presetId) {
          matchingPreset = AURA_PRESETS.find(p => p.id === current.presetId);
        } else {
          matchingPreset = AURA_PRESETS.find(
            (preset) =>
              preset.safariTheme.background === current.background &&
              preset.safariTheme.text === current.text &&
              preset.safariTheme.link === current.link
          );
        }
        
        if (matchingPreset) {
          setCurrentTheme({
            id: matchingPreset.id,
            name: matchingPreset.name,
            background: matchingPreset.safariTheme.background,
            text: matchingPreset.safariTheme.text,
            link: matchingPreset.safariTheme.link,
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
      console.error('Error loading current theme:', error);
    }
  };

  const loadSiteThemes = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.siteThemes) {
        setSiteThemes(themeData.siteThemes || {});
      }
    } catch (error) {
      console.error('Error loading site themes:', error);
    }
  };

  const handleApplyTheme = async (theme: Theme) => {
    try {
      const currentData = await getThemes();
      const newThemeData = {
        ...currentData,
        globalTheme: {
          enabled: currentData?.globalTheme?.enabled ?? true,
          background: theme.background,
          text: theme.text,
          link: theme.link,
          backgroundType: 'color',
          backgroundImage: null,
        },
      };

      await saveThemes(newThemeData);
      setCurrentTheme(theme);
      Alert.alert('Theme Applied', `${theme.name} theme has been applied to Safari.`);
    } catch (error) {
      console.error('Error applying theme:', error);
      Alert.alert('Error', 'Failed to apply theme. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Safari</Text>
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
                  <View style={[styles.colorIndicator, { backgroundColor: currentTheme.text }]} />
                  <View style={[styles.colorIndicator, { backgroundColor: currentTheme.link }]} />
                </View>
              </View>
              <View style={styles.previewTextContainer}>
                <Text style={[styles.previewText, { color: currentTheme.text }]}>
                  Welcome to Aura
                </Text>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={[styles.previewLink, { color: currentTheme.link }]}>
                    Learn more
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Browse Themes Button */}
        <TouchableOpacity
          style={[styles.browseThemesButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('BrowseThemes', { forKeyboard: false })}
        >
          <Text style={[styles.browseThemesButtonText, { color: textColor }]}>Browse Themes</Text>
          <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Your Themes Button */}
        <TouchableOpacity
          style={[styles.browseThemesButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomThemesList', { forKeyboard: false })}
        >
          <Text style={[styles.browseThemesButtonText, { color: textColor }]}>Your Themes</Text>
          <Ionicons name="folder" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Create Theme Button */}
        <TouchableOpacity
          style={[styles.browseThemesButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomTheme')}
        >
          <Text style={[styles.browseThemesButtonText, { color: textColor }]}>Create Theme</Text>
          <Ionicons name="add" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Per-Site Settings Section */}
        <View style={styles.siteSettingsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Per-Site Settings</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Customize themes for specific websites.
          </Text>

          {Object.keys(siteThemes).length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: textColor }]}>No website-specific settings yet</Text>
              <Text style={[styles.emptyStateSubtext, { color: textColor }]}>
                Add custom settings for individual websites.
              </Text>
            </View>
          ) : (
            Object.keys(siteThemes).map((hostname) => (
              <TouchableOpacity
                key={hostname}
                style={[styles.siteRow, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => navigation.navigate('WebsiteSettings', { hostname })}
              >
                <View style={styles.siteRowContent}>
                  <Text style={[styles.siteName, { color: textColor }]}>{hostname}</Text>
                  {siteThemes[hostname].enabled ? (
                    <Text style={[styles.siteStatus, { color: appThemeColor }]}>Enabled</Text>
                  ) : (
                    <Text style={[styles.siteStatusDisabled, { color: '#FF4444' }]}>Disabled</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={[styles.addSiteButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => navigation.navigate('WebsiteSettings', { hostname: '' })}
          >
            <Text style={[styles.addSiteButtonText, { color: appThemeColor }]}>Add Website</Text>
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
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 2,
  },
  currentThemeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currentThemeTextContainer: {
    flex: 2,
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
    flexShrink: 0,
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
  arrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    width: 20,
  },
  selectMoreButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  selectMoreButtonIcon: {
    fontSize: 24,
    color: '#666666',
    fontWeight: '300',
  },
  browseThemesButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    marginBottom: 24,
  },
  browseThemesButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  browseThemesArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    width: 20,
  },
  siteSettingsSection: {
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
  siteRow: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
  },
  siteRowContent: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  siteStatus: {
    fontSize: 12,
    color: '#4CAF50', // Green for enabled
    fontWeight: '600',
  },
  siteStatusDisabled: {
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
  addSiteButton: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 8,
  },
  addSiteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addSiteButtonIcon: {
    // Style no longer used - replaced with Ionicons
  },
  themeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 28,
    borderWidth: 2,
    borderColor: '#2a2a2a',
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
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tapToChange: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  previewTextContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 20,
    minWidth: 120,
    minHeight: 50,
    paddingVertical: 8,
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
});

export default SafariScreen;
