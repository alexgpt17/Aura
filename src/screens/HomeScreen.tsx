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
import GearIcon from '../components/GearIcon';
import { useAppTheme } from '../contexts/AppThemeContext';
import { AURA_PRESETS } from './AuraPresetsScreen';

interface HomeScreenProps {
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

// All available themes for matching
const ALL_THEMES: Theme[] = [
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
  {
    id: 'sepia',
    name: 'Sepia',
    background: '#F1EADF',
    text: '#4A3F35',
    link: '#006A71',
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    background: '#1E1E1E',
    text: '#E0E0E0',
    link: '#BB86FC',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: '#0a0e27',
    text: '#6c5ce7',
    link: '#6c5ce7',
  },
  {
    id: 'chroma',
    name: 'Chroma',
    background: '#1a1a2e',
    text: '#f0f0f0',
    link: '#ff6b6b',
  },
  {
    id: 'neon',
    name: 'Neon',
    background: '#1A0033',
    text: '#CCFF00',
    link: '#FF00FF',
  },
  {
    id: 'aura',
    name: 'Aura',
    background: '#000000',
    text: '#228B22',
    link: '#1B5E20',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    background: '#121212',
    text: '#FFFFFF',
    link: '#1E90FF',
  },
  {
    id: 'light',
    name: 'Light Mode',
    background: '#FFFFFF',
    text: '#000000',
    link: '#0066CC',
  },
];

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { appThemeColor } = useAppTheme();
  const [safariTheme, setSafariTheme] = useState<Theme | null>(null);
  const [keyboardTheme, setKeyboardTheme] = useState<Theme | null>(null);

