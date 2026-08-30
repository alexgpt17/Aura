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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ThemeColorDots } from '../components/ThemeSwatch';
import { PRESET_THEMES } from './BrowseThemesScreen';
import {
  getSafariExtensionEnableInstructions,
  getSafariExtensionState,
} from '../services/SafariExtensionService';

interface SafariScreenProps {
  navigation: any;
}

interface CurrentTheme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  backgroundType?: string;
  backgroundGradient?: string | null;
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

const SafariScreen: React.FC<SafariScreenProps> = ({ navigation }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [currentTheme, setCurrentTheme] = useState<CurrentTheme | null>(null);
  const [siteThemes, setSiteThemes] = useState<Record<string, WebsiteTheme>>({});
  /** Shown until the Safari extension has run at least once (App Group heartbeat). */
  const [showSafariSetupBanner, setShowSafariSetupBanner] = useState(false);
  const [nativeDarkModeEnabled, setNativeDarkModeEnabled] = useState(false);

  useEffect(() => {
    loadCurrentTheme();
    loadSiteThemes();
    loadExtensionState();
    loadDarkModeSetting();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentTheme();
      loadSiteThemes();
      loadExtensionState();
      loadDarkModeSetting();
    });
    return unsubscribe;
  }, [navigation]);

  const loadDarkModeSetting = async () => {
    try {
      const themeData = await getThemes();
      setNativeDarkModeEnabled(themeData?.nativeDarkModeEnabled ?? false);
    } catch (error) {
      console.error('Error loading dark mode setting:', error);
      setNativeDarkModeEnabled(false);
    }
  };

  const handleToggleDarkMode = async (value: boolean) => {
    try {
      const currentData = await getThemes();
      await saveThemes({ ...currentData, nativeDarkModeEnabled: value });
      setNativeDarkModeEnabled(value);
    } catch (error) {
      console.error('Error toggling dark mode:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
    }
  };

  const loadExtensionState = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.hasCompletedSafariSetup) {
        setShowSafariSetupBanner(false);
        return;
      }
      const state = await getSafariExtensionState();
      // Heartbeat is written when Safari invokes the extension — treat any seen
      // run as setup complete so the banner does not keep coming back.
      if (state.lastSeen > 0 || state.isEnabled) {
        await saveThemes({
          ...themeData,
          hasCompletedSafariSetup: true,
        });
        setShowSafariSetupBanner(false);
        return;
      }
      setShowSafariSetupBanner(true);
    } catch {
      setShowSafariSetupBanner(false);
    }
  };

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.globalTheme) {
        const current = themeData.globalTheme;
        const matchingTheme = PRESET_THEMES.find(
          theme =>
            theme.id === current.id ||
            (theme.background === current.background &&
              theme.text === current.text &&
              theme.link === current.link &&
              (theme.backgroundType || 'color') === (current.backgroundType || 'color')),
        );
        if (matchingTheme) {
          setCurrentTheme({
            id: matchingTheme.id,
            name: matchingTheme.name,
            background: matchingTheme.background,
            text: matchingTheme.text,
            link: matchingTheme.link,
            backgroundType: matchingTheme.backgroundType,
            backgroundGradient: matchingTheme.backgroundGradient,
          });
        } else {
          setCurrentTheme({
            id: current.id || 'custom',
            name: current.name || 'Custom',
            background: current.background || '#000000',
            text: current.text || '#ffffff',
            link: current.link || '#228B22',
            backgroundType: current.backgroundType,
            backgroundGradient: current.backgroundGradient,
          });
        }
      } else {
        setCurrentTheme(null);
      }
    } catch (error) {
      console.error('Error loading current theme:', error);
      setCurrentTheme(null);
    }
  };

  const handleClearTheme = async () => {
    Alert.alert('Clear Theme', 'Are you sure you want to clear the current theme?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const currentData = await getThemes();
            await saveThemes({
              ...currentData,
              globalTheme: null,
            });
            setCurrentTheme(null);
            Alert.alert('Theme Cleared', 'The current theme has been cleared.');
          } catch (error) {
            console.error('Error clearing theme:', error);
            Alert.alert('Error', 'Failed to clear theme. Please try again.');
          }
        },
      },
    ]);
  };

  const loadSiteThemes = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.siteThemes) {
        setSiteThemes(themeData.siteThemes);
      } else {
        setSiteThemes({});
      }
    } catch (error) {
      console.error('Error loading site themes:', error);
      setSiteThemes({});
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Themes</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {showSafariSetupBanner && (
          <TouchableOpacity
            style={[styles.warningBanner, { borderColor: '#FF9800', backgroundColor: sectionBgColor }]}
            onPress={() =>
              Alert.alert('Enable Safari Extension', getSafariExtensionEnableInstructions())
            }
            accessibilityRole="button"
            accessibilityLabel="Safari extension is not enabled. Tap for instructions."
          >
            <Ionicons name="warning-outline" size={22} color="#FF9800" />
            <View style={styles.warningTextWrap}>
              <Text style={[styles.warningTitle, { color: textColor }]}>
                Finish Safari setup
              </Text>
              <Text style={[styles.warningBody, { color: textColor }]}>
                Themes only apply once Aura is turned on under Settings → Safari → Extensions. Tap
                for steps.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
          </TouchableOpacity>
        )}

        <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
          <View style={styles.settingContent}>
            <Text style={[styles.settingLabel, { color: textColor }]}>Dark Mode</Text>
            <Text style={[styles.settingDescription, { color: textColor }]}>
              Use each website's own dark mode instead of your theme colors.
            </Text>
          </View>
          <Switch
            value={nativeDarkModeEnabled}
            onValueChange={handleToggleDarkMode}
            trackColor={{ false: '#3e3e3e', true: appThemeColor }}
            thumbColor="#FFFFFF"
          />
        </View>

        {currentTheme ? (
          <View style={[styles.themeCard, { borderColor }]}>
            <ThemeColorDots theme={currentTheme} />
            <View style={styles.themeTextContainer}>
              <View style={styles.themeHeaderRow}>
                <Text style={[styles.themeName, { color: textColor }]}>{currentTheme.name}</Text>
                <View style={styles.badgeContainer}>
                  <View style={[styles.currentBadge, { backgroundColor: appThemeColor }]}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: borderColor }]}
                    onPress={handleClearTheme}
                    accessibilityLabel="Clear current theme"
                  >
                    <Ionicons name="close" size={14} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.themeCard, { borderColor }]}
            onPress={() => navigation.navigate('BrowseThemes')}
            accessibilityRole="button"
            accessibilityLabel="No theme selected. Choose a theme."
          >
            <Text style={[styles.themeName, { color: textColor, opacity: 0.55, flex: 1 }]}>
              No theme selected
            </Text>
            <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.browseThemesButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('BrowseThemes')}
        >
          <Text style={[styles.browseThemesButtonText, { color: textColor }]}>Browse Themes</Text>
          <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.browseThemesButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomThemesList')}
        >
          <Text style={[styles.browseThemesButtonText, { color: textColor }]}>Your Themes</Text>
          <Ionicons name="folder" size={20} color={appThemeColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.browseThemesButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomTheme')}
        >
          <Text style={[styles.browseThemesButtonText, { color: textColor }]}>Create Theme</Text>
          <Ionicons name="add" size={20} color={appThemeColor} />
        </TouchableOpacity>

        <View style={styles.websiteSettingsSection}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Website Settings</Text>
          <Text style={[styles.sectionDescription, { color: textColor }]}>
            Customize themes for specific websites.
          </Text>

          {Object.keys(siteThemes).length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: sectionBgColor, borderColor }]}>
              <Text style={[styles.emptyStateText, { color: textColor }]}>
                No website-specific settings yet
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: textColor }]}>
                Add custom settings for individual websites.
              </Text>
            </View>
          ) : (
            Object.keys(siteThemes).map(hostname => (
              <TouchableOpacity
                key={hostname}
                style={[styles.siteRow, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => navigation.navigate('WebsiteSettings', { hostname })}
              >
                <View style={styles.siteRowContent}>
                  <ThemeColorDots
                    theme={{
                      background: siteThemes[hostname].background,
                      text: siteThemes[hostname].text,
                      link: siteThemes[hostname].link,
                      backgroundType: siteThemes[hostname].backgroundType,
                      backgroundGradient: siteThemes[hostname].backgroundGradient,
                      name: hostname,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.siteName, { color: textColor }]}>{hostname}</Text>
                    {siteThemes[hostname].enabled ? (
                      <Text style={[styles.siteStatus, { color: '#4CAF50' }]}>Enabled</Text>
                    ) : (
                      <Text style={[styles.siteStatusDisabled, { color: '#FF4444' }]}>Disabled</Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={[styles.addSiteButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => navigation.navigate('WebsiteSettings', { hostname: '' })}
          >
            <Text style={[styles.addSiteButtonText, { color: textColor }]}>Add Website</Text>
            <Ionicons name="add" size={20} color={appThemeColor} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 34, fontWeight: 'bold' },
  content: { flex: 1 },
  scrollContent: { padding: 20 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    minHeight: 44,
  },
  warningTextWrap: { flex: 1 },
  warningTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  warningBody: { fontSize: 13, lineHeight: 18, opacity: 0.85 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  settingContent: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingDescription: { fontSize: 14, lineHeight: 18, opacity: 0.7 },
  themeCard: {
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  themeTextContainer: { flex: 1, marginLeft: 8 },
  themeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  themeName: { fontSize: 17, fontWeight: '500', flexShrink: 1 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'uppercase' },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseThemesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  browseThemesButtonText: { fontSize: 16, fontWeight: '600' },
  websiteSettingsSection: { marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  sectionDescription: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyStateText: { fontSize: 16, marginBottom: 8, fontWeight: '600' },
  emptyStateSubtext: { fontSize: 14, textAlign: 'center', lineHeight: 20, opacity: 0.7 },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  siteRowContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  siteName: { fontSize: 15, fontWeight: '600' },
  siteStatus: { fontSize: 12, marginTop: 2 },
  siteStatusDisabled: { fontSize: 12, marginTop: 2 },
  addSiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    minHeight: 44,
  },
  addSiteButtonText: { fontSize: 16, fontWeight: '600' },
});

export default SafariScreen;
