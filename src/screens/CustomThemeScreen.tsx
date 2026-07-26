import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  PanResponder,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import WheelColorPickerModal from '../components/WheelColorPickerModal';
import HapticService from '../services/HapticService';
import ThemePreview from '../components/ThemePreview';
import { saveThemes, getThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';

interface CustomThemeScreenProps {
  navigation: any;
  route?: {
    params?: {};
  };
}

const CustomThemeScreen: React.FC<CustomThemeScreenProps> = ({ navigation, route }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [themeName, setThemeName] = useState('');
  const [baseBackground, setBaseBackground] = useState('#000000');
  const [baseText, setBaseText] = useState('#FFFFFF');
  const [baseLink, setBaseLink] = useState('#228B22');
  const [brightness, setBrightness] = useState(100); // 0-200, 100 = no change
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorToEdit, setColorToEdit] = useState<{
    type: 'background' | 'text' | 'link';
    value: string;
  } | null>(null);
  const sliderRef = useRef({ width: 280 });
  const brightnessAnim = useRef(new Animated.Value(100)).current;

  // Apply brightness to base colors to get display colors
  const applyBrightness = (color: string, brightnessValue: number): string => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Brightness multiplier: 0 = black, 100 = original, 200 = white
    const multiplier = brightnessValue / 100;
    
    const newR = Math.min(255, Math.max(0, Math.round(r * multiplier)));
    const newG = Math.min(255, Math.max(0, Math.round(g * multiplier)));
    const newB = Math.min(255, Math.max(0, Math.round(b * multiplier)));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  const background = applyBrightness(baseBackground, brightness);
  const text = applyBrightness(baseText, brightness);
  const link = applyBrightness(baseLink, brightness);

  const openColorPicker = (type: 'background' | 'text' | 'link', currentColor: string) => {
    setColorToEdit({ type, value: currentColor });
    setColorPickerVisible(true);
  };

  const handleColorSelect = (selectedColor: string) => {
    if (!colorToEdit) return;

    if (colorToEdit.type === 'background') {
      setBaseBackground(selectedColor);
    } else if (colorToEdit.type === 'text') {
      setBaseText(selectedColor);
    } else if (colorToEdit.type === 'link') {
      setBaseLink(selectedColor);
    }

    setColorPickerVisible(false);
    setColorToEdit(null);
  };

  const handleSaveTheme = async () => {
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

      // Create new custom theme (save base colors, brightness is applied at runtime)
      const newTheme = {
        id: `custom-${Date.now()}`,
        name: themeName.trim(),
        background: baseBackground,
        text: baseText,
        link: baseLink,
        type: 'safari' as const,
      };

      // Add to custom themes array
      const updatedCustomThemes = [...customThemes, newTheme];

      // Apply to Safari theme (use current display colors with brightness applied)
      const newThemeData = {
        ...currentData,
        customThemes: updatedCustomThemes,
        globalTheme: {
          enabled: currentData?.globalTheme?.enabled ?? true,
          background,
          text,
          link,
          backgroundType: 'color',
          backgroundImage: null,
        },
      };

      await saveThemes(newThemeData);
      Alert.alert(
        'Theme Saved',
        'Your custom theme has been saved and applied to Safari.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('CustomThemesList'),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    }
  };

  const getColorLabel = (type: string) => {
    switch (type) {
      case 'background':
        return 'Background';
      case 'text':
        return 'Text';
      case 'link':
        return 'Link';
      default:
        return '';
    }
  };

  useEffect(() => {
    brightnessAnim.setValue(brightness);
  }, []);

  const handleBrightnessChange = (newValue: number) => {
    const clampedValue = Math.max(0, Math.min(200, newValue));
    setBrightness(clampedValue);
    brightnessAnim.setValue(clampedValue);
  };

  const createSliderPanResponder = (type: 'brightness') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => false,
      
      onPanResponderGrant: (evt) => {
        if (type === 'brightness') {
          HapticService.light();
          const sliderWidth = sliderRef.current.width || 280;
          const x = evt.nativeEvent.locationX;
          const newValue = Math.max(0, Math.min(200, (x / sliderWidth) * 200));
          handleBrightnessChange(newValue);
        }
      },
      onPanResponderMove: (evt) => {
        if (type === 'brightness') {
          const sliderWidth = sliderRef.current.width || 280;
          const x = evt.nativeEvent.locationX;
          const newValue = Math.max(0, Math.min(200, (x / sliderWidth) * 200));
          handleBrightnessChange(newValue);
        }
      },
      onPanResponderRelease: () => {
        // Optional: add release feedback
      },
    }).panHandlers;
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
        <Text style={[styles.label, { color: textColor }]}>Theme Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: sectionBgColor, borderColor, color: textColor }]}
          placeholder="Enter theme name"
          placeholderTextColor={textColor === '#FFFFFF' ? '#666' : '#999'}
          value={themeName}
          onChangeText={setThemeName}
        />

        <Text style={[styles.sectionTitle, { color: textColor }]}>Preview</Text>
        <ThemePreview
          background={background}
          text={text}
          link={link}
        />

        <Text style={[styles.sectionTitle, { color: textColor }]}>Colors</Text>

        <View style={styles.colorSection}>
          <View style={styles.colorRow}>
            <View style={styles.colorRowLeft}>
              <Text style={[styles.colorLabel, { color: textColor }]}>Background</Text>
              <Text style={[styles.colorHint, { color: textColor === '#FFFFFF' ? '#888888' : '#666666' }]}>Tap to change</Text>
            </View>
            <TouchableOpacity
              style={[styles.colorPill, { backgroundColor: sectionBgColor, borderColor }]}
              onPress={() => openColorPicker('background', baseBackground)}
              activeOpacity={0.7}
            >
              <View style={[styles.colorPillPreview, { backgroundColor: background }]} />
              <Text style={[styles.colorPillValue, { color: textColor }]}>{background}</Text>
              <Ionicons name="chevron-forward" size={16} color={appThemeColor} style={styles.chevron} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.colorSection}>
          <View style={styles.colorRow}>
            <View style={styles.colorRowLeft}>
              <Text style={[styles.colorLabel, { color: textColor }]}>Text</Text>
              <Text style={[styles.colorHint, { color: textColor === '#FFFFFF' ? '#888888' : '#666666' }]}>Tap to change</Text>
            </View>
            <TouchableOpacity
              style={[styles.colorPill, { backgroundColor: sectionBgColor, borderColor }]}
              onPress={() => openColorPicker('text', baseText)}
              activeOpacity={0.7}
            >
              <View style={[styles.colorPillPreview, { backgroundColor: text }]} />
              <Text style={[styles.colorPillValue, { color: textColor }]}>{text}</Text>
              <Ionicons name="chevron-forward" size={16} color={appThemeColor} style={styles.chevron} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.colorSection}>
          <View style={styles.colorRow}>
            <View style={styles.colorRowLeft}>
              <Text style={[styles.colorLabel, { color: textColor }]}>Link</Text>
              <Text style={[styles.colorHint, { color: textColor === '#FFFFFF' ? '#888888' : '#666666' }]}>Tap to change</Text>
            </View>
            <TouchableOpacity
              style={[styles.colorPill, { backgroundColor: sectionBgColor, borderColor }]}
              onPress={() => openColorPicker('link', baseLink)}
              activeOpacity={0.7}
            >
              <View style={[styles.colorPillPreview, { backgroundColor: link }]} />
              <Text style={[styles.colorPillValue, { color: textColor }]}>{link}</Text>
              <Ionicons name="chevron-forward" size={16} color={appThemeColor} style={styles.chevron} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Images</Text>
        
        <View style={styles.sliderSection}>
          <Text style={[styles.sliderLabel, { color: textColor }]}>Brightness</Text>
          <View style={styles.sliderContainer}>
            <View 
              style={[styles.sliderTrackWrapper, { backgroundColor: textColor === '#FFFFFF' ? '#333' : '#CCC' }]}
              onLayout={(e) => {
                const width = e.nativeEvent.layout.width;
                if (width > 0) {
                  sliderRef.current.width = width;
                }
              }}
              {...createSliderPanResponder('brightness')}
            >
              <Animated.View 
                style={[
                  styles.sliderTrack, 
                  { backgroundColor: textColor === '#FFFFFF' ? '#333' : '#CCC' }
                ]}
              >
                <Animated.View 
                  style={[
                    styles.sliderFill, 
                    { 
                      width: brightnessAnim.interpolate({
                        inputRange: [0, 200],
                        outputRange: ['0%', '100%'],
                      }),
                      backgroundColor: appThemeColor 
                    }
                  ]} 
                />
                <Animated.View
                  style={[
                    styles.sliderThumb,
                    {
                      left: brightnessAnim.interpolate({
                        inputRange: [0, 200],
                        outputRange: ['0%', '100%'],
                      }),
                      transform: [{
                        translateX: brightnessAnim.interpolate({
                          inputRange: [0, 200],
                          outputRange: [-12, -12],
                        }),
                      }],
                      borderColor: appThemeColor,
                    },
                  ]}
                />
              </Animated.View>
            </View>
            <View style={styles.sliderButtons}>
              <TouchableOpacity
                style={[styles.sliderButton, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => handleBrightnessChange(brightness - 5)}
              >
                <Text style={[styles.sliderButtonText, { color: textColor }]}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sliderButton, { backgroundColor: sectionBgColor, borderColor }]}
                onPress={() => handleBrightnessChange(brightness + 5)}
              >
                <Text style={[styles.sliderButtonText, { color: textColor }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <WheelColorPickerModal
        visible={colorPickerVisible}
        initialColor={colorToEdit?.value || '#000000'}
        onColorSelect={handleColorSelect}
        onClose={() => {
          setColorPickerVisible(false);
          setColorToEdit(null);
        }}
        title={colorToEdit ? `Select ${getColorLabel(colorToEdit.type)} Color` : 'Select Color'}
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
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 16,
  },
  colorSection: {
    marginBottom: 20,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  colorLabel: {
    fontSize: 16,
    marginBottom: 4,
    fontWeight: '600',
  },
  colorHint: {
    fontSize: 13,
  },
  colorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 8,
  },
  colorPillPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
  },
  colorPillValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  chevron: {
    marginLeft: 4,
  },
  colorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
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
  sliderSection: {
    marginBottom: 24,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderTrackWrapper: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  sliderTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 2,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    position: 'absolute',
    top: -8,
    marginLeft: -10,
  },
  sliderButtons: {
    flexDirection: 'column',
    gap: 4,
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sliderButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CustomThemeScreen;
