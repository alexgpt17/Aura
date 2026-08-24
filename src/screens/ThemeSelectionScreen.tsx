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
import { PRESET_THEMES, THEME_SECTIONS } from './BrowseThemesScreen';
import { ThemeListRow } from '../components/ThemeSwatch';

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
        {customThemes.length > 0 && (
          <>
            <Text style={[styles.librarySectionHeader, { color: textColor }]}>CUSTOM THEMES</Text>
            <View style={[styles.themesGroup, { backgroundColor: sectionBgColor }]}>
              {customThemes.map(theme => (
                <ThemeListRow
                  key={theme.id}
                  theme={theme}
                  selected={selectedThemeId === theme.id}
                  accentColor={appThemeColor}
                  textColor={textColor}
                  surfaceColor={sectionBgColor}
                  onPress={() => handleSelectTheme(theme)}
                />
              ))}
            </View>
          </>
        )}
        {THEME_SECTIONS.map(section => {
          const themes = PRESET_THEMES.filter(t => t.category === section.id);
          if (themes.length === 0) return null;
          return (
            <React.Fragment key={section.id}>
              <Text style={[styles.librarySectionHeader, { color: textColor }]}>{section.title}</Text>
              <View style={[styles.themesGroup, { backgroundColor: sectionBgColor }]}>
                {themes.map(theme => (
                  <ThemeListRow
                    key={theme.id}
                    theme={theme}
                    selected={selectedThemeId === theme.id}
                    accentColor={appThemeColor}
                    textColor={textColor}
                    surfaceColor={sectionBgColor}
                    onPress={() => handleSelectTheme(theme)}
                  />
                ))}
              </View>
            </React.Fragment>
          );
        })}
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
  librarySectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.45,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  themesGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  themesList: {
    gap: 0,
  },
});

export default ThemeSelectionScreen;
