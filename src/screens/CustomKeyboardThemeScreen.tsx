import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import SimpleColorPickerModal from '../components/SimpleColorPickerModal';
import { saveThemes, getThemes, hasPurchasedCustomThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import { AURA_PRESETS } from './AuraPresetsScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface CustomKeyboardThemeScreenProps {
  navigation: any;
  route?: {
    params?: {
      creatingAura?: boolean;
      returnTo?: string;
      returnParams?: any;
    };
  };
}

const CustomKeyboardThemeScreen: React.FC<CustomKeyboardThemeScreenProps> = ({ navigation, route }) => {
  const creatingAura = route?.params?.creatingAura || false;
  const returnTo = route?.params?.returnTo;
  const returnParams = route?.params?.returnParams || {};
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [themeName, setThemeName] = useState('');
  const [background, setBackground] = useState('#000000');
  const [text, setText] = useState('#FFFFFF');
  const [link, setLink] = useState('#228B22');
  const [keyColor, setKeyColor] = useState('#2a2a2a');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorToEdit, setColorToEdit] = useState<{
    type: 'background' | 'text' | 'link' | 'keyColor';
    value: string;
  } | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);

  // Helper function to parse hex color to RGB (defined early for use in calculations)
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const num = parseInt(hex.replace('#', ''), 16);
    return {
      r: (num >> 16) & 0xFF,
      g: (num >> 8) & 0xFF,
      b: num & 0xFF,
    };
  };

  // Calculate shade increment from difference between keyColor and background
  const calculateShadeIncrement = (keyColor: string, background: string): number => {
    const keyRgb = hexToRgb(keyColor);
    const bgRgb = hexToRgb(background);
    
    const rDiff = Math.abs(keyRgb.r - bgRgb.r);
    const gDiff = Math.abs(keyRgb.g - bgRgb.g);
    const bDiff = Math.abs(keyRgb.b - bgRgb.b);
    
    const avgDiff = Math.round((rDiff + gDiff + bDiff) / 3);
    
    // If no difference, use default increment
    if (avgDiff === 0) {
      return 15;
    }
    
    // Use the difference as the increment, but ensure it's at least 5 and at most 30
    return Math.max(5, Math.min(30, avgDiff));
  };

  // Check if can go lighter (toward white)
  const canGoLighter = (color: string, increment: number): boolean => {
    const rgb = hexToRgb(color);
    // Can go lighter if at least one component can be increased without hitting 255
    return (rgb.r < 255 && rgb.r + increment <= 255) || 
           (rgb.g < 255 && rgb.g + increment <= 255) || 
           (rgb.b < 255 && rgb.b + increment <= 255);
  };

  // Check if can go darker (toward black)
  const canGoDarker = (color: string, increment: number): boolean => {
    const rgb = hexToRgb(color);
    // Can go darker if at least one component can be decreased without hitting 0
    return (rgb.r > 0 && rgb.r - increment >= 0) || 
           (rgb.g > 0 && rgb.g - increment >= 0) || 
           (rgb.b > 0 && rgb.b - increment >= 0);
  };

  // Calculate shade increment and disabled states using useMemo
  const shadeIncrement = useMemo(() => calculateShadeIncrement(keyColor, background), [keyColor, background]);
  const canLighter = useMemo(() => canGoLighter(keyColor, shadeIncrement), [keyColor, shadeIncrement]);
  const canDarker = useMemo(() => canGoDarker(keyColor, shadeIncrement), [keyColor, shadeIncrement]);

  useEffect(() => {
    loadCurrentTheme();
    checkPurchaseStatus();
  }, []);

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      
      // If creating Aura, don't load defaults
      if (creatingAura) {
        return;
      }
      
      // If there's an existing keyboard theme, use it
      if (themeData?.keyboardTheme && themeData.keyboardTheme.background) {
        setBackground(themeData.keyboardTheme.background);
        setText(themeData.keyboardTheme.text || '#FFFFFF');
        setLink(themeData.keyboardTheme.link || '#228B22');
        setKeyColor(themeData.keyboardTheme.keyColor || '#2a2a2a');
      } else {
        // No existing theme - use Aura preset defaults
        const auraPreset = AURA_PRESETS.find(p => p.id === 'aura');
        if (auraPreset) {
          setBackground(auraPreset.keyboardTheme.background);
          setText(auraPreset.keyboardTheme.text);
          setLink(auraPreset.keyboardTheme.link);
          setKeyColor(auraPreset.keyboardTheme.keyColor || '#2a2a2a');
        }
      }
    } catch (error) {
      console.error('Error loading current keyboard theme:', error);
    }
  };

  const checkPurchaseStatus = async () => {
    const purchased = await hasPurchasedCustomThemes();
    setHasPurchased(purchased);
    
    if (!purchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom keyboard themes requires a one-time purchase of $4.99.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Purchase',
            onPress: () => {
              navigation.navigate('Purchase', {
                onPurchaseComplete: () => {
                  checkPurchaseStatus();
                },
              });
            },
          },
        ]
      );
    }
  };

  const openColorPicker = (type: 'background' | 'text' | 'link' | 'keyColor', currentColor: string) => {
    setColorToEdit({ type, value: currentColor });
    setColorPickerVisible(true);
  };

  const handleColorSelect = (selectedColor: string) => {
    if (!colorToEdit) return;

    if (colorToEdit.type === 'background') {
      setBackground(selectedColor);
    } else if (colorToEdit.type === 'text') {
      setText(selectedColor);
    } else if (colorToEdit.type === 'link') {
      setLink(selectedColor);
    } else if (colorToEdit.type === 'keyColor') {
      setKeyColor(selectedColor);
    }

    setColorPickerVisible(false);
    setColorToEdit(null);
  };

  const handleSaveTheme = async () => {
    if (!hasPurchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom keyboard themes requires a one-time purchase of $4.99.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Purchase',
            onPress: () => {
              navigation.navigate('Purchase', {
                onPurchaseComplete: () => {
                  checkPurchaseStatus();
                },
              });
            },
          },
        ]
      );
      return;
    }

    // If creating Aura, navigate back to CreateAuraFlow with updated theme data
    // Using navigate instead of goBack to ensure we update the existing screen
    if (creatingAura && returnTo) {
      // Navigate to the return screen with updated params
      // React Navigation will update the existing screen if it's in the stack
      navigation.navigate(returnTo, {
        ...returnParams,
        keyboardTheme: {
          background,
          text,
          link,
          keyColor,
        },
      });
      return;
    }

    // Check if theme name is provided (when not creating Aura)
    if (!themeName.trim()) {
      Alert.alert('Error', 'Please enter a theme name.');
      return;
    }

    try {
      const currentData = await getThemes();
      const customThemes = currentData?.customThemes || [];
      
      // Check if we've reached the maximum
      if (customThemes.length >= 5) {
        Alert.alert('Error', 'You can only save up to 5 custom themes. Please delete one first.');
        return;
      }

      // Create new custom theme
      const newTheme = {
        id: `custom-${Date.now()}`,
        name: themeName.trim(),
        background,
        text,
        link,
        keyColor,
        type: 'keyboard' as const,
      };

      // Add to custom themes array
      const updatedCustomThemes = [...customThemes, newTheme];

      // Save theme to custom themes list (don't auto-apply)
      const newThemeData = {
        ...currentData,
        customThemes: updatedCustomThemes,
      };

      await saveThemes(newThemeData);
      Alert.alert(
        'Theme Saved',
        'Your custom keyboard theme has been saved.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset navigation stack to MainTabs, then navigate to CustomThemesList
              // This ensures back button from CustomThemesList goes to Keyboard screen (inside MainTabs)
              const state = navigation.getState();
              const routes = state.routes;
              
              // Find MainTabs in the stack
              const mainTabsIndex = routes.findIndex(route => route.name === 'MainTabs');
              
              if (mainTabsIndex >= 0) {
                // Get the MainTabs route to preserve its state
                const mainTabsRoute = routes[mainTabsIndex];
                
                // Reset to MainTabs, then navigate to CustomThemesList
                // This creates a stack: MainTabs -> CustomThemesList
                navigation.reset({
                  index: 0,
                  routes: [
                    mainTabsRoute,
                    {
                      name: 'CustomThemesList',
                      params: { forKeyboard: true },
                    },
                  ],
                });
              } else {
                // Fallback: navigate to MainTabs first, then CustomThemesList
                navigation.navigate('MainTabs');
                setTimeout(() => {
                  navigation.navigate('CustomThemesList', { forKeyboard: true });
                }, 100);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving keyboard theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    }
  };

  // Helper function to convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  // Helper function to lighten a hex color
  const lightenColor = (hex: string, increment: number): string => {
    const rgb = hexToRgb(hex);
    const r = Math.min(255, rgb.r + increment);
    const g = Math.min(255, rgb.g + increment);
    const b = Math.min(255, rgb.b + increment);
    return rgbToHex(r, g, b);
  };

  // Helper function to darken a hex color
  const darkenColor = (hex: string, increment: number): string => {
    const rgb = hexToRgb(hex);
    const r = Math.max(0, rgb.r - increment);
    const g = Math.max(0, rgb.g - increment);
    const b = Math.max(0, rgb.b - increment);
    return rgbToHex(r, g, b);
  };

  const getColorLabel = (type: string) => {
    switch (type) {
      case 'background':
        return 'Keyboard Background';
      case 'text':
        return 'Key Text Color';
      case 'link':
        return 'Return Key Color';
      default:
        return '';
    }
  };


  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Theme</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleSaveTheme}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!creatingAura && (
          <View style={styles.nameSection}>
            <Text style={[styles.colorLabel, { color: textColor }]}>Theme Name</Text>
            <TextInput
              style={[styles.nameInput, { backgroundColor: sectionBgColor, borderColor, color: textColor }]}
              placeholder="Enter theme name"
              placeholderTextColor={textColor === '#FFFFFF' ? '#666' : '#999'}
              value={themeName}
              onChangeText={setThemeName}
              autoFocus={false}
            />
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Preview</Text>
        <View style={[styles.previewBox, { backgroundColor: background }]}>
          <View style={styles.keyboardPreview}>
            {/* Top row */}
            <View style={styles.keyboardRow}>
              {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key, index) => (
                <View
                  key={index}
                  style={[
                    styles.keyboardKey,
                    { backgroundColor: keyColor, borderColor: text + '40' },
                  ]}
                >
                  <Text style={[styles.keyboardKeyText, { color: text }]}>{key}</Text>
                </View>
              ))}
            </View>
            {/* Middle row */}
            <View style={styles.keyboardRow}>
              {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key, index) => (
                <View
                  key={index}
                  style={[
                    styles.keyboardKey,
                    { backgroundColor: keyColor, borderColor: text + '40' },
                  ]}
                >
                  <Text style={[styles.keyboardKeyText, { color: text }]}>{key}</Text>
                </View>
              ))}
            </View>
            {/* Bottom row */}
            <View style={styles.keyboardRow}>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 10 }]}>⇧</Text>
              </View>
              {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key, index) => (
                <View
                  key={index}
                  style={[
                    styles.keyboardKey,
                    { backgroundColor: keyColor, borderColor: text + '40' },
                  ]}
                >
                  <Text style={[styles.keyboardKeyText, { color: text }]}>{key}</Text>
                </View>
              ))}
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 12 }]}>⌫</Text>
              </View>
            </View>
            {/* Bottom row - 123, Emoji, Space, Return */}
            <View style={styles.keyboardRow}>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 12 }]}>123</Text>
              </View>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                  styles.emojiKeyContainer,
                ]}
              >
                <Ionicons name="happy-outline" size={16} color={text} />
              </View>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpaceKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 12 }]}>space</Text>
              </View>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: link, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: '#FFFFFF', fontSize: 12 }]}>return</Text>
              </View>
            </View>
          </View>
        </View>
        
        <Text style={[styles.sectionTitle, { color: textColor }]}>Keyboard Colors</Text>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Keyboard Background</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('background', background)}
          >
            <View style={[styles.colorPreview, { backgroundColor: background }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{background}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Key Color</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('keyColor', keyColor)}
          >
            <View style={[styles.colorPreview, { backgroundColor: keyColor }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{keyColor}</Text>
            <TouchableOpacity
              style={[styles.autoShadeButton, !canDarker && styles.autoShadeButtonDisabled]}
              onPress={(e) => {
                e.stopPropagation();
                if (canDarker) {
                  const darker = darkenColor(keyColor, shadeIncrement);
                  setKeyColor(darker);
                }
              }}
              disabled={!canDarker}
            >
              <Ionicons name="remove" size={16} color={canDarker ? appThemeColor : (textColor === '#FFFFFF' ? '#666' : '#999')} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.autoShadeButton, !canLighter && styles.autoShadeButtonDisabled]}
              onPress={(e) => {
                e.stopPropagation();
                if (canLighter) {
                  const lighter = lightenColor(keyColor, shadeIncrement);
                  setKeyColor(lighter);
                }
              }}
              disabled={!canLighter}
            >
              <Ionicons name="add" size={16} color={canLighter ? appThemeColor : (textColor === '#FFFFFF' ? '#666' : '#999')} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Key Text Color</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('text', text)}
          >
            <View style={[styles.colorPreview, { backgroundColor: text }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{text}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Return Key Color</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('link', link)}
          >
            <View style={[styles.colorPreview, { backgroundColor: link }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{link}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SimpleColorPickerModal
        visible={colorPickerVisible}
        initialColor={colorToEdit?.value || '#000000'}
        onColorSelect={handleColorSelect}
        onClose={() => {
          setColorPickerVisible(false);
          setColorToEdit(null);
        }}
        title={colorToEdit ? `Select ${getColorLabel(colorToEdit.type)}` : 'Select Color'}
      />
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 16,
  },
  nameSection: {
    marginBottom: 24,
  },
  nameInput: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  colorSection: {
    marginBottom: 20,
  },
  colorLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  colorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  autoShadeButton: {
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoShadeButtonDisabled: {
    opacity: 0.5,
  },
  autoShadeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorPreview: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  colorValue: {
    fontSize: 16,
    fontFamily: 'monospace',
  },
  previewBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    minHeight: 180,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#333',
  },
  keyboardPreview: {
    padding: 6,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 3,
    gap: 3,
  },
  keyboardKey: {
    minWidth: 24,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  keyboardSpecialKey: {
    minWidth: 28,
  },
  keyboardSpaceKey: {
    flex: 1,
    maxWidth: 100,
    minWidth: 60,
  },
  keyboardKeyText: {
    fontSize: 10,
    fontWeight: '500',
  },
  emojiKeyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CustomKeyboardThemeScreen;
