import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SUPPORT_EMAIL } from '../constants/AppConfig';
import {
  getSafariExtensionEnableInstructions,
  getSafariExtensionState,
} from '../services/SafariExtensionService';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const {
    appThemeColor,
    appThemeMode,
    backgroundColor,
    textColor,
    sectionBgColor,
    borderColor,
  } = useAppTheme();
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [safariExtensionEnabled, setSafariExtensionEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

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
      }
      const ext = await getSafariExtensionState();
      setSafariExtensionEnabled(ext.isEnabled);
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
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() =>
              Alert.alert('Enable Safari Extension', getSafariExtensionEnableInstructions())
            }
            accessibilityRole="button"
            accessibilityLabel="How to enable the Safari extension"
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: appThemeColor }]}>
                {safariExtensionEnabled ? 'Safari Extension Active' : 'Finish Safari Setup'}
              </Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Tap for step-by-step instructions to turn on Aura in Safari.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Focus Mode</Text>
          <TouchableOpacity
            style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => navigation.navigate('FocusMode')}
            accessibilityRole="button"
            accessibilityLabel="Focus Mode settings"
          >
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: appThemeColor }]}>
                Automatic Themes
              </Text>
              <Text style={[styles.settingDescription, { color: textColor }]}>
                Map themes to Focus modes, or switch by time of day.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>About</Text>
          <View style={[styles.aboutContent, { backgroundColor: sectionBgColor, borderBottomColor: borderColor }]}>
            <Text style={[styles.aboutLabel, { color: textColor }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: textColor }]}>1.0</Text>
          </View>
          <TouchableOpacity
            style={[styles.aboutContent, { backgroundColor: sectionBgColor, borderBottomColor: borderColor }]}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            accessibilityRole="button"
            accessibilityLabel="Privacy Policy"
          >
            <Text style={[styles.aboutLabel, { color: textColor }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
          </TouchableOpacity>
          <View style={[styles.aboutContentContact, { backgroundColor: sectionBgColor, borderBottomColor: borderColor }]}>
            <Text style={[styles.aboutLabel, { color: textColor }]}>Contact Developer:</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              accessibilityRole="link"
              accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
            >
              <Text style={[styles.aboutValue, styles.aboutLink]}>{SUPPORT_EMAIL}</Text>
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
    minHeight: 44,
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
    minHeight: 44,
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
    fontWeight: '600',
  },
  aboutLink: {
    color: '#228B22',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
});

export default SettingsScreen;
