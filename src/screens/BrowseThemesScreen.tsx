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
import Ionicons from 'react-native-vector-icons/Ionicons';

// Theme Button Component
interface ThemeButtonProps {
  theme: Theme;
  isSelected: boolean;
  appThemeColor: string;
  sectionBgColor: string;
  borderColor: string;
  isFavorite?: boolean;
  onPress: () => void;
  onLongPress: (e: any) => void;
  onPressOut: () => void;
  onToggleFavorite?: () => void;
}

const ThemeButton: React.FC<ThemeButtonProps> = ({
  theme,
  isSelected,
  appThemeColor,
  sectionBgColor,
  borderColor,
  isFavorite = false,
  onPress,
  onLongPress,
  onPressOut,
  onToggleFavorite,
}) => {

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

  const isDualTone =
    (theme.backgroundType === 'gradient' || theme.backgroundType === 'split') &&
    !!theme.backgroundGradient;
  const gradientColors = isDualTone ? extractGradientColors(theme.backgroundGradient!) : null;

  // Use theme background color, but ensure text is readable
  const getButtonBackground = () => {
    return theme.background;
  };

  return (
    <TouchableOpacity
      style={[
        styles.themeButton,
        { backgroundColor: getButtonBackground(), borderColor },
        isSelected && { borderColor: appThemeColor, borderWidth: 2 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
    >
      <View style={styles.themeButtonContent}>
        <View style={styles.colorDotsContainer}>
          {/* Background dot — hard diagonal for gradient/split */}
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
          <Text style={[styles.themeButtonText, { color: theme.text }]}>
            {theme.name}
          </Text>
        </View>
      </View>
      {isSelected && <Text style={[styles.checkmark, { color: appThemeColor }]}>✓</Text>}
    </TouchableOpacity>
  );
};

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
}

// Preset Themes
export const PRESET_THEMES: Theme[] = [
  {
    id: 'dark',
    name: 'Dark Mode',
    background: '#000000',
    text: '#ffffff',
    link: '#1E90FF',
    preview: { background: '#000000', text: '#ffffff', link: '#1E90FF' },
  },
  {
    id: 'light',
    name: 'Light Mode',
    background: '#ffffff',
    text: '#000000',
    link: '#0066cc',
    preview: { background: '#ffffff', text: '#000000', link: '#0066cc' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    background: '#000000',
    text: '#ffffff',
    link: '#0066cc',
    preview: { background: '#000000', text: '#ffffff', link: '#0066cc' },
    backgroundType: 'split',
    backgroundGradient: 'linear-gradient(135deg, #000000 0%, #ffffff 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#1a3d1a',
    text: '#c8e6c9',
    link: '#81c784',
    preview: { background: '#1a3d1a', text: '#c8e6c9', link: '#81c784' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#001f3f',
    text: '#b3d9ff',
    link: '#4da6ff',
    preview: { background: '#001f3f', text: '#b3d9ff', link: '#4da6ff' },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    background: '#F1EADF',
    text: '#4A3F35',
    link: '#006A71',
    preview: { background: '#F1EADF', text: '#4A3F35', link: '#006A71' },
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    background: '#1E1E1E',
    text: '#E0E0E0',
    link: '#BB86FC',
    preview: { background: '#1E1E1E', text: '#E0E0E0', link: '#BB86FC' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0a0e27',
    text: '#6c5ce7',
    link: '#6c5ce7',
    preview: { background: '#0a0e27', text: '#6c5ce7', link: '#6c5ce7' },
  },
  {
    id: 'chroma',
    name: 'Chroma',
    background: '#1a1a2e',
    text: '#f0f0f0',
    link: '#ff6b6b',
    preview: { background: '#1a1a2e', text: '#f0f0f0', link: '#ff6b6b' },
  },
  {
    id: 'ocean-split',
    name: 'Ocean Split',
    background: '#001f3f',
    text: '#ffffff',
    link: '#4da6ff',
    preview: { background: '#001f3f', text: '#b3d9ff', link: '#4da6ff' },
    backgroundType: 'split',
    backgroundGradient: 'linear-gradient(135deg, #001f3f 0%, #b3d9ff 100%)',
  },
  {
    id: 'forest-split',
    name: 'Forest Split',
    background: '#0a2e0a',
    text: '#ffffff',
    link: '#81c784',
    preview: { background: '#0a2e0a', text: '#c8e6c9', link: '#81c784' },
    backgroundType: 'split',
    backgroundGradient: 'linear-gradient(135deg, #0a2e0a 0%, #c8e6c9 100%)',
  },
  {
    id: 'sunset-split',
    name: 'Sunset Split',
    background: '#1a0a2e',
    text: '#ffffff',
    link: '#ff6b6b',
    preview: { background: '#1a0a2e', text: '#ffd4a0', link: '#ff6b6b' },
    backgroundType: 'split',
    backgroundGradient: 'linear-gradient(135deg, #1a0a2e 0%, #ff8c42 100%)',
  },
  // Battery-efficient themes (optimized for OLED displays)
  {
    id: 'amoled-black',
    name: 'AMOLED Black',
    background: '#000000',
    text: '#ffffff',
    link: '#1E90FF',
    preview: { background: '#000000', text: '#ffffff', link: '#1E90FF' },
  },
  {
    id: 'deep-black',
    name: 'Deep Black',
    background: '#0a0a0a',
    text: '#e0e0e0',
    link: '#4da6ff',
    preview: { background: '#0a0a0a', text: '#e0e0e0', link: '#4da6ff' },
  },
  {
    id: 'ultra-dark',
    name: 'Ultra Dark',
    background: '#1a1a1a',
    text: '#d0d0d0',
    link: '#5dade2',
    preview: { background: '#1a1a1a', text: '#d0d0d0', link: '#5dade2' },
  },
  {
    id: 'battery-saver',
    name: 'Battery Saver',
    background: '#000000',
    text: '#b0b0b0',
    link: '#6c757d',
    preview: { background: '#000000', text: '#b0b0b0', link: '#6c757d' },
  },
];

// Battery-efficient theme IDs for easy filtering
export const BATTERY_EFFICIENT_THEME_IDS = ['amoled-black', 'deep-black', 'ultra-dark', 'battery-saver', 'amoled', 'dark'];

const BrowseThemesScreen: React.FC<BrowseThemesScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [lastAppliedTheme, setLastAppliedTheme] = useState<{ theme: Theme; data: any } | null>(null);
  const [longPressPreview, setLongPressPreview] = useState<Theme | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'dark' | 'light' | 'warm' | 'cool'>('all');
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

  const getThemeColorType = (theme: Theme): 'dark' | 'light' | 'warm' | 'cool' => {
    const bg = theme.background.toLowerCase();
    if (bg.includes('#000') || bg.includes('#1a') || bg.includes('#0a') || bg.includes('#0d')) {
      return 'dark';
    }
    if (bg.includes('#fff') || bg.includes('#f5') || bg.includes('#f1')) {
      return 'light';
    }
    if (bg.includes('#ff') || bg.includes('#f6') || bg.includes('#f1') || bg.includes('#3d') || bg.includes('#2d')) {
      return 'warm';
    }
    return 'cool';
  };

  const getFilteredThemes = () => {
    let filtered = [...PRESET_THEMES];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(theme => 
        theme.name.toLowerCase().includes(query)
      );
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter(theme => getThemeColorType(theme) === filterType);
    }
    
    return filtered;
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

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          {(['all', 'dark', 'light', 'warm', 'cool'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                { backgroundColor: sectionBgColor, borderColor },
                filterType === type && { backgroundColor: appThemeColor },
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  { color: filterType === type ? '#FFFFFF' : textColor },
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Favorites Section */}
        {favoriteThemes.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Favorites</Text>
            <View style={styles.themesList}>
              {PRESET_THEMES.filter(theme => favoriteThemes.includes(theme.id)).map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <ThemeButton
                    key={theme.id}
                    theme={theme}
                    isSelected={isSelected}
                    appThemeColor={appThemeColor}
                    sectionBgColor={sectionBgColor}
                    borderColor={borderColor}
                    isFavorite={favoriteThemes.includes(theme.id)}
                    onPress={() => {
                      handlePreviewTheme(theme);
                      handleSelectTheme(theme);
                    }}
                    onLongPress={(e) => handleQuickAction(theme, e)}
                    onPressOut={() => {
                      if (longPressPreview?.id === theme.id) {
                        setLongPressPreview(null);
                        loadPreviewTheme();
                      }
                    }}
                    onToggleFavorite={() => toggleFavorite(theme.id)}
                  />
                );
              })}
            </View>
          </>
        )}

        {/* Theme List */}
        <View style={styles.themesList}>
          {getFilteredThemes().map((theme) => {
            const isSelected = selectedThemeId === theme.id;
            
            return (
              <ThemeButton
                key={theme.id}
                theme={theme}
                isSelected={isSelected}
                appThemeColor={appThemeColor}
                sectionBgColor={sectionBgColor}
                borderColor={borderColor}
                isFavorite={favoriteThemes.includes(theme.id)}
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
                onToggleFavorite={() => toggleFavorite(theme.id)}
              />
            );
          })}
        </View>
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
  themesList: {
    marginBottom: 20,
  },
  themeButton: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  themeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  themeTextContent: {
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  colorDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
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
  themeIcon: {
    fontSize: 16,
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
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
