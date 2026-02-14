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
} from 'react-native';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
}

const WebsiteSettingsScreen: React.FC<WebsiteSettingsScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor, appThemeMode } = useAppTheme();
  const initialHostname = route.params?.hostname || '';
  const [hostname, setHostname] = useState(initialHostname);
  const [websiteTheme, setWebsiteTheme] = useState<WebsiteTheme | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [isNew, setIsNew] = useState(!initialHostname);

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
        };
        setWebsiteTheme(completeTheme);
        setEnabled(completeTheme.enabled);
      }
    } catch (error) {
      console.error('Error loading global theme:', error);
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
        };
        setWebsiteTheme(completeTheme);
        setEnabled(completeTheme.enabled);
      } else {
        // Load global theme as default
        loadGlobalTheme();
      }
    } catch (error) {
      console.error('Error loading website settings:', error);
    }
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
    } catch (error) {
      console.error('Error toggling website theme:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
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
            <Text style={styles.label}>Website Domain</Text>
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

        <View style={styles.section}>
          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Enabled</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Aura will enhance {hostname || initialHostname || 'this website'} when enabled.
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: appThemeMode === 'dark' ? '#333' : '#CCC', true: appThemeColor }}
              thumbColor={enabled ? (appThemeMode === 'dark' ? '#FFFFFF' : '#FFFFFF') : (appThemeMode === 'dark' ? '#888' : '#999')}
            />
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => navigation.navigate('BrowseThemes', { forWebsite: hostname || initialHostname })}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Theme</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Customize how Aura's theme looks on {hostname || initialHostname || 'this website'}.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={textColor} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: sectionBgColor, borderColor }]} onPress={handleSave}>
          <Text style={[styles.saveButtonText, { color: textColor }]}>Save</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete</Text>
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
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4a2a2a',
  },
  deleteButtonText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WebsiteSettingsScreen;
