import React, { useState, useEffect, useCallback } from 'react';
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
import { getThemes, saveThemes } from '../storage';
import FocusModeService from '../services/FocusModeService';
import { useAppTheme } from '../contexts/AppThemeContext';
import { PRESET_THEMES } from './BrowseThemesScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { calculateSunriseSunset, formatTime } from '../services/SunsetSunriseService';

interface FocusModeScreenProps {
  navigation: any;
}

interface FocusModeMapping {
  work: string | null;
  sleep: string | null;
  personal: string | null;
  doNotDisturb: string | null;
}

const FOCUS_MODES: { key: keyof FocusModeMapping; label: string; icon: string; description: string }[] = [
  {
    key: 'work',
    label: 'Work',
    icon: 'briefcase-outline',
    description: 'Applied during Work Focus',
  },
  {
    key: 'personal',
    label: 'Personal',
    icon: 'person-outline',
    description: 'Applied during Personal Focus',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    icon: 'moon-outline',
    description: 'Applied during Sleep Focus',
  },
  {
    key: 'doNotDisturb',
    label: 'Do Not Disturb',
    icon: 'remove-circle-outline',
    description: 'Applied during Do Not Disturb',
  },
];

const FocusModeScreen: React.FC<FocusModeScreenProps> = ({ navigation }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [focusModeEnabled, setFocusModeEnabled] = useState(false);
  const [focusModeAvailable, setFocusModeAvailable] = useState(false);
  const [mappings, setMappings] = useState<FocusModeMapping>({
    work: null,
    sleep: null,
    personal: null,
    doNotDisturb: null,
  });
  const [allThemes, setAllThemes] = useState<{ id: string; name: string; background?: string; text?: string; link?: string; backgroundType?: string; backgroundGradient?: string }[]>([]);
  const [expandedRules, setExpandedRules] = useState<{ [key: string]: boolean }>({});
  
  // Time-based rule state
  const [timeBasedEnabled, setTimeBasedEnabled] = useState(false);
  const [timeBasedMode, setTimeBasedMode] = useState<'manual' | 'sunset'>('manual');
  const [timeBasedDayTheme, setTimeBasedDayTheme] = useState<string | null>(null);
  const [timeBasedNightTheme, setTimeBasedNightTheme] = useState<string | null>(null);
  const [timeBasedDayStart, setTimeBasedDayStart] = useState('07:00');
  const [timeBasedNightStart, setTimeBasedNightStart] = useState('19:00');
  const [timeBasedLocationLat, setTimeBasedLocationLat] = useState<number | null>(null);
  const [timeBasedLocationLon, setTimeBasedLocationLon] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  // Listen for navigation state changes to reload data when returning from theme selection
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      // Small delay to ensure data is saved before reloading
      setTimeout(() => {
        loadData();
      }, 300);
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      // Check availability
      const available = await FocusModeService.isAvailable();
      setFocusModeAvailable(available);

      // Load settings
      const themeData = await getThemes();
      if (themeData?.focusModeSettings) {
        setFocusModeEnabled(themeData.focusModeSettings.enabled || false);
        setMappings(themeData.focusModeSettings.mappings || {
          work: null,
          sleep: null,
          personal: null,
          doNotDisturb: null,
        });
      }

      // Load themes list (built-in + custom)
      const builtIn = PRESET_THEMES.map(t => ({
        id: t.id,
        name: t.name,
        background: t.background,
        text: t.text,
        link: t.link,
        backgroundType: t.backgroundType,
        backgroundGradient: t.backgroundGradient,
      }));
      const customThemes = (themeData?.customThemes || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        background: t.background,
        text: t.text,
        link: t.link,
        backgroundType: t.backgroundType,
        backgroundGradient: t.backgroundGradient,
      }));
      setAllThemes([...builtIn, ...customThemes]);

      // Load time-based rule settings
      if (themeData?.timeBasedRule) {
        setTimeBasedEnabled(themeData.timeBasedRule.enabled || false);
        setTimeBasedMode(themeData.timeBasedRule.mode || 'manual');
        setTimeBasedDayTheme(themeData.timeBasedRule.dayTheme || null);
        setTimeBasedNightTheme(themeData.timeBasedRule.nightTheme || null);
        setTimeBasedDayStart(themeData.timeBasedRule.dayStartTime || '07:00');
        setTimeBasedNightStart(themeData.timeBasedRule.nightStartTime || '19:00');
        setTimeBasedLocationLat(themeData.timeBasedRule.locationLat || null);
        setTimeBasedLocationLon(themeData.timeBasedRule.locationLon || null);
      }
    } catch (error) {
      console.error('Error loading Focus Mode data:', error);
    }
  };

  const handleToggleEnabled = useCallback(async (value: boolean) => {
    try {
      await FocusModeService.updateSettings({ enabled: value });
      setFocusModeEnabled(value);

      if (value) {
        Alert.alert(
          'Focus Mode Enabled',
          'To complete setup, you need to add Aura as a Focus Filter in iOS Settings.\n\nGo to: Settings → Focus → [Focus Name] → Focus Filters → Add Filter → Aura',
          [
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
            { text: 'Later', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Error toggling Focus Mode:', error);
      Alert.alert('Error', 'Failed to update Focus Mode setting.');
    }
  }, [navigation]);

  const handleMappingPress = (focusModeKey: string) => {
    navigation.navigate('FocusModePresetSelection', { focusMode: focusModeKey });
  };

  const getThemeName = (themeId: string | null): string => {
    if (!themeId) return 'None';
    const theme = allThemes.find(t => t.id === themeId);
    return theme?.name || themeId;
  };

  const getThemeColors = (themeId: string | null): { background: string; text: string; link: string; backgroundType?: string; backgroundGradient?: string } | null => {
    if (!themeId) return null;
    const theme = allThemes.find(t => t.id === themeId);
    if (theme?.background && theme?.text && theme?.link) {
      return { 
        background: theme.background, 
        text: theme.text, 
        link: theme.link,
        backgroundType: theme.backgroundType,
        backgroundGradient: theme.backgroundGradient,
      };
    }
    return null;
  };

  // Extract gradient colors from gradient string
  const extractGradientColors = (gradient: string): { dark: string; light: string } | null => {
    if (!gradient) return null;
    // Parse linear-gradient(135deg, #001f3f 0%, #b3d9ff 100%)
    const match = gradient.match(/#[0-9a-fA-F]{6}/g);
    if (match && match.length >= 2) {
      return { dark: match[0], light: match[1] };
    }
    return null;
  };

  const getMappedCount = (): number => {
    return Object.values(mappings).filter(v => v !== null).length;
  };

  const toggleRuleDropdown = (ruleKey: string) => {
    const isExpanded = expandedRules[ruleKey] || false;
    setExpandedRules(prev => ({
      ...prev,
      [ruleKey]: !isExpanded,
    }));
  };

  // Save handlers for new rules
  const saveTimeBasedRule = async (updates: Partial<{ enabled: boolean; mode: 'manual' | 'sunset'; dayTheme: string | null; nightTheme: string | null; dayStartTime: string; nightStartTime: string; locationLat: number | null; locationLon: number | null }>) => {
    try {
      const themeData = await getThemes();
      const currentRule = themeData?.timeBasedRule || {
        enabled: false,
        mode: 'manual',
        dayTheme: null,
        nightTheme: null,
        dayStartTime: '07:00',
        nightStartTime: '19:00',
        locationLat: null,
        locationLon: null,
      };
      const updatedData = {
        ...themeData,
        timeBasedRule: {
          ...currentRule,
          ...updates,
        },
      };
      await saveThemes(updatedData);
    } catch (error) {
      console.error('Error saving time-based rule:', error);
      Alert.alert('Error', 'Failed to save time-based rule settings.');
    }
  };

  const handleTimeBasedThemePress = async (type: 'day' | 'night') => {
    // Store the type we're editing so we can save it when returning
    const currentTheme = type === 'day' ? timeBasedDayTheme : timeBasedNightTheme;
    navigation.navigate('FocusModePresetSelection', { 
      focusMode: `timeBased_${type}`,
      currentTheme: currentTheme,
    });
    // We'll handle saving when returning via the navigation listener
  };

  const subtitleColor = textColor === '#FFFFFF' ? '#AAAAAA' : '#666666';
  const isFocusExpanded = expandedRules['focus'] || false;
  const isTimeBasedExpanded = expandedRules['timeBased'] || false;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Rules</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Rules List */}
        <View style={{ marginBottom: 24 }}>
          <Text style={[styles.rulesHeaderTitle, { color: textColor }]}>Automation Rules</Text>
          <Text style={[styles.rulesHeaderDescription, { color: subtitleColor }]}>
            Map Safari themes to iOS Focus modes (configured in iOS Settings) and schedule day/night themes by time
          </Text>

          {/* Focus Rule Dropdown */}
          <View style={[styles.ruleDropdownContainer, { borderColor }]}>
            <TouchableOpacity
              style={[styles.ruleHeader, { backgroundColor: sectionBgColor, borderColor }]}
              onPress={() => toggleRuleDropdown('focus')}
              activeOpacity={0.7}
            >
              <View style={styles.ruleHeaderContent}>
                <Ionicons
                  name="moon-outline"
                  size={24}
                  color={appThemeColor}
                  style={styles.ruleIcon}
                />
                <View style={styles.ruleHeaderText}>
                  <Text style={[styles.ruleTitle, { color: textColor }]}>Focus</Text>
                  <Text style={[styles.ruleSubtitle, { color: subtitleColor }]}>
                    Automatically switch themes with iOS Focus modes
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isFocusExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={appThemeColor}
                style={{ marginLeft: 12 }}
              />
            </TouchableOpacity>

            {isFocusExpanded && (
              <View style={styles.ruleContent}>
                <View style={styles.ruleContentInner}>
                  {/* iOS Version Warning */}
                  {!focusModeAvailable && (
                    <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor, marginBottom: 16 }]}>
                      <Ionicons name="warning-outline" size={20} color="#ff6b6b" style={{ marginRight: 12 }} />
                      <View style={styles.settingContent}>
                        <Text style={[styles.settingLabel, { color: '#ff6b6b' }]}>iOS 16+ Required</Text>
                        <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                          Focus Filters require iOS 16.0 or later. Please update your device to use this feature.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Setup Instructions */}
                  {focusModeAvailable && (
                    <View style={styles.section}>
                      <TouchableOpacity
                        style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}
                        onPress={() => {
                          Alert.alert(
                            'How to Set Up Focus Filters',
                            '1. Open the Settings app on your iPhone\n\n2. Tap "Focus"\n\n3. Select a Focus mode (e.g., Work, Sleep)\n\n4. Scroll down and tap "Focus Filters"\n\n5. Tap "Add Filter"\n\n6. Select "Aura" from the list\n\n7. Choose the theme you want applied\n\n8. Tap "Add"\n\nRepeat for each Focus mode you want to customize. Once configured, Aura will automatically switch themes whenever that Focus mode activates — even when the app is closed.',
                            [
                              { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
                              { text: 'Got It', style: 'cancel' },
                            ]
                          );
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={20} color={appThemeColor} style={{ marginRight: 12 }} />
                        <View style={styles.settingContent}>
                          <Text style={[styles.settingLabel, { color: textColor }]}>Setup Instructions</Text>
                          <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                            Add Aura as a Focus Filter in iOS Settings. Tap for step-by-step instructions.
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={appThemeColor} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Focus Mode Mappings */}
                  {focusModeAvailable && (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: textColor }]}>Theme Mappings</Text>
                      <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
                        Choose which Safari theme to apply for each Focus mode
                      </Text>

                      {FOCUS_MODES.map((mode) => {
                        const mappedThemeId = mappings[mode.key];
                        const themeName = getThemeName(mappedThemeId);
                        const themeColors = getThemeColors(mappedThemeId);
                        const isMapped = mappedThemeId !== null;
                        const isDualTone =
                          (themeColors?.backgroundType === 'gradient' || themeColors?.backgroundType === 'split') &&
                          !!themeColors?.backgroundGradient;
                        const gradientColors = isDualTone ? extractGradientColors(themeColors!.backgroundGradient!) : null;

                        return (
                          <TouchableOpacity
                            key={mode.key}
                            style={[
                              styles.mappingRow,
                              { backgroundColor: sectionBgColor, borderColor },
                              isMapped && { borderColor: appThemeColor, borderWidth: 1.5 },
                            ]}
                            onPress={() => handleMappingPress(mode.key)}
                          >
                            <View style={styles.mappingIconContainer}>
                              <Ionicons
                                name={mode.icon as any}
                                size={24}
                                color={isMapped ? appThemeColor : subtitleColor}
                              />
                            </View>
                            <View style={styles.mappingContent}>
                              <Text style={[styles.mappingLabel, { color: textColor }]}>{mode.label}</Text>
                              <View style={styles.mappingValueRow}>
                                {themeColors ? (
                                  <View style={styles.colorDotsContainer}>
                                    {/* Background dot */}
                                    {isDualTone && gradientColors ? (
                                      <View style={styles.gradientDotContainer}>
                                        <View style={[styles.gradientDotHalf, { 
                                          left: -3,
                                          top: -3,
                                          backgroundColor: themeColors.background,
                                          transform: [{ rotate: '45deg' }],
                                        }]} />
                                        <View style={[styles.gradientDotHalf, { 
                                          right: -3,
                                          bottom: -3,
                                          backgroundColor: gradientColors.light,
                                          transform: [{ rotate: '45deg' }],
                                        }]} />
                                      </View>
                                    ) : (
                                      <View style={[styles.colorDot, { backgroundColor: themeColors.background }]} />
                                    )}
                                    {/* Text dot */}
                                    {isDualTone && gradientColors ? (
                                      <View style={styles.gradientDotContainer}>
                                        <View style={[styles.gradientDotHalf, { 
                                          left: -3,
                                          top: -3,
                                          backgroundColor: themeColors.text,
                                          transform: [{ rotate: '45deg' }],
                                        }]} />
                                        <View style={[styles.gradientDotHalf, { 
                                          right: -3,
                                          bottom: -3,
                                          backgroundColor: themeColors.text === '#ffffff' ? '#cccccc' : '#ffffff',
                                          transform: [{ rotate: '45deg' }],
                                        }]} />
                                      </View>
                                    ) : (
                                      <View style={[styles.colorDot, { backgroundColor: themeColors.text }]} />
                                    )}
                                    {/* Link dot */}
                                    <View style={[styles.colorDot, { backgroundColor: themeColors.link }]} />
                                  </View>
                                ) : null}
                                <Text style={[styles.mappingValue, { color: isMapped && themeColors ? themeColors.text : (isMapped ? appThemeColor : subtitleColor) }]}>
                                  {isMapped ? themeName : 'No theme selected'}
                                </Text>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={isMapped ? appThemeColor : subtitleColor} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                </View>
              </View>
            )}
          </View>

          {/* Time-based Rule Dropdown */}
          <View style={[styles.ruleDropdownContainer, { borderColor, marginTop: 12 }]}>
            <TouchableOpacity
              style={[styles.ruleHeader, { backgroundColor: sectionBgColor, borderColor }]}
              onPress={() => toggleRuleDropdown('timeBased')}
              activeOpacity={0.7}
            >
              <View style={styles.ruleHeaderContent}>
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={appThemeColor}
                  style={styles.ruleIcon}
                />
                <View style={styles.ruleHeaderText}>
                  <Text style={[styles.ruleTitle, { color: textColor }]}>Time-based</Text>
                  <Text style={[styles.ruleSubtitle, { color: subtitleColor }]}>
                    Automatically switch themes based on time of day
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isTimeBasedExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={appThemeColor}
                style={{ marginLeft: 12 }}
              />
            </TouchableOpacity>

            {isTimeBasedExpanded && (
              <View style={styles.ruleContent}>
                <View style={styles.ruleContentInner}>
                  {/* Enabled Toggle */}
                  <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor, marginBottom: 16 }]}>
                    <View style={styles.settingContent}>
                      <Text style={[styles.settingLabel, { color: textColor }]}>Enable Time-based Rule</Text>
                      <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                        Automatically switch between day and night themes
                      </Text>
                    </View>
                    <Switch
                      value={timeBasedEnabled}
                      onValueChange={async (value) => {
                        setTimeBasedEnabled(value);
                        await saveTimeBasedRule({ enabled: value });
                      }}
                      trackColor={{ false: '#767577', true: appThemeColor }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Mode Selection */}
                      <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: textColor }]}>Schedule Mode</Text>
                        <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
                          Choose how to determine when themes switch
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                          <TouchableOpacity
                            style={[
                              { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
                              { backgroundColor: sectionBgColor, borderColor: timeBasedMode === 'manual' ? appThemeColor : borderColor },
                            ]}
                            onPress={async () => {
                              setTimeBasedMode('manual');
                              await saveTimeBasedRule({ mode: 'manual' });
                            }}
                          >
                            <Ionicons name="time-outline" size={24} color={timeBasedMode === 'manual' ? appThemeColor : subtitleColor} />
                            <Text style={[styles.settingLabel, { color: timeBasedMode === 'manual' ? appThemeColor : textColor, marginTop: 8, marginBottom: 0 }]}>
                              Manual
                            </Text>
                            <Text style={[styles.settingDescription, { color: subtitleColor, fontSize: 12, textAlign: 'center' }]}>
                              Set custom times
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
                              { backgroundColor: sectionBgColor, borderColor: timeBasedMode === 'sunset' ? appThemeColor : borderColor },
                            ]}
                            onPress={async () => {
                              setTimeBasedMode('sunset');
                              await saveTimeBasedRule({ mode: 'sunset' });
                            }}
                          >
                            <Ionicons name="sunny-outline" size={24} color={timeBasedMode === 'sunset' ? appThemeColor : subtitleColor} />
                            <Text style={[styles.settingLabel, { color: timeBasedMode === 'sunset' ? appThemeColor : textColor, marginTop: 8, marginBottom: 0 }]}>
                              Sunset/Sunrise
                            </Text>
                            <Text style={[styles.settingDescription, { color: subtitleColor, fontSize: 12, textAlign: 'center' }]}>
                              Based on location
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Day Theme */}
                      <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: textColor }]}>Day Theme</Text>
                        <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
                          Theme applied during daytime hours
                        </Text>
                        <TouchableOpacity
                          style={[styles.mappingRow, { backgroundColor: sectionBgColor, borderColor }]}
                          onPress={() => handleTimeBasedThemePress('day')}
                        >
                          <View style={styles.mappingIconContainer}>
                            <Ionicons name="sunny-outline" size={24} color={timeBasedDayTheme ? appThemeColor : subtitleColor} />
                          </View>
                          <View style={styles.mappingContent}>
                            <Text style={[styles.mappingLabel, { color: textColor }]}>Day Theme</Text>
                            <Text style={[styles.mappingValue, { color: timeBasedDayTheme ? appThemeColor : subtitleColor }]}>
                              {getThemeName(timeBasedDayTheme)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={timeBasedDayTheme ? appThemeColor : subtitleColor} />
                        </TouchableOpacity>
                      </View>

                      {/* Night Theme */}
                      <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: textColor }]}>Night Theme</Text>
                        <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
                          Theme applied during nighttime hours
                        </Text>
                        <TouchableOpacity
                          style={[styles.mappingRow, { backgroundColor: sectionBgColor, borderColor }]}
                          onPress={() => handleTimeBasedThemePress('night')}
                        >
                          <View style={styles.mappingIconContainer}>
                            <Ionicons name="moon-outline" size={24} color={timeBasedNightTheme ? appThemeColor : subtitleColor} />
                          </View>
                          <View style={styles.mappingContent}>
                            <Text style={[styles.mappingLabel, { color: textColor }]}>Night Theme</Text>
                            <Text style={[styles.mappingValue, { color: timeBasedNightTheme ? appThemeColor : subtitleColor }]}>
                              {getThemeName(timeBasedNightTheme)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={timeBasedNightTheme ? appThemeColor : subtitleColor} />
                        </TouchableOpacity>
                      </View>

                      {/* Manual Time Settings */}
                      {timeBasedMode === 'manual' && (
                        <View style={styles.section}>
                          <Text style={[styles.sectionTitle, { color: textColor }]}>Schedule</Text>
                          <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
                            Set when day and night themes switch
                          </Text>
                          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor, marginBottom: 8 }]}>
                            <View style={styles.settingContent}>
                              <Text style={[styles.settingLabel, { color: textColor }]}>Day Starts</Text>
                              <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                                {timeBasedDayStart}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                Alert.prompt(
                                  'Day Start Time',
                                  'Enter time in HH:MM format (24-hour)',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'OK',
                                      onPress: async (time) => {
                                        if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                                          setTimeBasedDayStart(time);
                                          await saveTimeBasedRule({ dayStartTime: time });
                                        } else {
                                          Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g., 07:00)');
                                        }
                                      },
                                    },
                                  ],
                                  'plain-text',
                                  timeBasedDayStart
                                );
                              }}
                            >
                              <Ionicons name="time-outline" size={20} color={appThemeColor} />
                            </TouchableOpacity>
                          </View>
                          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
                            <View style={styles.settingContent}>
                              <Text style={[styles.settingLabel, { color: textColor }]}>Night Starts</Text>
                              <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                                {timeBasedNightStart}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                Alert.prompt(
                                  'Night Start Time',
                                  'Enter time in HH:MM format (24-hour)',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'OK',
                                      onPress: async (time) => {
                                        if (time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                                          setTimeBasedNightStart(time);
                                          await saveTimeBasedRule({ nightStartTime: time });
                                        } else {
                                          Alert.alert('Invalid Time', 'Please enter time in HH:MM format (e.g., 19:00)');
                                        }
                                      },
                                    },
                                  ],
                                  'plain-text',
                                  timeBasedNightStart
                                );
                              }}
                            >
                              <Ionicons name="time-outline" size={20} color={appThemeColor} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Sunset/Sunrise Location Settings */}
                      {timeBasedMode === 'sunset' && (
                        <View style={styles.section}>
                          <Text style={[styles.sectionTitle, { color: textColor }]}>Location</Text>
                          <Text style={[styles.sectionDescription, { color: subtitleColor }]}>
                            Set your location to calculate sunrise and sunset times
                          </Text>
                          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor, marginBottom: 8 }]}>
                            <View style={styles.settingContent}>
                              <Text style={[styles.settingLabel, { color: textColor }]}>Latitude</Text>
                              <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                                {timeBasedLocationLat !== null ? timeBasedLocationLat.toFixed(4) : 'Not set'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                Alert.prompt(
                                  'Latitude',
                                  'Enter latitude (-90 to 90)',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'OK',
                                      onPress: async (latStr) => {
                                        const lat = parseFloat(latStr || '0');
                                        if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                                          setTimeBasedLocationLat(lat);
                                          await saveTimeBasedRule({ locationLat: lat });
                                        } else {
                                          Alert.alert('Invalid Latitude', 'Please enter a number between -90 and 90');
                                        }
                                      },
                                    },
                                  ],
                                  'plain-text',
                                  timeBasedLocationLat !== null ? timeBasedLocationLat.toString() : ''
                                );
                              }}
                            >
                              <Ionicons name="location-outline" size={20} color={appThemeColor} />
                            </TouchableOpacity>
                          </View>
                          <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor }]}>
                            <View style={styles.settingContent}>
                              <Text style={[styles.settingLabel, { color: textColor }]}>Longitude</Text>
                              <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                                {timeBasedLocationLon !== null ? timeBasedLocationLon.toFixed(4) : 'Not set'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                Alert.prompt(
                                  'Longitude',
                                  'Enter longitude (-180 to 180)',
                                  [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                      text: 'OK',
                                      onPress: async (lonStr) => {
                                        const lon = parseFloat(lonStr || '0');
                                        if (!isNaN(lon) && lon >= -180 && lon <= 180) {
                                          setTimeBasedLocationLon(lon);
                                          // Calculate and persist today's sunrise/sunset as boundary
                                          // times so the Safari extension only needs HH:MM comparison.
                                          if (timeBasedLocationLat !== null) {
                                            const { sunrise, sunset } = calculateSunriseSunset(new Date(), { latitude: timeBasedLocationLat, longitude: lon });
                                            const dayStart = formatTime(sunrise);
                                            const nightStart = formatTime(sunset);
                                            setTimeBasedDayStart(dayStart);
                                            setTimeBasedNightStart(nightStart);
                                            await saveTimeBasedRule({
                                              locationLon: lon,
                                              dayStartTime: dayStart,
                                              nightStartTime: nightStart,
                                            });
                                            Alert.alert(
                                              'Sunrise & Sunset',
                                              `Today's sunrise: ${dayStart}\nToday's sunset: ${nightStart}`
                                            );
                                          } else {
                                            await saveTimeBasedRule({ locationLon: lon });
                                          }
                                        } else {
                                          Alert.alert('Invalid Longitude', 'Please enter a number between -180 and 180');
                                        }
                                      },
                                    },
                                  ],
                                  'plain-text',
                                  timeBasedLocationLon !== null ? timeBasedLocationLon.toString() : ''
                                );
                              }}
                            >
                              <Ionicons name="location-outline" size={20} color={appThemeColor} />
                            </TouchableOpacity>
                          </View>
                          {timeBasedLocationLat !== null && timeBasedLocationLon !== null && (
                            <View style={[styles.settingRow, { backgroundColor: sectionBgColor, borderColor, marginTop: 8 }]}>
                              <View style={styles.settingContent}>
                                <Text style={[styles.settingLabel, { color: textColor }]}>Today's Schedule</Text>
                                <Text style={[styles.settingDescription, { color: subtitleColor }]}>
                                  {(() => {
                                    const { sunrise, sunset } = calculateSunriseSunset(new Date(), { latitude: timeBasedLocationLat!, longitude: timeBasedLocationLon! });
                                    return `Sunrise: ${formatTime(sunrise)}, Sunset: ${formatTime(sunset)}`;
                                  })()}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      )}
                </View>
              </View>
            )}
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
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 20,
    gap: 12,
  },
  premiumBannerText: {
    flex: 1,
  },
  premiumBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  premiumBannerDescription: {
    fontSize: 13,
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
  rulesHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  rulesHeaderDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
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
  setupBanner: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 24,
  },
  setupBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setupBannerText: {
    flex: 1,
  },
  setupBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  setupBannerDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  mappingIconContainer: {
    width: 36,
    alignItems: 'center',
    marginRight: 12,
  },
  mappingContent: {
    flex: 1,
    marginRight: 12,
  },
  mappingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  mappingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mappingValue: {
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
  gradientDotContainer: {
    width: 12,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
    position: 'relative',
  },
  gradientDotHalf: {
    position: 'absolute',
    width: 18,
    height: 18,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
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
    color: '#4CAF50',
    fontWeight: '600',
  },
  siteStatusDisabled: {
    fontSize: 12,
    color: '#FF4444',
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
    marginTop: 8,
  },
  addSiteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ruleDropdownContainer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  ruleHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ruleIcon: {
    marginRight: 12,
  },
  ruleHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  ruleTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  ruleSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  ruleContent: {
    overflow: 'hidden',
  },
  ruleContentInner: {
    padding: 16,
    paddingTop: 8,
  },
});

export default FocusModeScreen;
