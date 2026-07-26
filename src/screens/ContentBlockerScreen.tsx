import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  NativeModules,
  Linking,
} from 'react-native';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { ContentBlockerManager } = NativeModules;

interface ContentBlockerScreenProps {
  navigation: any;
}

interface ContentBlockerCategories {
  ads: boolean;
  trackers: boolean;
  socialWidgets: boolean;
  annoyances: boolean;
}

interface ContentBlockerSettings {
  enabled: boolean;
  categories: ContentBlockerCategories;
}

interface BlockListStats {
  ads: number;
  trackers: number;
  socialWidgets: number;
  annoyances: number;
  totalActive: number;
}

const CATEGORY_INFO = {
  ads: {
    label: 'Ads',
    description: 'Block ads from Google, Facebook, and other major ad networks',
    icon: 'megaphone-outline' as const,
  },
  trackers: {
    label: 'Trackers',
    description: 'Block analytics and tracking scripts like Google Analytics, Mixpanel, and more',
    icon: 'eye-off-outline' as const,
  },
  socialWidgets: {
    label: 'Social Widgets',
    description: 'Block embedded social media widgets (Like buttons, Tweet embeds, etc.)',
    icon: 'share-social-outline' as const,
  },
  annoyances: {
    label: 'Annoyances',
    description: 'Hide cookie banners, newsletter popups, and "install our app" prompts',
    icon: 'close-circle-outline' as const,
  },
};

