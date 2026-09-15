import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { getThemes, saveThemes } from '../storage';
import FocusModeService from '../services/FocusModeService';
import { PRESET_THEMES } from './BrowseThemesScreen';
import { useAppTheme } from '../contexts/AppThemeContext';

interface FocusModeThemeSelectionScreenProps {
  navigation: any;
  route: {
    params?: {
      focusMode?: string;
    };
  };
}

interface ThemeOption {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  isCustom?: boolean;
  backgroundType?: string;
  backgroundGradient?: string;
}

const FocusModeThemeSelectionScreen: React.FC<FocusModeThemeSelectionScreenProps> = ({
  navigation,
  route,
}) => {
  const focusMode = route.params?.focusMode || 'work';
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [allThemes, setAllThemes] = useState<ThemeOption[]>([]);

  useEffect(() => {
    loadCurrentMapping();
    loadAllThemes();
  }, []);

  const loadCurrentMapping = async () => {
    try {
      const themeData = await getThemes();
      
      // Handle time-based rule
      if (focusMode.startsWith('timeBased_')) {
        const type = focusMode.replace('timeBased_', '') as 'day' | 'night';
        const rule = themeData?.timeBasedRule;
        if (rule) {
          setSelectedTheme(type === 'day' ? rule.dayTheme : rule.nightTheme);
        }
        return;
      }

      // Handle focus mode mappings (original behavior)
      const mappings = themeData?.focusModeSettings?.mappings;
      if (mappings) {
        setSelectedTheme(mappings[focusMode as keyof typeof mappings] || null);
      }
    } catch (error) {
      console.error('Error loading theme mapping:', error);
    }
  };

  const loadAllThemes = async () => {
    try {
      // Start with built-in themes
      const builtIn: ThemeOption[] = PRESET_THEMES.map(t => ({
        id: t.id,
        name: t.name,
        background: t.background,
        text: t.text,
        link: t.link,
        backgroundType: t.backgroundType,
        backgroundGradient: t.backgroundGradient,
      }));

      // Load custom themes from storage
      const themeData = await getThemes();
      const customThemes: ThemeOption[] = (themeData?.customThemes || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        background: t.background || '#000000',
        text: t.text || '#ffffff',
        link: t.link || '#0066cc',
        isCustom: true,
        backgroundType: t.backgroundType,
        backgroundGradient: t.backgroundGradient,
      }));

      setAllThemes([...builtIn, ...customThemes]);
    } catch (error) {
      console.error('Error loading themes:', error);
      // Fall back to built-in only
      setAllThemes(PRESET_THEMES.map(t => ({
        id: t.id,
        name: t.name,
        background: t.background,
        text: t.text,
        link: t.link,
        backgroundType: t.backgroundType,
        backgroundGradient: t.backgroundGradient,
      })));
    }
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

  const handleSelectTheme = async (themeId: string | null) => {
    try {
      const themeData = await getThemes();
      const themeName = themeId ? allThemes.find(t => t.id === themeId)?.name || themeId : null;

      // Handle time-based rule
      if (focusMode.startsWith('timeBased_')) {
        const type = focusMode.replace('timeBased_', '') as 'day' | 'night';
        const currentRule = themeData?.timeBasedRule || {
          enabled: false,
          dayTheme: null,
          nightTheme: null,
          dayThemeColors: null,
          nightThemeColors: null,
          dayStartTime: '07:00',
          nightStartTime: '19:00',
        };
        const selected = themeId ? allThemes.find(t => t.id === themeId) : null;
        const colors = selected
          ? {
              enabled: true,
              background: selected.background,
              text: selected.text,
              link: selected.link,
              backgroundType: selected.backgroundType || 'color',
              backgroundGradient: selected.backgroundGradient || null,
              backgroundImage: null,
            }
          : null;
        const updatedRule = {
          ...currentRule,
          [type === 'day' ? 'dayTheme' : 'nightTheme']: themeId,
          [type === 'day' ? 'dayThemeColors' : 'nightThemeColors']: colors,
        };
        const updatedData = {
          ...themeData,
          timeBasedRule: updatedRule,
        };
        await saveThemes(updatedData);
        Alert.alert('Saved', `Theme ${themeName ? `"${themeName}"` : 'removed'} set for ${type === 'day' ? 'day' : 'night'} theme.`);
        navigation.goBack();
        return;
      }

      // Handle focus mode mappings (original behavior)
      const currentMappings = themeData?.focusModeSettings?.mappings || {
        work: null,
        sleep: null,
        personal: null,
        doNotDisturb: null,
      };

      const newMappings = {
        ...currentMappings,
        [focusMode]: themeId,
      };

      await FocusModeService.updateSettings({
        mappings: newMappings,
      });

      setSelectedTheme(themeId);
      Alert.alert('Saved', `Theme ${themeName ? `"${themeName}"` : 'removed'} mapped to ${focusModeNames[focusMode] || focusMode} Focus.`);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving theme mapping:', error);
      Alert.alert('Error', 'Failed to save mapping. Please try again.');
    }
  };

  const focusModeNames: { [key: string]: string } = {
    work: 'Work',
    sleep: 'Sleep',
    personal: 'Personal',
    doNotDisturb: 'Do Not Disturb',
  };

  const subtitleColor = textColor === '#FFFFFF' ? '#888888' : '#666666';

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
          {focusMode.startsWith('timeBased_') 
            ? `${focusMode.replace('timeBased_', '').charAt(0).toUpperCase() + focusMode.replace('timeBased_', '').slice(1)} Theme`
            : `${focusModeNames[focusMode] || focusMode} Focus`}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.description, { color: subtitleColor }]}>
          {focusMode.startsWith('timeBased_')
            ? `Select a Safari theme for ${focusMode.replace('timeBased_', '')}time.`
            : `Select a Safari theme to apply when ${focusModeNames[focusMode] || focusMode} Focus is active.`}
        </Text>

        <TouchableOpacity
          style={[
            styles.themeOption,
            { backgroundColor: sectionBgColor, borderColor },
            selectedTheme === null && { borderColor: appThemeColor, borderWidth: 2 },
          ]}
          onPress={() => handleSelectTheme(null)}
        >
          <View style={styles.themeOptionContent}>
            <Text style={[styles.themeOptionText, { color: textColor }]}>None (No auto-apply)</Text>
          </View>
          {selectedTheme === null && <Text style={[styles.checkmark, { color: appThemeColor }]}>✓</Text>}
        </TouchableOpacity>

        {/* Built-in Themes */}
        {allThemes.filter(t => !t.isCustom).length > 0 && (
          <Text style={[styles.sectionLabel, { color: subtitleColor }]}>Safari Themes</Text>
        )}
        {allThemes.filter(t => !t.isCustom).map((theme) => {
          const isDualTone =
            (theme.backgroundType === 'gradient' || theme.backgroundType === 'split') &&
            !!theme.backgroundGradient;
          const gradientColors = isDualTone ? extractGradientColors(theme.backgroundGradient!) : null;
          
          return (
            <TouchableOpacity
              key={theme.id}
              style={[
                styles.themeOption,
                { backgroundColor: sectionBgColor, borderColor },
                selectedTheme === theme.id && { borderColor: appThemeColor, borderWidth: 2 },
              ]}
              onPress={() => handleSelectTheme(theme.id)}
            >
              <View style={styles.themeOptionContent}>
                <View style={styles.colorDotsContainer}>
                  {/* Background dot */}
                  {isDualTone && gradientColors ? (
                    <View style={styles.gradientDotContainer}>
                      <View style={[styles.gradientDotHalf, { 
                        left: -3,
                        top: -3,
                        backgroundColor: theme.background,
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
                    <View style={[styles.colorDot, { backgroundColor: theme.background }]} />
                  )}
                  {/* Text dot */}
                  {isDualTone && gradientColors ? (
                    <View style={styles.gradientDotContainer}>
                      <View style={[styles.gradientDotHalf, { 
                        left: -3,
                        top: -3,
                        backgroundColor: theme.text,
                        transform: [{ rotate: '45deg' }],
                      }]} />
                      <View style={[styles.gradientDotHalf, { 
                        right: -3,
                        bottom: -3,
                        backgroundColor: theme.text === '#ffffff' ? '#cccccc' : '#ffffff',
                        transform: [{ rotate: '45deg' }],
                      }]} />
                    </View>
                  ) : (
                    <View style={[styles.colorDot, { backgroundColor: theme.text }]} />
                  )}
                  {/* Link dot */}
                  <View style={[styles.colorDot, { backgroundColor: theme.link }]} />
                </View>
                <View style={styles.themeTextContent}>
                  <Text style={[styles.themeOptionText, { color: theme.text }]}>{theme.name}</Text>
                </View>
              </View>
              {selectedTheme === theme.id && <Text style={[styles.checkmark, { color: appThemeColor }]}>✓</Text>}
            </TouchableOpacity>
          );
        })}

        {/* Custom Themes */}
        {allThemes.filter(t => t.isCustom).length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: subtitleColor }]}>Your Custom Themes</Text>
            {allThemes.filter(t => t.isCustom).map((theme) => {
              const isDualTone =
                (theme.backgroundType === 'gradient' || theme.backgroundType === 'split') &&
                !!theme.backgroundGradient;
              const gradientColors = isDualTone ? extractGradientColors(theme.backgroundGradient!) : null;
              
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.themeOption,
                    { backgroundColor: sectionBgColor, borderColor },
                    selectedTheme === theme.id && { borderColor: appThemeColor, borderWidth: 2 },
                  ]}
                  onPress={() => handleSelectTheme(theme.id)}
                >
                  <View style={styles.themeOptionContent}>
                    <View style={styles.colorDotsContainer}>
                      {/* Background dot */}
                      {isDualTone && gradientColors ? (
                        <View style={styles.gradientDotContainer}>
                          <View style={[styles.gradientDotHalf, { 
                            left: -3,
                            top: -3,
                            backgroundColor: theme.background,
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
                        <View style={[styles.colorDot, { backgroundColor: theme.background }]} />
                      )}
                      {/* Text dot */}
                      {isDualTone && gradientColors ? (
                        <View style={styles.gradientDotContainer}>
                          <View style={[styles.gradientDotHalf, { 
                            left: -3,
                            top: -3,
                            backgroundColor: theme.text,
                            transform: [{ rotate: '45deg' }],
                          }]} />
                          <View style={[styles.gradientDotHalf, { 
                            right: -3,
                            bottom: -3,
                            backgroundColor: theme.text === '#ffffff' ? '#cccccc' : '#ffffff',
                            transform: [{ rotate: '45deg' }],
                          }]} />
                        </View>
                      ) : (
                        <View style={[styles.colorDot, { backgroundColor: theme.text }]} />
                      )}
                      {/* Link dot */}
                      <View style={[styles.colorDot, { backgroundColor: theme.link }]} />
                    </View>
                    <View style={styles.themeTextContent}>
                      <Text style={[styles.themeOptionText, { color: theme.text }]}>{theme.name}</Text>
                    </View>
                  </View>
                  {selectedTheme === theme.id && <Text style={[styles.checkmark, { color: appThemeColor }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </>
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
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
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
  description: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
  },
  themeOption: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  themeOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
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
  themeTextContent: {
    flex: 1,
  },
  themeOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeOptionSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default FocusModeThemeSelectionScreen;
