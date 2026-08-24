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
import { ThemeListRow } from '../components/ThemeSwatch';

interface CustomThemesListScreenProps {
  navigation: any;
}

interface CustomTheme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  type?: 'safari';
  backgroundType?: 'color' | 'gradient' | 'split';
  backgroundGradient?: string | null;
}

const MAX_CUSTOM_THEMES = 5;

const CustomThemesListScreen: React.FC<CustomThemesListScreenProps> = ({ navigation }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomThemes();
    loadCurrentTheme();
  }, []);

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCustomThemes();
      loadCurrentTheme();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCustomThemes = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.customThemes) {
        const allThemes = themeData.customThemes || [];
        setCustomThemes(allThemes);
      }
    } catch (error) {
      console.error('Error loading custom themes:', error);
    }
  };

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      const current = themeData?.globalTheme;
      if (current) {
        const loadedCustomThemes = themeData?.customThemes || [];
        // Check if current theme matches any custom theme
        const matchingCustom = loadedCustomThemes.find(
          (theme: CustomTheme) =>
            theme.background === current.background &&
            theme.text === current.text &&
            theme.link === current.link
        );
        if (matchingCustom) {
          setSelectedThemeId(matchingCustom.id);
        } else {
          setSelectedThemeId(null);
        }
      } else {
        setSelectedThemeId(null);
      }
    } catch (error) {
      console.error('Error loading current theme:', error);
      setSelectedThemeId(null);
    }
  };

  const handleSelectTheme = async (theme: CustomTheme) => {
    try {
      const currentData = await getThemes();
      
      // Check if this theme is already selected - if so, deselect it
      const isCurrentlySelected = selectedThemeId === theme.id;
      
      if (isCurrentlySelected) {
        // Deselect the theme
        const newThemeData = {
          ...currentData,
          globalTheme: null,
        };
        await saveThemes(newThemeData);
        setSelectedThemeId(null);
        Alert.alert('Theme Cleared', 'The current theme has been cleared.');
        return;
      }
      
      const newThemeData = {
        ...currentData,
        globalTheme: {
          enabled: currentData?.globalTheme?.enabled ?? true,
          id: theme.id,
          name: theme.name,
          background: theme.background,
          text: theme.text,
          link: theme.link,
          backgroundType: theme.backgroundType || 'color',
          backgroundGradient: theme.backgroundGradient || null,
          backgroundImage: null,
        },
      };
      await saveThemes(newThemeData);
      Alert.alert('Theme Applied', `${theme.name} theme has been applied to Safari.`);
      setSelectedThemeId(theme.id);
    } catch (error) {
      console.error('Error applying theme:', error);
      Alert.alert('Error', 'Failed to apply theme. Please try again.');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    Alert.alert(
      'Delete Theme',
      'Are you sure you want to delete this theme?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentData = await getThemes();
              const updatedCustomThemes = (currentData?.customThemes || []).filter(
                (theme: CustomTheme) => theme.id !== themeId
              );
              const newThemeData = {
                ...currentData,
                customThemes: updatedCustomThemes,
              };
              await saveThemes(newThemeData);
              
              // Show Safari themes
              const filteredThemes = updatedCustomThemes.filter((theme: CustomTheme) => {
                return theme.type === 'safari' || !theme.type;
              });
              
              setCustomThemes(filteredThemes);
              if (selectedThemeId === themeId) {
                setSelectedThemeId(null);
              }
            } catch (error) {
              console.error('Error deleting theme:', error);
              Alert.alert('Error', 'Failed to delete theme. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Generate placeholders if we have less than MAX_CUSTOM_THEMES
  const placeholdersNeeded = Math.max(0, MAX_CUSTOM_THEMES - customThemes.length);
  const allItems = [
    ...customThemes,
    ...Array(placeholdersNeeded).fill(null).map((_, index) => ({ id: `placeholder-${index}`, isPlaceholder: true })),
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Your Themes</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Create Theme Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CustomTheme')}
        >
          <Text style={[styles.createButtonText, { color: appThemeColor }]}>
            Create Theme
          </Text>
        </TouchableOpacity>

        {/* Your Themes List */}
        {allItems.length > 0 && (
          <>
            <Text style={[styles.librarySectionHeader, { color: textColor }]}>YOUR THEMES</Text>
            <View style={[styles.themesGroup, { backgroundColor: sectionBgColor }]}>
              {allItems.map((item) => {
                if ('isPlaceholder' in item && item.isPlaceholder) {
                  return (
                    <View key={item.id} style={[styles.placeholderButton, { borderColor }]}>
                      <Text style={[styles.placeholderText, { color: textColor }]}>Empty slot</Text>
                    </View>
                  );
                }

                const theme = item as CustomTheme;
                const isSelected = selectedThemeId === theme.id;

                return (
                  <ThemeListRow
                    key={theme.id}
                    theme={theme}
                    label={theme.name || 'Custom'}
                    selected={isSelected}
                    accentColor={appThemeColor}
                    textColor={textColor}
                    surfaceColor={sectionBgColor}
                    onPress={() => handleSelectTheme(theme)}
                    onLongPress={() => handleDeleteTheme(theme.id)}
                  />
                );
              })}
            </View>
          </>
        )}

        {allItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No custom themes yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Tap "Create Theme" to create your first custom theme.
            </Text>
          </View>
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
  createButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 24,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themesList: {
    marginBottom: 12,
  },
  themesGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  librarySectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.45,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  placeholderButton: {
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 0,
    borderWidth: 0,
    opacity: 0.5,
  },
  placeholderText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
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
});

export default CustomThemesListScreen;
