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

// Minimal app list for name lookup (full expanded list is in AppPickerScreen)
// This is just used to display app names for known apps
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
  // Add a few popular third-party apps for name lookup
  { bundleId: 'com.burbn.instagram', name: 'Instagram' },
  { bundleId: 'com.spotify.client', name: 'Spotify' },
  { bundleId: 'com.netflix.Netflix', name: 'Netflix' },
  { bundleId: 'com.google.ios.youtube', name: 'YouTube' },
  { bundleId: 'net.whatsapp.WhatsApp', name: 'WhatsApp' },
];

interface AppSettingsScreenProps {
  navigation: any;
  route: {
    params?: {
      bundleId?: string;
    };
  };
}

interface AppTheme {
  enabled: boolean;
  background: string;
  text: string;
  link: string;
  keyColor?: string;
  backgroundType: string;
  backgroundImage: string | null;
}

const AppSettingsScreen: React.FC<AppSettingsScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor, appThemeMode } = useAppTheme();
  const initialBundleId = route.params?.bundleId || '';
  const [bundleId, setBundleId] = useState(initialBundleId);
  const [appName, setAppName] = useState('');
  const [appTheme, setAppTheme] = useState<AppTheme | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [isNew, setIsNew] = useState(!initialBundleId);

  useEffect(() => {
    if (initialBundleId) {
      loadAppSettings();
      // Load app name if bundle ID exists
      const app = COMMON_APPS.find(a => a.bundleId === initialBundleId);
      if (app) {
        setAppName(app.name);
      }
    } else {
      // New app - initialize with keyboard theme
      loadKeyboardTheme();
    }
  }, [initialBundleId]);

  const loadKeyboardTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.keyboardTheme) {
        const keyboardTheme = themeData.keyboardTheme;
        const completeTheme: AppTheme = {
          enabled: keyboardTheme.enabled ?? true,
          background: keyboardTheme.background || '#000000',
          text: keyboardTheme.text || '#ffffff',
          link: keyboardTheme.link || '#228B22',
          keyColor: keyboardTheme.keyColor,
          backgroundType: keyboardTheme.backgroundType || 'color',
          backgroundImage: keyboardTheme.backgroundImage || null,
        };
        setAppTheme(completeTheme);
        setEnabled(completeTheme.enabled);
      }
    } catch (error) {
      console.error('Error loading keyboard theme:', error);
    }
  };

  const loadAppSettings = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.appThemes?.[bundleId]) {
        const appThemeData = themeData.appThemes[bundleId];
        const completeTheme: AppTheme = {
          enabled: appThemeData.enabled ?? true,
          background: appThemeData.background || '#000000',
          text: appThemeData.text || '#ffffff',
          link: appThemeData.link || '#228B22',
          backgroundType: appThemeData.backgroundType || 'color',
          backgroundImage: appThemeData.backgroundImage || null,
        };
        setAppTheme(completeTheme);
        setEnabled(completeTheme.enabled);
      } else {
        // Load keyboard theme as default
        loadKeyboardTheme();
      }
    } catch (error) {
      console.error('Error loading app settings:', error);
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    try {
      const currentData = await getThemes();
      const existingTheme = appTheme || currentData?.appThemes?.[bundleId];
      const baseTheme = existingTheme || currentData?.keyboardTheme || {};
      
      const completeTheme: AppTheme = {
        enabled: value,
        background: baseTheme.background || '#000000',
        text: baseTheme.text || '#ffffff',
        link: baseTheme.link || '#228B22',
        keyColor: baseTheme.keyColor,
        backgroundType: baseTheme.backgroundType || 'color',
        backgroundImage: baseTheme.backgroundImage || null,
      };
      
      const newAppThemes = {
        ...(currentData?.appThemes || {}),
        [bundleId]: completeTheme,
      };
      const newThemeData = {
        ...currentData,
        appThemes: newAppThemes,
      };
      await saveThemes(newThemeData);
      setEnabled(value);
      setAppTheme(completeTheme);
    } catch (error) {
      console.error('Error toggling app theme:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const handleSave = async () => {
    const cleanBundleId = bundleId.trim();
    if (!cleanBundleId) {
      Alert.alert('Error', 'Please enter an app bundle ID.');
      return;
    }

    try {
      const currentData = await getThemes();
      const baseTheme = appTheme || currentData?.appThemes?.[cleanBundleId] || currentData?.keyboardTheme || {};
      
      const completeTheme: AppTheme = {
        enabled: enabled,
        background: baseTheme.background || '#000000',
        text: baseTheme.text || '#ffffff',
        link: baseTheme.link || '#228B22',
        keyColor: baseTheme.keyColor,
        backgroundType: baseTheme.backgroundType || 'color',
        backgroundImage: baseTheme.backgroundImage || null,
      };
      
      const newAppThemes = {
        ...(currentData?.appThemes || {}),
        [cleanBundleId]: completeTheme,
      };
      const newThemeData = {
        ...currentData,
        appThemes: newAppThemes,
      };
      await saveThemes(newThemeData);
      Alert.alert('Saved', `Settings saved for ${cleanBundleId}`);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving app settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Settings',
      `Are you sure you want to delete settings for ${bundleId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentData = await getThemes();
              const newAppThemes = { ...(currentData?.appThemes || {}) };
              delete newAppThemes[bundleId];
              const newThemeData = {
                ...currentData,
                appThemes: newAppThemes,
              };
              await saveThemes(newThemeData);
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting app settings:', error);
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
        <Text style={[styles.headerTitle, { color: textColor }]}>
          {appName || bundleId || initialBundleId || 'New App'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {isNew && (
          <View style={styles.section}>
            <Text style={styles.label}>Select App</Text>
            <TouchableOpacity
              style={[styles.selectAppButton, { backgroundColor: sectionBgColor, borderColor }]}
              onPress={() => {
                navigation.navigate('AppPicker', {
                  onSelectApp: (selectedBundleId: string, selectedAppName: string) => {
                    setBundleId(selectedBundleId);
                    setAppName(selectedAppName);
                  },
                });
              }}
            >
              <Text style={[styles.selectAppButtonText, { color: textColor }]}>
                {bundleId ? `${appName || bundleId}` : 'Tap to select an app'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
            </TouchableOpacity>
            {bundleId && (
              <Text style={[styles.hint, { color: textColor }]}>
                Bundle ID: {bundleId}
              </Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Enabled</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Aura will apply this keyboard theme to {bundleId || initialBundleId || 'this app'} when enabled.
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
            onPress={() => navigation.navigate('BrowseThemes', { forApp: bundleId || initialBundleId })}
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Theme</Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Customize how Aura's keyboard theme looks in {bundleId || initialBundleId || 'this app'}.
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
  selectAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  selectAppButtonText: {
    fontSize: 16,
    flex: 1,
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

export default AppSettingsScreen;
