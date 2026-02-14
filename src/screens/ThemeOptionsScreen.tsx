import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ThemeOptionsScreenProps {
  navigation: any;
}

interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  backgroundType?: 'color' | 'gradient';
  backgroundGradient?: string;
}

// Popular themes for quick access
const POPULAR_THEMES: Theme[] = [
  {
    id: 'dark',
    name: 'Dark Mode',
    background: '#000000',
    text: '#ffffff',
    link: '#1E90FF',
  },
  {
    id: 'light',
    name: 'Light Mode',
    background: '#ffffff',
    text: '#000000',
    link: '#0066cc',
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    background: '#000000', // Base color (black side)
    text: '#000000', // Black text (visible on white side)
    link: '#0066cc', // Blue links (standard web blue)
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(to bottom left, #000000 0%, #ffffff 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#1a3d1a',
    text: '#c8e6c9',
    link: '#81c784',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#001f3f',
    text: '#b3d9ff',
    link: '#4da6ff',
  },
];

const ThemeOptionsScreen: React.FC<ThemeOptionsScreenProps> = ({ navigation }) => {
  const { appThemeColor } = useAppTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentTheme();
  }, []);

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.globalTheme) {
        const current = themeData.globalTheme;
        const matchingTheme = POPULAR_THEMES.find(
          (theme) => {
            // Match by background type and gradient if present
            if (current.backgroundType === 'gradient' && theme.backgroundType === 'gradient') {
              return current.backgroundGradient === theme.backgroundGradient &&
                     theme.text === current.text &&
                     theme.link === current.link;
            } else {
              return theme.background === current.background &&
                     theme.text === current.text &&
                     theme.link === current.link;
            }
          }
        );
        if (matchingTheme) {
          setSelectedThemeId(matchingTheme.id);
        }
      }
    } catch (error) {
      console.error('Error loading current theme:', error);
    }
  };

  const handleApplyTheme = async (theme: Theme) => {
    try {
      const currentData = await getThemes();
      const newThemeData = {
        ...currentData,
        globalTheme: {
          enabled: currentData?.globalTheme?.enabled ?? true,
          background: theme.background,
          text: theme.text,
          link: theme.link,
          backgroundType: (theme.backgroundType || 'color') as 'color' | 'gradient',
          backgroundImage: null,
          backgroundGradient: theme.backgroundGradient || null,
        },
      };

      await saveThemes(newThemeData);
      setSelectedThemeId(theme.id);
      Alert.alert('Theme Applied', `${theme.name} theme has been applied to Safari.`);
    } catch (error) {
      console.error('Error applying theme:', error);
      Alert.alert('Error', 'Failed to apply theme. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safari Themes</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Top Section: Popular Themes */}
        <View style={styles.topSection}>
          <Text style={styles.sectionTitle}>Popular Themes</Text>
          
          <View style={styles.themesGrid}>
            {POPULAR_THEMES.map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[
                    styles.themeButton,
                    isSelected && [styles.themeButtonSelected, { borderColor: appThemeColor }],
                  ]}
                  onPress={() => handleApplyTheme(theme)}
                >
                  <View
                    style={[
                      styles.themePreview,
                      isSelected && styles.themePreviewSelected,
                      { backgroundColor: theme.background },
                    ]}
                  >
                    <Text style={[styles.themePreviewText, { color: theme.text }]}>
                      Aa
                    </Text>
                  </View>
                  <Text style={styles.themeName}>{theme.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.moreThemesButton}
            onPress={() => navigation.navigate('BrowseThemes')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.moreThemesButtonText, { color: appThemeColor }]}>More themes </Text>
              <Ionicons name="chevron-forward" size={20} color={appThemeColor} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom Section: Customize Theme - positioned at midpoint */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.customizeButton}
            onPress={() => navigation.navigate('CustomTheme')}
          >
            <View style={styles.customizeButtonContent}>
              <Text style={styles.customizeButtonIcon}>✏️</Text>
              <View style={styles.customizeButtonTextContainer}>
                <Text style={styles.customizeButtonTitle}>Customize Theme</Text>
                <Text style={styles.customizeButtonDescription}>
                  Create your own custom theme with your favorite colors
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#228B22" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    padding: 20,
  },
  topSection: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#228B22',
    marginBottom: 16,
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    marginHorizontal: -4,
  },
  themeButton: {
    width: '31%',
    aspectRatio: 1,
    marginBottom: 20,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  themeButtonSelected: {
    opacity: 1,
  },
  themePreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#333',
  },
  themePreviewSelected: {
    borderColor: '#228B22',
    borderWidth: 3,
  },
  themePreviewText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  themeName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  moreThemesButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
  },
  moreThemesButtonText: {
    color: '#228B22',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'center',
  },
  customizeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#333',
  },
  customizeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customizeButtonIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  customizeButtonTextContainer: {
    flex: 1,
  },
  customizeButtonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  customizeButtonDescription: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 20,
  },
  customizeButtonArrow: {
    // Style no longer used - replaced with Ionicons
    marginLeft: 12,
  },
});

export default ThemeOptionsScreen;
