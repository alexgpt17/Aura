import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import { PRESET_THEMES } from './BrowseThemesScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeColorDots } from '../components/ThemeSwatch';

interface WebsiteSettingsScreenProps {
  navigation: any;
  route: {
    params?: {
      hostname?: string;
    };
  };
}

interface WebsiteTheme {
  enabled: boolean;
  background: string;
  text: string;
  link: string;
  backgroundType: string;
  backgroundImage: string | null;
  backgroundGradient?: string | null;
}

const WebsiteSettingsScreen: React.FC<WebsiteSettingsScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor, appThemeMode } = useAppTheme();
  const initialHostname = route.params?.hostname || '';
  const [hostname, setHostname] = useState(initialHostname);
  const [websiteTheme, setWebsiteTheme] = useState<WebsiteTheme | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [isNew, setIsNew] = useState(!initialHostname);
  const [currentThemeName, setCurrentThemeName] = useState<string>('No theme selected');

  useEffect(() => {
    if (initialHostname) {
      loadWebsiteSettings();
    } else {
      // New website - initialize with global theme
      loadGlobalTheme();
    }
  }, [initialHostname]);

  const loadGlobalTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.globalTheme) {
        // Create a complete, independent copy
        const globalTheme = themeData.globalTheme;
        const completeTheme: WebsiteTheme = {
          enabled: globalTheme.enabled ?? true,
          background: globalTheme.background || '#000000',
          text: globalTheme.text || '#ffffff',
          link: globalTheme.link || '#228B22',
          backgroundType: globalTheme.backgroundType || 'color',
          backgroundImage: globalTheme.backgroundImage || null,
          backgroundGradient: globalTheme.backgroundGradient || null,
        };
        setWebsiteTheme(completeTheme);
        setEnabled(completeTheme.enabled);
        updateThemeName(completeTheme);
      } else {
        // No global theme - show "No theme selected"
        setWebsiteTheme(null);
        setCurrentThemeName('No theme selected');
        setEnabled(true);
      }
    } catch (error) {
      console.error('Error loading global theme:', error);
      setWebsiteTheme(null);
      setCurrentThemeName('No theme selected');
    }
  };

  const loadWebsiteSettings = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.siteThemes?.[hostname]) {
        // Create a complete copy to ensure independence
        const siteTheme = themeData.siteThemes[hostname];
        const completeTheme: WebsiteTheme = {
          enabled: siteTheme.enabled ?? true,
          background: siteTheme.background || '#000000',
          text: siteTheme.text || '#ffffff',
          link: siteTheme.link || '#228B22',
          backgroundType: siteTheme.backgroundType || 'color',
          backgroundImage: siteTheme.backgroundImage || null,
          backgroundGradient: siteTheme.backgroundGradient || null,
        };
        setWebsiteTheme(completeTheme);
        setEnabled(completeTheme.enabled);
        updateThemeName(completeTheme);
      } else {
        // No site-specific theme - check for global theme, otherwise show "No theme selected"
        const themeData = await getThemes();
        if (themeData?.globalTheme) {
          loadGlobalTheme();
        } else {
          setWebsiteTheme(null);
          setCurrentThemeName('No theme selected');
          setEnabled(true);
        }
      }
    } catch (error) {
      console.error('Error loading website settings:', error);
    }
  };

  const updateThemeName = (theme: WebsiteTheme) => {
    const matchingPreset = PRESET_THEMES.find(
      (preset) => {
        const dual = (t: string | undefined) => t === 'gradient' || t === 'split';
        if (dual(theme.backgroundType) && dual(preset.backgroundType)) {
          return theme.backgroundGradient === preset.backgroundGradient &&
                 preset.text === theme.text &&
                 preset.link === theme.link;
        } else {
          return preset.background === theme.background &&
                 preset.text === theme.text &&
                 preset.link === theme.link;
        }
      }
    );
    setCurrentThemeName(matchingPreset ? matchingPreset.name : 'Custom');
  };

  const handleToggleEnabled = async (value: boolean) => {
    try {
      const currentData = await getThemes();
      // Make sure we have a complete, independent theme object
      const existingTheme = websiteTheme || currentData?.siteThemes?.[hostname];
      const baseTheme = existingTheme || currentData?.globalTheme || {};
      
      // Create a complete, independent copy
      const completeTheme: WebsiteTheme = {
        enabled: value,
        background: baseTheme.background || '#000000',
        text: baseTheme.text || '#ffffff',
        link: baseTheme.link || '#228B22',
        backgroundType: baseTheme.backgroundType || 'color',
        backgroundImage: baseTheme.backgroundImage || null,
        backgroundGradient: baseTheme.backgroundGradient || null,
      };
      
      const newSiteThemes = {
        ...(currentData?.siteThemes || {}),
        [hostname]: completeTheme,
      };
      const newThemeData = {
        ...currentData,
        siteThemes: newSiteThemes,
      };
      await saveThemes(newThemeData);
      setEnabled(value);
      setWebsiteTheme(completeTheme);
      updateThemeName(completeTheme);
    } catch (error) {
      console.error('Error toggling website theme:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const handleOpenInSafari = () => {
    const url = hostname || initialHostname;
    if (url) {
      const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
      Linking.openURL(cleanUrl).catch(() => {
        Alert.alert('Error', 'Could not open website in Safari.');
      });
    } else {
      Alert.alert('Error', 'Please enter a website domain first.');
    }
  };

  const handleReportIssue = () => {
    Alert.alert(
      'Report Issue',
      'If you\'re experiencing issues with this website, please contact support with details about the problem.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Contact Support',
          onPress: () => {
            Linking.openURL('mailto:alexmartens1111@gmail.com?subject=Website Issue Report').catch(() => {
              Alert.alert('Error', 'Could not open email client.');
            });
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    const cleanHostname = hostname.trim().toLowerCase();
    if (!cleanHostname) {
      Alert.alert('Error', 'Please enter a website domain.');
      return;
    }

    // Remove protocol and path if present
    const domain = cleanHostname.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];

    try {
      const currentData = await getThemes();
      
      // Get the base theme (existing website theme or global theme)
      const baseTheme = websiteTheme || currentData?.siteThemes?.[domain] || currentData?.globalTheme || {};
      
      // Create a complete, independent copy with all properties
      const completeTheme: WebsiteTheme = {
        enabled: enabled,
        background: baseTheme.background || '#000000',
        text: baseTheme.text || '#ffffff',
        link: baseTheme.link || '#228B22',
        backgroundType: baseTheme.backgroundType || 'color',
        backgroundImage: baseTheme.backgroundImage || null,
        backgroundGradient: baseTheme.backgroundGradient || null,
      };
      
      const newSiteThemes = {
        ...(currentData?.siteThemes || {}),
        [domain]: completeTheme,
      };
      const newThemeData = {
        ...currentData,
        siteThemes: newSiteThemes,
      };
      await saveThemes(newThemeData);
      Alert.alert('Saved', `Settings saved for ${domain}`);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving website settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Settings',
      `Are you sure you want to delete settings for ${hostname}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentData = await getThemes();
              const newSiteThemes = { ...(currentData?.siteThemes || {}) };
              delete newSiteThemes[hostname];
              const newThemeData = {
                ...currentData,
                siteThemes: newSiteThemes,
              };
              await saveThemes(newThemeData);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting website settings:', error);
              Alert.alert('Error', 'Failed to delete settings. Please try again.');
            }
          },
        },
      ]
    );
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
        <Text style={[styles.headerTitle, { color: textColor }]}>{hostname || initialHostname || 'New Website'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {isNew && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: textColor }]}>WEBSITE DOMAIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: sectionBgColor, borderColor, color: textColor }]}
              placeholder="example.com"
              placeholderTextColor={textColor === '#FFFFFF' ? '#666' : '#999'}
              value={hostname}
              onChangeText={setHostname}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.hint, { color: textColor }]}>
              Enter the website domain (e.g., google.com, wikipedia.org)
            </Text>
          </View>
        )}

        {/* Enabled Button - Only show for existing sites */}
        {!isNew && (
          <View style={[styles.simpleSettingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <Text style={[styles.simpleSettingLabel, { color: enabled ? '#4CAF50' : '#FF4444' }]}>
              {enabled ? 'Enabled' : 'Disabled'}
            </Text>
            <Switch
              value={enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: appThemeMode === 'dark' ? '#3e3e3e' : '#CCC', true: appThemeColor }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        {/* Theme Button */}
        <TouchableOpacity
          style={[styles.themeSettingRow, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('ThemeSelection', { forWebsite: hostname || initialHostname })}
        >
          <View style={styles.themeSettingContent}>
            <Text style={[styles.themeSettingLabel, { color: textColor }]}>Theme</Text>
            <View style={styles.themeSettingValueRow}>
              {websiteTheme && (
                <ThemeColorDots
                  theme={{
                    ...websiteTheme,
                    name: currentThemeName,
                  }}
                />
              )}
              <Text style={[styles.themeSettingValue, { color: websiteTheme ? textColor : (textColor === '#FFFFFF' ? '#888888' : '#666666'), flex: 1 }]}>
                {currentThemeName}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* ACTIONS Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: textColor }]}>ACTIONS</Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={handleReportIssue}
          >
            <Ionicons name="alert-circle-outline" size={20} color="#ff6b6b" />
            <Text style={[styles.actionButtonText, { color: '#ff6b6b' }]}>Report Issue With This Website</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={handleOpenInSafari}
          >
            <Ionicons name="globe-outline" size={20} color={appThemeColor} />
            <Text style={[styles.actionButtonText, { color: appThemeColor }]}>Open Website in Safari</Text>
          </TouchableOpacity>
        </View>

        {isNew && (
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: appThemeColor, borderColor: appThemeColor }]} onPress={handleSave}>
            <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>Save</Text>
          </TouchableOpacity>
        )}

        {!isNew && (
          <TouchableOpacity style={[styles.deleteButton, { backgroundColor: sectionBgColor, borderColor }]} onPress={handleDelete}>
            <Text style={[styles.deleteButtonText, { color: '#FF4444' }]}>Delete Settings</Text>
          </TouchableOpacity>
        )}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  label: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  simpleSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  simpleSettingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  themeSettingContent: {
    flex: 1,
    marginRight: 12,
  },
  themeSettingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  themeSettingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeSettingValue: {
    fontSize: 14,
  },
  colorDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 30,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  themeIcon: {
    marginRight: 8,
  },
  themeTextContainer: {
    flex: 1,
  },
  themeValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  arrow: {
    // Style no longer used - replaced with Ionicons
    marginLeft: 12,
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WebsiteSettingsScreen;