const ContentBlockerScreen: React.FC<ContentBlockerScreenProps> = ({ navigation }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [settings, setSettings] = useState<ContentBlockerSettings>({
    enabled: true,
    categories: {
      ads: true,
      trackers: true,
      socialWidgets: false,
      annoyances: true,
    },
  });
  const [stats, setStats] = useState<BlockListStats | null>(null);
  const [isEnabledInSafari, setIsEnabledInSafari] = useState<boolean | null>(null);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
    checkSafariState();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
      loadStats();
      checkSafariState();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.contentBlockerSettings) {
        setSettings(themeData.contentBlockerSettings);
      }
    } catch (error) {
      console.error('Error loading content blocker settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      if (ContentBlockerManager) {
        const blockStats = await ContentBlockerManager.getBlockListStats();
        setStats(blockStats);
      }
    } catch (error) {
      console.error('Error loading block list stats:', error);
    }
  };

  const checkSafariState = async () => {
    try {
      if (ContentBlockerManager) {
        const state = await ContentBlockerManager.getContentBlockerState();
        setIsEnabledInSafari(state.isEnabled);
      }
    } catch (error) {
      console.error('Error checking Safari state:', error);
      setIsEnabledInSafari(null);
    }
  };

  const saveSettings = async (newSettings: ContentBlockerSettings) => {
    try {
      const themeData = await getThemes();
      const newThemeData = {
        ...themeData,
        contentBlockerSettings: newSettings,
      };
      await saveThemes(newThemeData);
      setSettings(newSettings);

      // Reload content blocker rules in Safari
      await reloadRules();
      await loadStats();
    } catch (error) {
      console.error('Error saving content blocker settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const reloadRules = async () => {
    try {
      if (ContentBlockerManager) {
        setIsReloading(true);
        await ContentBlockerManager.reloadContentBlocker();
        setIsReloading(false);
      }
    } catch (error) {
      setIsReloading(false);
      console.error('Error reloading content blocker:', error);
    }
  };

  const handleToggleEnabled = useCallback(async (value: boolean) => {
    const newSettings = { ...settings, enabled: value };
    await saveSettings(newSettings);
  }, [settings]);

  const handleToggleCategory = useCallback(async (category: keyof ContentBlockerCategories, value: boolean) => {
    const newSettings = {
      ...settings,
      categories: {
        ...settings.categories,
        [category]: value,
      },
    };
    await saveSettings(newSettings);
  }, [settings]);

  const totalRules = stats
    ? (settings.categories.ads ? stats.ads : 0) +
      (settings.categories.trackers ? stats.trackers : 0) +
      (settings.categories.socialWidgets ? stats.socialWidgets : 0) +
      (settings.categories.annoyances ? stats.annoyances : 0)
    : 0;

  const subtitleColor = textColor === '#FFFFFF' ? '#AAAAAA' : '#666666';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Protection</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: sectionBgColor, borderColor }]}>
          <View style={styles.statusIconContainer}>
            <Ionicons
              name={settings.enabled ? 'shield-checkmark' : 'shield-outline'}
              size={48}
              color={settings.enabled ? appThemeColor : subtitleColor}
            />
          </View>
          <Text style={[styles.statusTitle, { color: textColor }]}>
            {settings.enabled ? 'Protection Active' : 'Protection Disabled'}
          </Text>
          <Text style={[styles.statusSubtitle, { color: subtitleColor }]}>
            {settings.enabled
              ? `${totalRules} rules blocking ads, trackers & more`
              : 'Enable to block unwanted content in Safari'}
          </Text>
        </View>

        {/* Safari Status Warning */}
        {isEnabledInSafari !== true && (
          <TouchableOpacity
            style={[styles.warningBanner, { borderColor: isEnabledInSafari === false ? '#ff6b6b' : appThemeColor }]}
            onPress={() => {
              Alert.alert(
                'Enable in Safari Settings',
                'To use Aura\'s content blocker:\n\n1. Open the Settings app\n2. Scroll down and tap Safari\n3. Tap Extensions\n4. Find "Aura Content Blocker"\n5. Toggle it ON\n6. Allow on All Websites\n\nThe content blocker will then automatically block ads, trackers, and other unwanted content on every page you visit.',
                [
                  { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
                  { text: 'OK', style: 'cancel' },
                ]
              );
            }}
          >
            <Ionicons name="warning-outline" size={20} color={isEnabledInSafari === false ? '#ff6b6b' : appThemeColor} />
            <Text style={[styles.warningText, { color: '#FFFFFF' }]}>
              {isEnabledInSafari === false
                ? 'Content Blocker not enabled in Safari. Tap to learn how.'
                : 'Make sure the Content Blocker is enabled in Safari Settings. Tap for instructions.'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={isEnabledInSafari === false ? '#ff6b6b' : appThemeColor} />
          </TouchableOpacity>
        )}

        {/* Master Toggle */}
        <View style={styles.section}>
          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: textColor }]}>Content Blocking</Text>
              <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                Block unwanted content automatically in Safari
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleEnabled}
              trackColor={{ false: '#3e3e3e', true: appThemeColor }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Categories</Text>
          <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
            Choose what types of content to block
          </Text>

          {(Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>).map((category) => {
            const info = CATEGORY_INFO[category];
            const ruleCount = stats ? stats[category] : 0;
            const isEnabled = settings.categories[category];

            return (
              <View
                key={category}
                style={[
                  styles.categoryRow,
                  { backgroundColor: sectionBgColor, borderColor },
                  !settings.enabled && styles.disabledRow,
                ]}
              >
                <View style={styles.categoryIconContainer}>
                  <Ionicons
                    name={info.icon}
                    size={24}
                    color={isEnabled && settings.enabled ? appThemeColor : subtitleColor}
                  />
                </View>
                <View style={styles.categoryContent}>
                  <View style={styles.categoryHeader}>
                    <Text style={[styles.categoryLabel, { color: textColor }]}>{info.label}</Text>
                    {ruleCount > 0 && (
                      <Text style={[styles.ruleCount, { color: subtitleColor }]}>
                        {ruleCount} rules
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.categoryDescription, { color: subtitleColor }]}>
                    {info.description}
                  </Text>
                </View>
                <Switch
                  value={isEnabled}
                  onValueChange={(value) => handleToggleCategory(category, value)}
                  trackColor={{ false: '#3e3e3e', true: appThemeColor }}
                  thumbColor="#FFFFFF"
                  disabled={!settings.enabled}
                />
              </View>
            );
          })}
        </View>

        {/* Reload Rules Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.reloadButton, { borderColor: appThemeColor }]}
            onPress={async () => {
              await reloadRules();
              await checkSafariState();
              Alert.alert('Rules Reloaded', 'Content blocker rules have been updated in Safari.');
            }}
            disabled={isReloading}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={appThemeColor}
            />
            <Text style={[styles.reloadButtonText, { color: '#FFFFFF' }]}>
              {isReloading ? 'Reloading...' : 'Reload Rules'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>How It Works</Text>
          <View style={[styles.infoCard, { backgroundColor: sectionBgColor, borderColor }]}>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={appThemeColor} />
              <Text style={[styles.infoText, { color: subtitleColor }]}>
                Aura provides Safari with blocking rules that run automatically on every page you visit.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="flash-outline" size={20} color={appThemeColor} />
              <Text style={[styles.infoText, { color: subtitleColor }]}>
                Rules are compiled by Safari for maximum performance — no slowdown to your browsing.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="lock-closed-outline" size={20} color={appThemeColor} />
              <Text style={[styles.infoText, { color: subtitleColor }]}>
                All blocking happens on-device. No data is sent to any server.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
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
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  statusBanner: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#ff6b6b',
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
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
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  disabledRow: {
    opacity: 0.5,
  },
  categoryIconContainer: {
    width: 36,
    alignItems: 'center',
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
    marginRight: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  ruleCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryDescription: {
    fontSize: 13,
    lineHeight: 17,
  },
  reloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  reloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ContentBlockerScreen;
