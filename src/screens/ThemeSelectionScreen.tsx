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
import { useAppTheme } from '../contexts/AppThemeContext';
import { PRESET_THEMES } from './BrowseThemesScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ThemeSelectionScreenProps {
  navigation: any;
  route: {
    params?: {
      forWebsite?: string;
    };
  };
}

interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  preview?: {
    background: string;
    text: string;
    link: string;
  };
  backgroundType?: 'color' | 'gradient' | 'split';
  backgroundGradient?: string;
}

const ThemeSelectionScreen: React.FC<ThemeSelectionScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const forWebsite = route?.params?.forWebsite;

  useEffect(() => {
    loadCurrentTheme();
  }, []);

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      const customs: Theme[] = (themeData?.customThemes || []).map((t: any) => ({
        id: t.id,
        name: t.name || 'Custom',
        background: t.background || '#000000',
        text: t.text || '#ffffff',
        link: t.link || '#0066cc',
        backgroundType: t.backgroundType || 'color',
        backgroundGradient: t.backgroundGradient || undefined,
      }));
      setCustomThemes(customs);

      let current;
      
      if (forWebsite) {
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        current = themeData?.siteThemes?.[cleanHostname] || themeData?.globalTheme;
      } else {
        current = themeData?.globalTheme;
      }
      
      if (current) {
        const allThemes = [...PRESET_THEMES, ...customs];
        const matching = allThemes.find(
          (preset) => {
            if (current.id && preset.id === current.id) return true;
            const dual = (t: string | undefined) => t === 'gradient' || t === 'split';
            if (dual(current.backgroundType) && dual(preset.backgroundType)) {
              return current.backgroundGradient === preset.backgroundGradient &&
                     preset.text === current.text &&
                     preset.link === current.link;
            }
            return preset.background === current.background &&
                   preset.text === current.text &&
                   preset.link === current.link;
          }
        );
        setSelectedThemeId(matching ? matching.id : null);
      } else {
        setSelectedThemeId(null);
      }
    } catch (error) {
      console.error('Error loading current theme:', error);
      setSelectedThemeId(null);
    }
  };

  const handleSelectTheme = async (theme: Theme) => {
    try {
      const currentData = await getThemes();
      
      // Check if this theme is already selected - if so, deselect it
      const isCurrentlySelected = selectedThemeId === theme.id;
      
      if (isCurrentlySelected && !forWebsite) {
        // Deselect the theme
        const newThemeData = {
          ...currentData,
          globalTheme: null,
        };
        await saveThemes(newThemeData);
        setSelectedThemeId(null);
        Alert.alert('Theme Cleared', 'The current theme has been cleared.');
        navigation.goBack();
        return;
      }
      
      const completeTheme = {
        enabled: true,
        id: theme.id,
        background: theme.background,
        text: theme.text,
        link: theme.link,
        backgroundType: (theme.backgroundType || 'color') as 'color' | 'gradient' | 'split',
        backgroundImage: null,
        backgroundGradient: theme.backgroundGradient || null,
      };

      if (forWebsite) {
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        
        // Check if website theme is already selected
        if (isCurrentlySelected) {
          // Remove website-specific theme
          const newSiteThemes = { ...(currentData?.siteThemes || {}) };
          delete newSiteThemes[cleanHostname];
          const newThemeData = {
            ...currentData,
            siteThemes: newSiteThemes,
          };
          await saveThemes(newThemeData);
          Alert.alert('Theme Cleared', 'The theme for this website has been cleared.');
          navigation.goBack();
          return;
        }
        
        const newSiteThemes = {
          ...(currentData?.siteThemes || {}),
          [cleanHostname]: {
            ...completeTheme,
            enabled: currentData?.siteThemes?.[cleanHostname]?.enabled ?? true,
          },
        };
        const newThemeData = {
          ...currentData,
          siteThemes: newSiteThemes,
        };
        await saveThemes(newThemeData);
        Alert.alert('Theme Applied', `${theme.name} theme has been applied to ${cleanHostname}.`);
        navigation.goBack();
      } else {
        const newThemeData = {
          ...currentData,
          globalTheme: {
            ...completeTheme,
            enabled: currentData?.globalTheme?.enabled ?? true,
          },
        };
        await saveThemes(newThemeData);
        setSelectedThemeId(theme.id);
        Alert.alert('Theme Applied', `${theme.name} theme has been applied.`);
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error applying theme:', error);
      Alert.alert('Error', 'Failed to apply theme. Please try again.');
    }
  };

  // Extract gradient colors from gradient string
  const extractGradientColors = (gradient: string): { dark: string; light: string } | null => {
    if (!gradient) return null;
    const match = gradient.match(/#[0-9a-fA-F]{6}/g);
    if (match && match.length >= 2) {
      return { dark: match[0], light: match[1] };
    }
    return null;
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
        <Text style={[styles.headerTitle, { color: textColor }]}>Select Theme</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.themesList}>
          {customThemes.length > 0 && (
            <Text style={[styles.sectionLabel, { color: textColor === '#FFFFFF' ? '#888888' : '#666666' }]}>
              Custom Themes
            </Text>
          )}
          {[...customThemes, ...PRESET_THEMES].map((theme, index) => {
            // Insert a section label before the first preset when customs exist
            const showPresetLabel = customThemes.length > 0 && index === customThemes.length;
            const isSelected = selectedThemeId === theme.id;
            const isDualTone =
              (theme.backgroundType === 'gradient' || theme.backgroundType === 'split') &&
              !!theme.backgroundGradient;
            const gradientColors = isDualTone ? extractGradientColors(theme.backgroundGradient!) : null;

            return (
              <React.Fragment key={theme.id}>
                {showPresetLabel && (
                  <Text style={[styles.sectionLabel, { color: textColor === '#FFFFFF' ? '#888888' : '#666666' }]}>
                    Safari Themes
                  </Text>
                )}
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  { backgroundColor: sectionBgColor, borderColor },
                  isSelected && { borderColor: appThemeColor, borderWidth: 2 },
                ]}
                onPress={() => handleSelectTheme(theme)}
              >
                <View style={styles.themeButtonContent}>
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
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: textColor },
                      isSelected && { color: appThemeColor, fontWeight: '600' },
                    ]}
                  >
                    {theme.name}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={appThemeColor} />
                )}
              </TouchableOpacity>
              </React.Fragment>
            );
          })}
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
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  themesList: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 12,
    alignItems: 'center',
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  gradientDotContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
    position: 'relative',
  },
  gradientDotHalf: {
    position: 'absolute',
    width: 14,
    height: 14,
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ThemeSelectionScreen;
