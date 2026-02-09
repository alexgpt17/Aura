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

// Helper function to lighten a hex color for keyboard keys
const lightenColor = (hex: string, percent: number = 20): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Theme Button Component (extracted to use hooks properly)
interface ThemeButtonProps {
  theme: Theme;
  isSelected: boolean;
  forKeyboard: boolean;
  appThemeColor: string;
  isFavorite?: boolean;
  onPress: () => void;
  onLongPress: (e: any) => void;
  onPressOut: () => void;
  onToggleFavorite?: () => void;
}

const ThemeButton: React.FC<ThemeButtonProps> = ({
  theme,
  isSelected,
  forKeyboard,
  appThemeColor,
  isFavorite = false,
  onPress,
  onLongPress,
  onPressOut,
  onToggleFavorite,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isSelected) {
      Animated.spring(scaleAnim, {
        toValue: 1.02,
        useNativeDriver: true,
        tension: 300,
        friction: 7,
      }).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [isSelected, scaleAnim]);

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        isSelected && { shadowColor: appThemeColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.themeButton,
          styles.presetThemeButton,
          { backgroundColor: theme.background },
          isSelected && { borderColor: appThemeColor, borderWidth: 2 },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
      >
        <View style={styles.themeButtonContent}>
          <View style={styles.themeButtonLeft}>
            {/* Preview indicator - gradient strip or color dots */}
            <View style={styles.previewIndicator}>
              {theme.backgroundType === 'gradient' ? (
                <View style={[styles.gradientStrip, { backgroundColor: theme.background }]} />
              ) : (
                <View style={[styles.colorDot, { backgroundColor: theme.background }]} />
              )}
            </View>
            <Text
              style={[
                styles.themeButtonText,
                { color: theme.text },
              ]}
            >
              {theme.name}
            </Text>
          </View>
          <View style={styles.themeButtonRight}>
            {onToggleFavorite && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                style={styles.favoriteButton}
              >
                <Text style={[styles.favoriteIcon, { color: isFavorite ? appThemeColor : '#666666' }]}>
                  {isFavorite ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            )}
            {!forKeyboard && <Text style={[styles.themeIcon, { color: theme.text }]}>🌐</Text>}
            {forKeyboard && <Text style={[styles.themeIcon, { color: theme.text }]}>⌨️</Text>}
            {isSelected && (
              <Text style={[styles.themeButtonCheckmark, { color: appThemeColor }]}>✓</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface ThemeSelectionScreenProps {
  navigation: any;
  route?: {
    params?: {
      forWebsite?: string;
      forKeyboard?: boolean;
      forApp?: string;
    };
  };
}

interface Theme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  keyColor?: string;
  preview: { background: string; text: string; link: string };
  backgroundType?: 'color' | 'gradient';
  backgroundGradient?: string;
}

// Preset Themes - Dark Mode and Light Mode first, then creative mixed-color themes
const PRESET_THEMES: Theme[] = [
  {
    id: 'dark',
    name: 'Dark Mode',
    background: '#000000',
    text: '#ffffff',
    link: '#1E90FF',
    keyColor: '#2a2a2a',
    preview: { background: '#000000', text: '#ffffff', link: '#1E90FF' },
  },
  {
    id: 'light',
    name: 'Light Mode',
    background: '#ffffff',
    text: '#000000',
    link: '#0066cc',
    keyColor: '#E0E0E0',
    preview: { background: '#ffffff', text: '#000000', link: '#0066cc' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    background: '#000000', // Base color (black side)
    text: '#ffffff', // White text (will switch dynamically in Safari, white for keyboard)
    link: '#0066cc', // Blue links (standard web blue)
    keyColor: '#2a2a2a',
    preview: { background: '#000000', text: '#ffffff', link: '#0066cc' },
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(to bottom left, #000000 0%, #ffffff 100%)',
  },
  {
    id: 'forest',
    name: 'Forest',
    background: '#1a3d1a',
    text: '#c8e6c9',
    link: '#81c784',
    keyColor: '#2a4d2a',
    preview: { background: '#1a3d1a', text: '#c8e6c9', link: '#81c784' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: '#001f3f',
    text: '#b3d9ff',
    link: '#4da6ff',
    keyColor: '#003366',
    preview: { background: '#001f3f', text: '#b3d9ff', link: '#4da6ff' },
  },
  {
    id: 'sepia',
    name: 'Sepia',
    background: '#F1EADF',
    text: '#4A3F35',
    link: '#006A71',
    keyColor: '#E8DDD0',
    preview: { background: '#F1EADF', text: '#4A3F35', link: '#006A71' },
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    background: '#1E1E1E',
    text: '#E0E0E0',
    link: '#BB86FC',
    keyColor: '#2E2E2E',
    preview: { background: '#1E1E1E', text: '#E0E0E0', link: '#BB86FC' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0a0e27',
    text: '#6c5ce7',
    link: '#6c5ce7',
    keyColor: '#1a1e37',
    preview: { background: '#0a0e27', text: '#6c5ce7', link: '#6c5ce7' },
  },
  {
    id: 'chroma',
    name: 'Chroma',
    background: '#1a1a2e',
    text: '#f0f0f0',
    link: '#ff6b6b',
    keyColor: '#2a2a3e',
    preview: { background: '#1a1a2e', text: '#f0f0f0', link: '#ff6b6b' },
  },
];

const ThemeSelectionScreen: React.FC<ThemeSelectionScreenProps> = ({ navigation, route }) => {
  const { appThemeColor } = useAppTheme();
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [lastAppliedTheme, setLastAppliedTheme] = useState<{ theme: Theme; data: any } | null>(null);
  const [longPressPreview, setLongPressPreview] = useState<Theme | null>(null);
  const [browseThemesExpanded, setBrowseThemesExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'dark' | 'light' | 'warm' | 'cool'>('all');
  const [favoriteThemes, setFavoriteThemes] = useState<string[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<Array<{ themeId: string; timestamp: number; type: string }>>([]);
  const [quickActionMenu, setQuickActionMenu] = useState<{ visible: boolean; theme: Theme | null; position: { x: number; y: number } }>({ visible: false, theme: null, position: { x: 0, y: 0 } });
  const forWebsite = route?.params?.forWebsite;
  const forKeyboard = route?.params?.forKeyboard;
  const forApp = route?.params?.forApp;

  useEffect(() => {
    loadCustomThemes();
    loadCurrentTheme();
    loadFavorites();
    loadRecentlyUsed();
    // Set initial preview to current theme
    loadPreviewTheme();
  }, []);

  const loadPreviewTheme = async () => {
    try {
      const themeData = await getThemes();
      let current;
      
      if (forWebsite) {
        // Load website-specific theme
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        current = themeData?.siteThemes?.[cleanHostname] || themeData?.globalTheme;
      } else if (forApp) {
        // Load per-app keyboard theme with proper fallback logic
        if (themeData?.appThemes?.[forApp]) {
          current = themeData.appThemes[forApp];
          console.log(`Loading per-app theme for ${forApp}:`, current);
        } else {
          current = themeData?.keyboardTheme || themeData?.globalTheme;
          console.log(`No per-app theme found for ${forApp}, using keyboard theme:`, current);
        }
      } else if (forKeyboard) {
        // Load keyboard theme
        current = themeData?.keyboardTheme || themeData?.globalTheme;
      } else {
        // Load global theme
        current = themeData?.globalTheme;
      }
      
      if (current) {
        const matchingPreset = PRESET_THEMES.find(
          (preset) => {
            // Match by background type and gradient if present
            if (current.backgroundType === 'gradient' && preset.backgroundType === 'gradient') {
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
          // Use current theme for preview
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
          });
        }
      } else {
        // Default preview
        setPreviewTheme(PRESET_THEMES[0]);
      }
    } catch (error) {
      console.error('Error loading preview theme:', error);
      setPreviewTheme(PRESET_THEMES[0]);
    }
  };

  const loadCustomThemes = async () => {
    try {
      const themeData = await getThemes();
      // Extract custom themes from storage if we add that feature later
      // For now, custom themes will be stored separately
    } catch (error) {
      console.error('Error loading custom themes:', error);
    }
  };

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      let current;
      
      if (forWebsite) {
        // Load website-specific theme
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        current = themeData?.siteThemes?.[cleanHostname] || themeData?.globalTheme;
      } else if (forApp) {
        // Load per-app keyboard theme with proper fallback logic
        if (themeData?.appThemes?.[forApp]) {
          current = themeData.appThemes[forApp];
          console.log(`Current per-app theme for ${forApp}:`, current);
        } else {
          current = themeData?.keyboardTheme || themeData?.globalTheme;
          console.log(`No per-app theme found for ${forApp}, using keyboard theme as current`);
        }
      } else if (forKeyboard) {
        // Load keyboard theme
        current = themeData?.keyboardTheme || themeData?.globalTheme;
      } else {
        // Load global theme
        current = themeData?.globalTheme;
      }
      
      if (current) {
        // Find which preset matches the current theme
        const matchingPreset = PRESET_THEMES.find(
          (preset) => {
            // Match by background type and gradient if present
            if (current.backgroundType === 'gradient' && preset.backgroundType === 'gradient') {
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
        }
      }
    } catch (error) {
      console.error('Error loading current theme:', error);
    }
  };

  const handlePreviewTheme = (theme: Theme) => {
    setPreviewTheme(theme);
  };

  const handleSelectTheme = async (theme: Theme) => {
    try {
      const currentData = await getThemes();
      
      // Store previous state for undo
      setLastAppliedTheme({ theme, data: currentData });
      
      // Create a complete, independent theme object
      const completeTheme = {
        enabled: true,
        background: theme.background,
        text: theme.text,
        link: theme.link,
        keyColor: theme.keyColor,
        backgroundType: (theme.backgroundType || 'color') as 'color' | 'gradient',
        backgroundImage: null,
        backgroundGradient: theme.backgroundGradient || null,
      };

      if (forWebsite) {
        // Save theme for specific website - make it completely independent
        const cleanHostname = forWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
        const newSiteThemes = {
          ...(currentData?.siteThemes || {}),
          [cleanHostname]: {
            ...completeTheme,
            // Preserve enabled state if website already has settings
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
      } else if (forApp) {
        // Save theme for specific app - make it completely independent
        const newAppThemes = {
          ...(currentData?.appThemes || {}),
          [forApp]: {
            ...completeTheme,
            // Preserve enabled state if app already has settings
            enabled: currentData?.appThemes?.[forApp]?.enabled ?? true,
          },
        };
        const newThemeData = {
          ...currentData,
          appThemes: newAppThemes,
        };
        await saveThemes(newThemeData);
        setSnackbarMessage(`Applied ${theme.name} — Undo`);
        setSnackbarVisible(true);
        navigation.goBack();
      } else if (forKeyboard) {
        // Save theme for keyboard - make it completely independent
        const newThemeData = {
          ...currentData,
          keyboardTheme: {
            ...completeTheme,
            enabled: currentData?.keyboardTheme?.enabled ?? true,
          },
        };
        await saveThemes(newThemeData);
        setSelectedThemeId(theme.id);
        setPreviewTheme(theme);
        trackRecentlyUsed(theme, forKeyboard ? 'keyboard' : 'safari');
        setSnackbarMessage(`Applied ${theme.name} — Undo`);
        setSnackbarVisible(true);
      } else {
        // Save as global theme
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
      // Reload to reflect the undo
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

  const loadRecentlyUsed = async () => {
    try {
      const themeData = await getThemes();
      const recent = themeData?.recentlyUsedThemes || [];
      // Sort by timestamp, most recent first, limit to 10
      const sorted = recent.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 10);
      setRecentlyUsed(sorted);
    } catch (error) {
      console.error('Error loading recently used:', error);
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

  const trackRecentlyUsed = async (theme: Theme, type: 'preset' | 'custom' | 'keyboard' | 'safari') => {
    try {
      const currentData = await getThemes();
      const recent = currentData?.recentlyUsedThemes || [];
      
      // Remove existing entry for this theme if it exists
      const filtered = recent.filter((item: any) => item.themeId !== theme.id);
      
      // Add new entry at the beginning
      const newRecent = [
        { themeId: theme.id, timestamp: Date.now(), type },
        ...filtered,
      ].slice(0, 20); // Keep last 20
      
      const newThemeData = {
        ...currentData,
        recentlyUsedThemes: newRecent,
      };
      await saveThemes(newThemeData);
      setRecentlyUsed(newRecent.slice(0, 10));
    } catch (error) {
      console.error('Error tracking recently used:', error);
    }
  };

  // Helper to determine theme color type
  const getThemeColorType = (theme: Theme): 'dark' | 'light' | 'warm' | 'cool' => {
    const bg = theme.background.toLowerCase();
    // Simple heuristic based on background color
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

  // Filter and search themes
  const getFilteredThemes = () => {
    let filtered = [...PRESET_THEMES];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(theme => 
        theme.name.toLowerCase().includes(query)
      );
    }
    
    // Apply color type filter
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {forWebsite 
            ? `Theme for ${forWebsite}` 
            : forApp
            ? `Keyboard for ${forApp.split('.').pop() || forApp}`
            : forKeyboard 
            ? 'Keyboard Theme'
            : 'Select Theme'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Preview Section */}
        {previewTheme && (
          <View style={styles.previewSection}>
            {forKeyboard ? (
              // Keyboard Preview - Shows selected theme colors
              <View style={[styles.previewBox, { backgroundColor: previewTheme.background }]}>
                <View style={styles.keyboardPreview}>
                  {/* Top row - 10 keys */}
                  <View style={styles.keyboardRow}>
                    {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key, index) => (
                      <View
                        key={index}
                        style={[
                          styles.keyboardKey,
                          { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                        ]}
                      >
                        <Text style={[styles.keyboardKeyText, { color: previewTheme.text }]}>{key}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Middle row - 9 keys, centered */}
                  <View style={[styles.keyboardRow, styles.keyboardRowCentered]}>
                    {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key, index) => (
                      <View
                        key={index}
                        style={[
                          styles.keyboardKey,
                          { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                        ]}
                      >
                        <Text style={[styles.keyboardKeyText, { color: previewTheme.text }]}>{key}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Third row - Shift, 7 keys, Backspace */}
                  <View style={styles.keyboardRow}>
                    <View
                      style={[
                        styles.keyboardKey,
                        styles.keyboardSpecialKey,
                        { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                      ]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: previewTheme.text, fontSize: 10 }]}>⇧</Text>
                    </View>
                    {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key, index) => (
                      <View
                        key={index}
                        style={[
                          styles.keyboardKey,
                          { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                        ]}
                      >
                        <Text style={[styles.keyboardKeyText, { color: previewTheme.text }]}>{key}</Text>
                      </View>
                    ))}
                    <View
                      style={[
                        styles.keyboardKey,
                        styles.keyboardSpecialKey,
                        { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                      ]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: previewTheme.text, fontSize: 12 }]}>⌫</Text>
                    </View>
                  </View>
                  {/* Bottom row - 123, Emoji, Space, Return */}
                  <View style={[styles.keyboardRow, styles.keyboardBottomRow]}>
                    <View
                      style={[
                        styles.keyboardKey,
                        styles.keyboardSpecialKey,
                        styles.keyboardModeKey,
                        { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                      ]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: previewTheme.text, fontSize: 10 }]}>123</Text>
                    </View>
                    <View
                      style={[
                        styles.keyboardKey,
                        styles.keyboardSpecialKey,
                        styles.keyboardEmojiKey,
                        { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                      ]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: previewTheme.text, fontSize: 14 }]}>☺</Text>
                    </View>
                    <View
                      style={[
                        styles.keyboardKey,
                        styles.keyboardSpaceKey,
                        { backgroundColor: lightenColor(previewTheme.background, 15), borderColor: previewTheme.text + '40' },
                      ]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: previewTheme.text, fontSize: 9 }]}>space</Text>
                    </View>
                    <View
                      style={[
                        styles.keyboardKey,
                        styles.keyboardSpecialKey,
                        styles.keyboardReturnKey,
                        { backgroundColor: previewTheme.link, borderColor: previewTheme.text + '40' },
                      ]}
                    >
                      <Text style={[styles.keyboardKeyText, { color: '#FFFFFF', fontSize: 10 }]}>return</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              // Google-style Search Preview with Aura search - Same size as keyboard preview
              <View style={[styles.previewBox, { backgroundColor: previewTheme.background }]}>
                <View style={styles.googlePreview}>
                  {/* Google Top Bar - Sign in */}
                  <View style={styles.googleTopBar}>
                    <View style={styles.googleTopRight}>
                      <Text style={[styles.googleTopButton, { color: previewTheme.text }]}>Sign in</Text>
                    </View>
                  </View>
                  
                  {/* Google Search Bar */}
                  <View style={[styles.googleSearchBar, { backgroundColor: previewTheme.background }]}>
                    <View style={[styles.googleSearchInput, { 
                      backgroundColor: previewTheme.background === '#ffffff' || previewTheme.background === '#FFFFFF' 
                        ? '#f1f3f4' 
                        : 'rgba(255, 255, 255, 0.1)',
                      borderColor: previewTheme.text + '20'
                    }]}>
                      <Text style={[styles.googleSearchText, { color: previewTheme.text }]}>
                        Aura
                      </Text>
                    </View>
                  </View>
                  
                  {/* Google Tabs - Below search bar */}
                  <View style={styles.googleTabsContainer}>
                    <View style={styles.googleTabs}>
                      <Text style={[styles.googleTab, styles.googleTabActive, { color: previewTheme.link }]}>All</Text>
                      <Text style={[styles.googleTab, { color: previewTheme.text + 'CC' }]}>Images</Text>
                      <Text style={[styles.googleTab, { color: previewTheme.text + 'CC' }]}>Results</Text>
                    </View>
                  </View>
                  
                  {/* Single Search Result - Aura-themed */}
                  <View style={styles.googleResults}>
                    <View style={styles.googleResult}>
                      <Text style={[styles.googleResultTitle, { color: previewTheme.link }]} numberOfLines={1}>
                        Aura - Custom Keyboard Themes
                      </Text>
                      <Text style={[styles.googleResultUrl, { color: previewTheme.text + 'CC' }]} numberOfLines={1}>
                        aura.app › keyboard-themes
                      </Text>
                      <Text style={[styles.googleResultSnippet, { color: previewTheme.text }]} numberOfLines={2}>
                        Customize your iOS keyboard with beautiful themes. Aura offers personalized keyboard themes with custom colors.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search themes..."
            placeholderTextColor="#666666"
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
                filterType === type && { backgroundColor: appThemeColor },
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === type && { color: '#FFFFFF' },
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
            <Text style={styles.sectionTitle}>Favorites</Text>
            <View style={styles.themesList}>
              {PRESET_THEMES.filter(theme => favoriteThemes.includes(theme.id)).map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <ThemeButton
                    key={theme.id}
                    theme={theme}
                    isSelected={isSelected}
                    forKeyboard={!!forKeyboard}
                    appThemeColor={appThemeColor}
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

        {/* Your Themes Button - Now available for keyboard too */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CustomThemesList', { forKeyboard: forKeyboard || false })}
        >
          <Text style={[styles.createButtonText, { color: appThemeColor }]}>Your Themes</Text>
        </TouchableOpacity>

        {/* Create Theme Button */}
        {forKeyboard ? (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CustomKeyboardTheme')}
          >
            <Text style={[styles.createButtonText, { color: appThemeColor }]}>Create Theme</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CustomTheme')}
          >
            <Text style={[styles.createButtonText, { color: appThemeColor }]}>Create Theme</Text>
          </TouchableOpacity>
        )}

        {/* Browse Themes Button */}
        <TouchableOpacity
          style={styles.browseThemesButton}
          onPress={() => setBrowseThemesExpanded(!browseThemesExpanded)}
        >
          <Text style={[styles.browseThemesButtonText, { color: appThemeColor }]}>Browse Themes</Text>
          <Text style={[styles.browseThemesArrow, { color: appThemeColor }]}>
            {browseThemesExpanded ? '↑' : '→'}
          </Text>
        </TouchableOpacity>

        {/* Preset Themes Section - Collapsible */}
        {browseThemesExpanded && (
          <View style={styles.themesList}>
            {getFilteredThemes().map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              
                return (
                  <ThemeButton
                    key={theme.id}
                    theme={theme}
                    isSelected={isSelected}
                    forKeyboard={!!forKeyboard}
                    appThemeColor={appThemeColor}
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
        )}

        {!forKeyboard && (
          <>
            <Text style={styles.sectionTitle}>Your Themes</Text>
            {customThemes.length > 0 ? (
              <View style={styles.themesList}>
                {customThemes.map((theme) => {
                  const isSelected = selectedThemeId === theme.id;
                  return (
                    <TouchableOpacity
                      key={theme.id}
                      style={[
                        styles.themeButton,
                        styles.customThemeButton,
                        { backgroundColor: '#1a1a1a' },
                        isSelected && { borderColor: appThemeColor, borderWidth: 2 },
                      ]}
                      onPress={() => {
                        handlePreviewTheme(theme);
                        handleSelectTheme(theme);
                      }}
                    >
                      <View style={styles.themeButtonContent}>
                        <View style={styles.themeButtonLeft}>
                          <View style={styles.previewIndicator}>
                            <View style={[styles.colorDot, { backgroundColor: theme.background }]} />
                          </View>
                          <Text style={[styles.themeButtonText, { color: '#FFFFFF' }]}>
                            {theme.name}
                          </Text>
                        </View>
                        <View style={styles.themeButtonRight}>
                          <Text style={[styles.themeIcon, { color: '#FFFFFF' }]}>🌐</Text>
                          {isSelected && (
                            <Text style={[styles.themeButtonCheckmark, { color: appThemeColor }]}>✓</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Create your first theme</Text>
                <Text style={styles.emptyStateSubtext}>
                  Tap "Your Themes" above to get started.
                </Text>
              </View>
            )}
          </>
        )}
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
            <View style={[styles.quickActionMenu, { top: quickActionMenu.position.y - 100, left: quickActionMenu.position.x - 80 }]}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => {
                  handleQuickApply(quickActionMenu.theme!);
                }}
              >
                <Text style={styles.quickActionText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => {
                  toggleFavorite(quickActionMenu.theme!.id);
                  setQuickActionMenu({ visible: false, theme: null, position: { x: 0, y: 0 } });
                }}
              >
                <Text style={styles.quickActionText}>
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
                <Text style={styles.quickActionText}>Preview</Text>
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
  previewContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 28,
  },
  previewSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  previewBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewImageContainer: {
    width: 100,
    height: 100,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImageEmoji: {
    fontSize: 48,
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
  keyboardPreview: {
    padding: 8,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 3,
    gap: 3,
  },
  keyboardRowCentered: {
    // Middle row is centered with 9 keys
    width: '90%',
    alignSelf: 'center',
  },
  keyboardBottomRow: {
    // Bottom row has different spacing (5.5pt equivalent)
    gap: 2.5,
  },
  keyboardKey: {
    minWidth: 22,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  keyboardSpecialKey: {
    minWidth: 28,
  },
  keyboardModeKey: {
    minWidth: 26,
  },
  keyboardEmojiKey: {
    minWidth: 28,
  },
  keyboardSpaceKey: {
    flex: 1,
    maxWidth: 100,
    minWidth: 60,
  },
  keyboardReturnKey: {
    minWidth: 50,
  },
  keyboardKeyText: {
    fontSize: 9,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    marginTop: 24,
  },
  themesList: {
    marginBottom: 20,
  },
  themeButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetThemeButton: {
    // Card style for presets
  },
  customThemeButton: {
    // List style for custom themes
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  themeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  themeButtonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewIndicator: {
    marginRight: 12,
  },
  gradientStrip: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeIcon: {
    fontSize: 16,
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeButtonCheckmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  browseThemesButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 16,
  },
  browseThemesButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  browseThemesArrow: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterButtonText: {
    color: '#888888',
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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 8,
    minWidth: 180,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    position: 'absolute',
  },
  quickActionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});

export default ThemeSelectionScreen;
