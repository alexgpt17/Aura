import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  TextInput,
  Modal,
} from 'react-native';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import Snackbar from '../components/Snackbar';
import ThemePreview from '../components/ThemePreview';
import { ThemeListRow } from '../components/ThemeSwatch';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface BrowseThemesScreenProps {
  navigation: any;
  route?: {
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
  preview: { background: string; text: string; link: string };
  backgroundType?: 'color' | 'gradient' | 'split';
  backgroundGradient?: string;
  category: 'basics' | 'colors' | 'nature' | 'atmosphere';
}

export const THEME_SECTIONS: { id: Theme['category']; title: string }[] = [
  { id: 'basics', title: 'BASICS' },
  { id: 'colors', title: 'COLORS' },
  { id: 'nature', title: 'NATURE' },
  { id: 'atmosphere', title: 'ATMOSPHERE' },
];

function preset(
  partial: Omit<Theme, 'preview'> & { preview?: Theme['preview'] },
): Theme {
  return {
    ...partial,
    preview: partial.preview ?? {
      background: partial.background,
      text: partial.text,
      link: partial.link,
    },
  };
}

// Preset Themes — categorized Theme Library
export const PRESET_THEMES: Theme[] = [
  // —— Basics (system-like surfaces) ——
  preset({
    id: 'light',
    name: 'Light Mode',
    category: 'basics',
    background: '#F2F2F7',
    text: '#000000',
    link: '#007AFF',
  }),
  preset({
    id: 'dark',
    name: 'Dark Mode',
    category: 'basics',
    background: '#1C1C1E',
    text: '#FFFFFF',
    link: '#0A84FF',
  }),

  // —— Colors ——
  preset({
    id: 'black',
    name: 'Black',
    category: 'colors',
    background: '#000000',
    text: '#FFFFFF',
    link: '#0A84FF',
  }),
  preset({
    id: 'gray',
    name: 'Gray',
    category: 'colors',
    background: '#3A3A3C',
    text: '#F2F2F7',
    link: '#64D2FF',
  }),
  preset({
    id: 'sepia',
    name: 'Sepia',
    category: 'colors',
    background: '#F1EADF',
    text: '#4A3F35',
    link: '#006A71',
  }),
  preset({
    id: 'green',
    name: 'Green',
    category: 'colors',
    background: '#0B3D0B',
    text: '#D4F5D4',
    link: '#30D158',
  }),
  preset({
    id: 'red',
    name: 'Red',
    category: 'colors',
    background: '#3B0A0A',
    text: '#FFE5E5',
    link: '#FF453A',
  }),
  preset({
    id: 'orange',
    name: 'Orange',
    category: 'colors',
    background: '#3B1D05',
    text: '#FFE8D1',
    link: '#FF9F0A',
  }),
  preset({
    id: 'yellow',
    name: 'Yellow',
    category: 'colors',
    background: '#2C2500',
    text: '#FFF6C2',
    link: '#FFD60A',
  }),
  preset({
    id: 'blue',
    name: 'Blue',
    category: 'colors',
    background: '#001F3F',
    text: '#D6EBFF',
    link: '#64D2FF',
  }),
  preset({
    id: 'purple',
    name: 'Purple',
    category: 'colors',
    background: '#1C0A2E',
    text: '#F0E6FF',
    link: '#BF5AF2',
  }),
  preset({
    id: 'pink',
    name: 'Pink',
    category: 'colors',
    background: '#2E0A1C',
    text: '#FFE5F0',
    link: '#FF375F',
  }),
  preset({
    id: 'teal',
    name: 'Teal',
    category: 'colors',
    background: '#003333',
    text: '#D4FFFA',
    link: '#64D2FF',
  }),
  preset({
    id: 'monochrome',
    name: 'Monochrome',
    category: 'colors',
    background: '#000000',
    text: '#FFFFFF',
    link: '#007AFF',
  }),

  // —— Nature ——
  preset({
    id: 'forest',
    name: 'Forest',
    category: 'nature',
    background: '#1A3D1A',
    text: '#C8E6C9',
    link: '#81C784',
  }),
  preset({
    id: 'ocean',
    name: 'Ocean',
    category: 'nature',
    background: '#001F3F',
    text: '#B3D9FF',
    link: '#4DA6FF',
  }),
  preset({
    id: 'sunset',
    name: 'Sunset',
    category: 'nature',
    background: '#2A1030',
    text: '#FFE4C4',
    link: '#FF8C42',
  }),
  preset({
    id: 'meadow',
    name: 'Meadow',
    category: 'nature',
    background: '#1E3A1E',
    text: '#E8F5E9',
    link: '#A5D6A7',
  }),
  preset({
    id: 'desert',
    name: 'Desert',
    category: 'nature',
    background: '#3E2A14',
    text: '#F5E6D3',
    link: '#E8A87C',
  }),
  preset({
    id: 'aurora',
    name: 'Aurora',
    category: 'nature',
    background: '#0B1A2A',
    text: '#E0FFF8',
    link: '#5EF0C0',
  }),
  preset({
    id: 'coral',
    name: 'Coral',
    category: 'nature',
    background: '#3A1520',
    text: '#FFE8E0',
    link: '#FF6F61',
  }),
  preset({
    id: 'moss',
    name: 'Moss',
    category: 'nature',
    background: '#1A2E1A',
    text: '#DCE8C8',
    link: '#9CCC65',
  }),

  // —— Atmosphere ——
  preset({
    id: 'midnight',
    name: 'Midnight',
    category: 'atmosphere',
    background: '#0A0E27',
    text: '#E8E6FF',
    link: '#6C5CE7',
  }),
  preset({
    id: 'chroma',
    name: 'Chroma',
    category: 'atmosphere',
    background: '#1A1A2E',
    text: '#F0F0F0',
    link: '#FF6B6B',
  }),
  preset({
    id: 'espresso',
    name: 'Espresso',
    category: 'atmosphere',
    background: '#1A120C',
    text: '#F0E6DA',
    link: '#D4A574',
  }),
  preset({
    id: 'lavender',
    name: 'Lavender',
    category: 'atmosphere',
    background: '#1E1630',
    text: '#F3EEFF',
    link: '#C9B6FF',
  }),
  preset({
    id: 'ice',
    name: 'Ice',
    category: 'atmosphere',
    background: '#0E1A22',
    text: '#E8F4FA',
    link: '#7FDBFF',
  }),
  preset({
    id: 'paper',
    name: 'Paper',
    category: 'atmosphere',
    background: '#FAF7F2',
    text: '#2C2C2C',
    link: '#1A5F7A',
  }),
  preset({
    id: 'nord',
    name: 'Nord',
    category: 'atmosphere',
    background: '#2E3440',
    text: '#ECEFF4',
    link: '#88C0D0',
  }),
  preset({
    id: 'dracula',
    name: 'Dracula',
    category: 'atmosphere',
    background: '#282A36',
    text: '#F8F8F2',
    link: '#BD93F9',
  }),
  preset({
    id: 'rose',
    name: 'Rose',
    category: 'atmosphere',
    background: '#2A1218',
    text: '#FFE8EE',
    link: '#FF85A1',
  }),
];

/** @deprecated Prefer pure-black / OLED themes under Colors */
export const BATTERY_EFFICIENT_THEME_IDS = ['black', 'dark', 'gray'];

const BrowseThemesScreen: React.FC<BrowseThemesScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [lastAppliedTheme, setLastAppliedTheme] = useState<{ theme: Theme; data: any } | null>(null);
  const [longPressPreview, setLongPressPreview] = useState<Theme | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteThemes, setFavoriteThemes] = useState<string[]>([]);
  const [quickActionMenu, setQuickActionMenu] = useState<{ visible: boolean; theme: Theme | null; position: { x: number; y: number } }>({ visible: false, theme: null, position: { x: 0, y: 0 } });
  const forWebsite = route?.params?.forWebsite;

  useEffect(() => {
    loadCurrentTheme();
    loadFavorites();
    loadPreviewTheme();
  }, []);

  const loadPreviewTheme = async () => {
    try {
      const themeData = await getThemes();
      let current;
      
      if (forWebsite) {
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        current = themeData?.siteThemes?.[cleanHostname] || themeData?.globalTheme;
      } else {
        current = themeData?.globalTheme;
      }
      
      if (current) {
        const matchingPreset = PRESET_THEMES.find(
          (preset) => {
            const dual = (t: string | undefined) => t === 'gradient' || t === 'split';
            if (dual(current.backgroundType) && dual(preset.backgroundType)) {
              return current.backgroundGradient === preset.backgroundGradient &&
                     preset.text === current.text &&
                     preset.link === current.link;
            } else {
              return preset.background === current.background &&
                     preset.text === current.text &&
                     preset.link === current.link;
            }
          }
        );
        if (matchingPreset) {
          setPreviewTheme(matchingPreset);
        } else {
          setPreviewTheme({
            id: 'current',
            name: 'Current',
            background: current.background || '#000000',
            text: current.text || '#ffffff',
            link: current.link || '#228B22',
            preview: {
              background: current.background || '#000000',
              text: current.text || '#ffffff',
              link: current.link || '#228B22',
            },
            backgroundType: current.backgroundType,
            backgroundGradient: current.backgroundGradient,
          });
        }
      } else {
        setPreviewTheme(PRESET_THEMES[0]);
      }
    } catch (error) {
      console.error('Error loading preview theme:', error);
      setPreviewTheme(PRESET_THEMES[0]);
    }
  };

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      let current;
      
      if (forWebsite) {
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        current = themeData?.siteThemes?.[cleanHostname] || themeData?.globalTheme;
      } else {
        current = themeData?.globalTheme;
      }
      
      if (current) {
        const matchingPreset = PRESET_THEMES.find(
          (preset) => {
            const dual = (t: string | undefined) => t === 'gradient' || t === 'split';
            if (dual(current.backgroundType) && dual(preset.backgroundType)) {
              return current.backgroundGradient === preset.backgroundGradient &&
                     preset.text === current.text &&
                     preset.link === current.link;
            } else {
              return preset.background === current.background &&
                     preset.text === current.text &&
                     preset.link === current.link;
            }
          }
        );
        if (matchingPreset) {
          setSelectedThemeId(matchingPreset.id);
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

  const handlePreviewTheme = (theme: Theme) => {
    setPreviewTheme(theme);
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
        await loadPreviewTheme();
        setSnackbarMessage(`Theme cleared — Undo`);
        setSnackbarVisible(true);
        setLastAppliedTheme({ theme, data: currentData });
        return;
      }
      
      setLastAppliedTheme({ theme, data: currentData });
      
      const completeTheme = {
        enabled: true,
        id: theme.id,
        name: theme.name,
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
          setSnackbarMessage(`Theme cleared — Undo`);
          setSnackbarVisible(true);
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
        setSnackbarMessage(`Applied ${theme.name} — Undo`);
        setSnackbarVisible(true);
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
        setPreviewTheme(theme);
        trackRecentlyUsed(theme, 'safari');
        setSnackbarMessage(`Applied ${theme.name} — Undo`);
        setSnackbarVisible(true);
      }
    } catch (error) {
      console.error('Error applying theme:', error);
      Alert.alert('Error', 'Failed to apply theme. Please try again.');
    }
  };

  const handleUndo = async () => {
    if (!lastAppliedTheme) return;
    
    try {
      await saveThemes(lastAppliedTheme.data);
      setSelectedThemeId(null);
      setPreviewTheme(null);
      setLastAppliedTheme(null);
      loadCurrentTheme();
      loadPreviewTheme();
    } catch (error) {
      console.error('Error undoing theme:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const themeData = await getThemes();
      setFavoriteThemes(themeData?.favoriteThemes || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const toggleFavorite = async (themeId: string) => {
    try {
      const currentData = await getThemes();
      const favorites = currentData?.favoriteThemes || [];
      const isFavorite = favorites.includes(themeId);
      
      const newFavorites = isFavorite
        ? favorites.filter((id: string) => id !== themeId)
        : [...favorites, themeId];
      
      const newThemeData = {
        ...currentData,
        favoriteThemes: newFavorites,
      };
      await saveThemes(newThemeData);
      setFavoriteThemes(newFavorites);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const trackRecentlyUsed = async (theme: Theme, type: 'safari') => {
    try {
      const currentData = await getThemes();
      const recent = currentData?.recentlyUsedThemes || [];
      const filtered = recent.filter((item: any) => item.themeId !== theme.id);
      const newRecent = [
        { themeId: theme.id, timestamp: Date.now(), type },
        ...filtered,
      ].slice(0, 20);
      
      const newThemeData = {
        ...currentData,
        recentlyUsedThemes: newRecent,
      };
      await saveThemes(newThemeData);
    } catch (error) {
      console.error('Error tracking recently used:', error);
    }
  };

  const getVisibleThemes = () => {
    let filtered = [...PRESET_THEMES];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(theme => theme.name.toLowerCase().includes(query));
    }
    return filtered;
  };

  const renderThemeRow = (theme: Theme) => {
    const isSelected = selectedThemeId === theme.id;
    return (
      <ThemeListRow
        key={theme.id}
        theme={theme}
        selected={isSelected}
        accentColor={appThemeColor}
        textColor={textColor}
        surfaceColor={sectionBgColor}
        favorite={favoriteThemes.includes(theme.id)}
        onToggleFavorite={() => toggleFavorite(theme.id)}
        onPress={() => {
          handlePreviewTheme(theme);
          handleSelectTheme(theme);
        }}
        onLongPress={(e) => {
          handleQuickAction(theme, e);
          setLongPressPreview(theme);
          handlePreviewTheme(theme);
        }}
        onPressOut={() => {
          if (longPressPreview?.id === theme.id) {
            setLongPressPreview(null);
            loadPreviewTheme();
          }
        }}
      />
    );
  };

  const handleQuickAction = (theme: Theme, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setQuickActionMenu({ visible: true, theme, position: { x: pageX, y: pageY } });
  };

  const handleQuickApply = async (theme: Theme) => {
    setQuickActionMenu({ visible: false, theme: null, position: { x: 0, y: 0 } });
    await handleSelectTheme(theme);
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
          {forWebsite 
            ? `Theme for ${forWebsite}` 
            : 'Browse Themes'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Preview Section */}
        {previewTheme && !forWebsite && (
          <View style={styles.previewSection}>
            <ThemePreview
              background={previewTheme.background}
              text={previewTheme.text}
              link={previewTheme.link}
              backgroundType={previewTheme.backgroundType}
              backgroundGradient={previewTheme.backgroundGradient}
            />
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: sectionBgColor, borderColor, color: textColor }]}
            placeholder="Search themes..."
            placeholderTextColor={textColor === '#FFFFFF' ? '#666666' : '#999999'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Favorites */}
        {favoriteThemes.length > 0 && (
          <>
            <Text style={[styles.librarySectionHeader, { color: textColor }]}>FAVORITES</Text>
            <View style={[styles.themesGroup, { backgroundColor: sectionBgColor }]}>
              {PRESET_THEMES.filter(theme => favoriteThemes.includes(theme.id)).map(theme =>
                renderThemeRow(theme),
              )}
            </View>
          </>
        )}

        {/* Categorized themes */}
        {THEME_SECTIONS.map(section => {
          const themes = getVisibleThemes().filter(t => t.category === section.id);
          if (themes.length === 0) return null;
          return (
            <React.Fragment key={section.id}>
              <Text style={[styles.librarySectionHeader, { color: textColor }]}>{section.title}</Text>
              <View style={[styles.themesGroup, { backgroundColor: sectionBgColor }]}>
                {themes.map(theme => renderThemeRow(theme))}
              </View>
            </React.Fragment>
          );
        })}
      </ScrollView>
      
      <Snackbar
        visible={snackbarVisible}
        message={snackbarMessage}
        onUndo={handleUndo}
        onDismiss={() => setSnackbarVisible(false)}
      />

      {/* Quick Action Menu */}
      <Modal
        visible={quickActionMenu.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setQuickActionMenu({ visible: false, theme: null, position: { x: 0, y: 0 } })}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setQuickActionMenu({ visible: false, theme: null, position: { x: 0, y: 0 } })}
        >
          {quickActionMenu.theme && (
            <View style={[styles.quickActionMenu, { backgroundColor: sectionBgColor, borderColor, top: quickActionMenu.position.y - 100, left: quickActionMenu.position.x - 80 }]}>
              <TouchableOpacity
                style={[styles.quickActionItem, { borderBottomColor: borderColor }]}
                onPress={() => {
                  handleQuickApply(quickActionMenu.theme!);
                }}
              >
                <Text style={[styles.quickActionText, { color: textColor }]}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionItem, { borderBottomColor: borderColor }]}
                onPress={() => {
                  toggleFavorite(quickActionMenu.theme!.id);
                  setQuickActionMenu({ visible: false, theme: null, position: { x: 0, y: 0 } });
                }}
              >
                <Text style={[styles.quickActionText, { color: textColor }]}>
                  {favoriteThemes.includes(quickActionMenu.theme!.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => {
                  handlePreviewTheme(quickActionMenu.theme!);
                  setQuickActionMenu({ visible: false, theme: null, position: { x: 0, y: 0 } });
                }}
              >
                <Text style={[styles.quickActionText, { color: textColor }]}>Preview</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
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
  previewSection: {
    marginBottom: 20,
  },
  previewBox: {
    borderRadius: 12,
    padding: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  googlePreview: {
    padding: 8,
  },
  googleTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  googleTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleTopButton: {
    fontSize: 13,
    fontWeight: '500',
  },
  googleSearchBar: {
    marginBottom: 8,
  },
  googleSearchInput: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  googleSearchText: {
    fontSize: 14,
    opacity: 0.7,
  },
  googleTabsContainer: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  googleTabs: {
    flexDirection: 'row',
    gap: 16,
  },
  googleTab: {
    fontSize: 13,
    fontWeight: '500',
  },
  googleTabActive: {
    fontWeight: '600',
  },
  googleResults: {
    gap: 12,
  },
  googleResult: {
    marginBottom: 8,
  },
  googleResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  googleResultUrl: {
    fontSize: 12,
    marginBottom: 4,
  },
  googleResultSnippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  librarySectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    opacity: 0.45,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  themesGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  themesList: {
    marginBottom: 12,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  favoriteButton: {
    padding: 4,
  },
  favoriteIcon: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionMenu: {
    borderRadius: 12,
    padding: 8,
    minWidth: 180,
    borderWidth: 1,
    position: 'absolute',
  },
  quickActionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  quickActionText: {
    fontSize: 16,
  },
});

export default BrowseThemesScreen;