  useEffect(() => {
    loadCurrentThemes();
  }, []);

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCurrentThemes();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCurrentThemes = async () => {
    try {
      const themeData = await getThemes();
      
      // Load Safari theme
      if (themeData?.globalTheme) {
        const safari = themeData.globalTheme;
        
        // First check if it's an Aura preset (by presetId or by matching colors)
        let matchingPreset = null;
        if (safari.presetId) {
          matchingPreset = AURA_PRESETS.find(p => p.id === safari.presetId);
        } else {
          matchingPreset = AURA_PRESETS.find(
            (preset) =>
              preset.safariTheme.background === safari.background &&
              preset.safariTheme.text === safari.text &&
              preset.safariTheme.link === safari.link
          );
        }
        
        if (matchingPreset) {
          setSafariTheme({
            id: matchingPreset.id,
            name: matchingPreset.name,
            background: matchingPreset.safariTheme.background,
            text: matchingPreset.safariTheme.text,
            link: matchingPreset.safariTheme.link,
          });
        } else {
          // Check against ALL_THEMES
          const matchingTheme = ALL_THEMES.find(
            (theme) => {
              // First, check for exact gradient match (for monochrome/noir)
              if (safari.backgroundType === 'gradient' && theme.backgroundType === 'gradient') {
                return safari.backgroundGradient === theme.backgroundGradient &&
                       theme.text === safari.text &&
                       theme.link === safari.link;
              }
              // For regular themes, match by background, text, and link colors
              // Only match if both are NOT gradients
              if (safari.backgroundType !== 'gradient' && theme.backgroundType !== 'gradient') {
                return (
                  theme.background === safari.background &&
                  theme.text === safari.text &&
                  theme.link === safari.link
                );
              }
              return false;
            }
          );
          if (matchingTheme) {
            setSafariTheme(matchingTheme);
          } else {
            setSafariTheme({
              id: 'custom',
              name: 'Custom',
              background: safari.background || '#000000',
              text: safari.text || '#ffffff',
              link: safari.link || '#228B22',
            });
          }
        }
      }

      // Load Keyboard theme
      if (themeData?.keyboardTheme) {
        const keyboard = themeData.keyboardTheme;
        
        // First check if it's an Aura preset (by presetId or by matching colors)
        let matchingPreset = null;
        if (keyboard.presetId) {
          matchingPreset = AURA_PRESETS.find(p => p.id === keyboard.presetId);
        } else {
          matchingPreset = AURA_PRESETS.find(
            (preset) =>
              preset.keyboardTheme.background === keyboard.background &&
              preset.keyboardTheme.text === keyboard.text &&
              preset.keyboardTheme.link === keyboard.link
          );
        }
        
        if (matchingPreset) {
          setKeyboardTheme({
            id: matchingPreset.id,
            name: matchingPreset.name,
            background: matchingPreset.keyboardTheme.background,
            text: matchingPreset.keyboardTheme.text,
            link: matchingPreset.keyboardTheme.link,
          });
        } else {
          // Check against ALL_THEMES
          const matchingTheme = ALL_THEMES.find(
            (theme) =>
              theme.background === keyboard.background &&
              theme.text === keyboard.text &&
              theme.link === keyboard.link
          );
          if (matchingTheme) {
            setKeyboardTheme(matchingTheme);
          } else {
            setKeyboardTheme({
              id: 'custom',
              name: 'Custom',
              background: keyboard.background || '#000000',
              text: keyboard.text || '#ffffff',
              link: keyboard.link || '#228B22',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading current themes:', error);
    }
  };


  const getThemeById = (themeId: string): Theme | null => {
    return ALL_THEMES.find((t) => t.id === themeId) || null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Aura</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <GearIcon size={24} color={appThemeColor} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Current Safari Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safari Theme</Text>
          {safariTheme ? (
            <TouchableOpacity
              style={[
                styles.themeCard,
                { backgroundColor: safariTheme.background },
              ]}
              onPress={() => navigation.navigate('ThemeSelection')}
            >
              <View style={styles.themeInfo}>
                <Text style={[styles.themeName, { color: safariTheme.text }]}>
                  {safariTheme.name}
                </Text>
                <Text style={[styles.themeSubtext, { color: safariTheme.text }]}>
                  Tap to change
                </Text>
              </View>
              <Text
                style={[
                  styles.arrow,
                  { color: safariTheme.link || appThemeColor },
                ]}
              >
                →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.themeCard}
              onPress={() => navigation.navigate('ThemeSelection')}
            >
              <View style={styles.themeInfo}>
                <Text style={styles.themeName}>No theme selected</Text>
                <Text style={styles.themeSubtext}>Tap to select a theme</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Current Keyboard Theme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Keyboard Theme</Text>
          {keyboardTheme ? (
            <TouchableOpacity
              style={[
                styles.themeCard,
                { backgroundColor: keyboardTheme.background },
              ]}
              onPress={() => navigation.navigate('ThemeSelection', { forKeyboard: true })}
            >
              <View style={styles.themeInfo}>
                <Text style={[styles.themeName, { color: keyboardTheme.text }]}>
                  {keyboardTheme.name}
                </Text>
                <Text style={[styles.themeSubtext, { color: keyboardTheme.text }]}>
                  Tap to change
                </Text>
              </View>
              <Text
                style={[
                  styles.arrow,
                  { color: keyboardTheme.link || appThemeColor },
                ]}
              >
                →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.themeCard}
              onPress={() => navigation.navigate('ThemeSelection', { forKeyboard: true })}
            >
              <View style={styles.themeInfo}>
                <Text style={styles.themeName}>No theme selected</Text>
                <Text style={styles.themeSubtext}>Tap to select a theme</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Aura Presets Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.auraButton}
            onPress={() => navigation.navigate('AuraPresets')}
          >
            <View style={styles.auraButtonContent}>
              <Text style={[styles.auraButtonText, { color: appThemeColor }]}>Set Aura</Text>
              <Text style={styles.auraButtonSubtext}>
                One-tap themes that apply to both Safari and Keyboard
              </Text>
            </View>
            <Text style={[styles.arrow, { color: appThemeColor }]}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 28,
    color: '#228B22',
    fontWeight: 'bold',
    lineHeight: 28,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
    lineHeight: 20,
  },
  themeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  themePreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  themePreviewText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  themeSubtext: {
    fontSize: 14,
    color: '#888888',
  },
  arrow: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recentScrollView: {
    marginTop: 12,
  },
  recentThemeCard: {
    marginRight: 12,
    alignItems: 'center',
    width: 80,
  },
  recentThemePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  recentThemePreviewText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  auraButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  auraButtonContent: {
    flex: 1,
  },
  auraButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  auraButtonSubtext: {
    fontSize: 14,
    color: '#888888',
  },
});

export default HomeScreen;
