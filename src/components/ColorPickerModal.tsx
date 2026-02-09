import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';

interface ColorPickerModalProps {
  visible: boolean;
  initialColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  title: string;
}

// Helper function to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

// Helper function to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// Helper function to convert RGB to HSV
const rgbToHsv = (r: number, g: number, b: number): { h: number; s: number; v: number } => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }
  }

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return { h: h * 360, s: s * 100, v: v * 100 };
};

// Helper function to convert HSV to RGB
const hsvToRgb = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
  h = (h % 360) / 360;
  s = s / 100;
  v = v / 100;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
    default: r = 0; g = 0; b = 0;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

// Helper function to generate color square gradient
const getColorSquareStyle = (hue: number, brightness: number) => {
  // Create a linear gradient effect using multiple colors
  // This is a simplified version - in a real implementation, you'd use a proper gradient
  // For now, we'll use a combination approach
  return {
    backgroundColor: `hsl(${hue}, 100%, ${brightness}%)`,
  };
};

// Preset colors for quick selection
const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#FFC0CB', '#A52A2A', '#808080', '#228B22', '#1E90FF',
  '#FFD700', '#FF6347', '#40E0D0', '#EE82EE', '#F0E68C',
];

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  visible,
  initialColor,
  onColorSelect,
  onClose,
  title,
}) => {
  const [rgb, setRgb] = useState({ r: 0, g: 0, b: 0 });
  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 0 });
  const [hex, setHex] = useState('#000000');
  const [colorSquareSize, setColorSquareSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (visible) {
      const rgbValue = hexToRgb(initialColor);
      setRgb(rgbValue);
      const hsvValue = rgbToHsv(rgbValue.r, rgbValue.g, rgbValue.b);
      setHsv(hsvValue);
      setHex(initialColor.toUpperCase());
    }
  }, [visible, initialColor]);

  const updateColorFromRgb = (newRgb: { r: number; g: number; b: number }) => {
    setRgb(newRgb);
    const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
    setHsv(newHsv);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHex(newHex.toUpperCase());
  };

  const updateColorFromHsv = (newHsv: { h: number; s: number; v: number }) => {
    setHsv(newHsv);
    const newRgb = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    setRgb(newRgb);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHex(newHex.toUpperCase());
  };

  const handleColorSquarePress = (event: any) => {
    if (colorSquareSize.width === 0 || colorSquareSize.height === 0) return;
    
    const { locationX, locationY } = event.nativeEvent;
    const saturation = Math.max(0, Math.min(100, (locationX / colorSquareSize.width) * 100));
    const value = Math.max(0, Math.min(100, 100 - (locationY / colorSquareSize.height) * 100));
    
    const newHsv = { ...hsv, s: saturation, v: value };
    updateColorFromHsv(newHsv);
  };

  const handleBrightnessSliderPress = (event: any) => {
    const locationX = event.nativeEvent.locationX;
    // Get the width from the layout if available, otherwise estimate
    const sliderWidth = 200; // Will be updated by onLayout if needed
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newValue = percentage * 100;
    
    const newHsv = { ...hsv, v: newValue };
    updateColorFromHsv(newHsv);
  };

  const handleHueSliderPress = (event: any) => {
    const sliderHeight = 200; // Hue slider height
    const locationY = event.nativeEvent.locationY;
    const percentage = Math.max(0, Math.min(1, locationY / sliderHeight));
    const newHue = percentage * 360;
    
    const newHsv = { ...hsv, h: newHue };
    updateColorFromHsv(newHsv);
  };

  const handleHexChange = (value: string) => {
    // Remove # if present
    const cleanValue = value.replace('#', '').toUpperCase();
    
    // Only allow hex characters
    if (/^[0-9A-F]{0,6}$/.test(cleanValue)) {
      setHex('#' + cleanValue);
      
      // Update RGB and HSV if we have a valid 6-character hex
      if (cleanValue.length === 6) {
        const rgbValue = hexToRgb('#' + cleanValue);
        updateColorFromRgb(rgbValue);
      }
    }
  };

  const handlePresetSelect = (color: string) => {
    const rgbValue = hexToRgb(color);
    updateColorFromRgb(rgbValue);
  };

  const handleConfirm = () => {
    onColorSelect(hex);
    onClose();
  };

  const currentColor = rgbToHex(rgb.r, rgb.g, rgb.b);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Large Color Preview */}
            <View style={styles.previewSection}>
              <View style={[styles.colorPreview, { backgroundColor: currentColor }]} />
              <Text style={styles.colorHex}>{currentColor}</Text>
            </View>

            {/* Color Square Picker */}
            <View style={styles.colorPickerSection}>
              <Text style={styles.sectionLabel}>Color Picker</Text>
              <View style={styles.colorPickerContainer}>
                {/* Color Square (Saturation/Value) */}
                <TouchableOpacity
                  style={styles.colorSquareContainer}
                  onPress={handleColorSquarePress}
                  activeOpacity={1}
                >
                  <View
                    style={styles.colorSquare}
                    onLayout={(e) => {
                      const { width, height } = e.nativeEvent.layout;
                      setColorSquareSize({ width, height });
                    }}
                  >
                    {/* Base: Full saturation color at current hue */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                        },
                      ]}
                    />
                    {/* White to transparent gradient (top to bottom) for value */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: `rgba(255, 255, 255, ${1 - hsv.v / 100})`,
                        },
                      ]}
                    />
                    {/* Black to transparent gradient (bottom to top) for value */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: `rgba(0, 0, 0, ${(100 - hsv.v) / 100})`,
                        },
                      ]}
                    />
                    {/* Gray overlay for saturation (left to right) */}
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: `rgba(128, 128, 128, ${1 - hsv.s / 100})`,
                        },
                      ]}
                    />
                    {/* Selection indicator */}
                    <View
                      style={[
                        styles.colorSquareIndicator,
                        {
                          left: `${hsv.s}%`,
                          top: `${100 - hsv.v}%`,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                {/* Hue Slider (right side) */}
                <TouchableOpacity
                  style={styles.hueSliderContainer}
                  onPress={handleHueSliderPress}
                  activeOpacity={1}
                >
                  <View style={styles.hueSlider}>
                    {[0, 60, 120, 180, 240, 300, 360].map((hue, index) => (
                      <View
                        key={index}
                        style={[
                          styles.hueSliderSegment,
                          { backgroundColor: `hsl(${hue}, 100%, 50%)` },
                        ]}
                      />
                    ))}
                    <View
                      style={[
                        styles.hueSliderIndicator,
                        { top: `${(hsv.h / 360) * 100}%` },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Brightness Slider (below color square) */}
              <View style={styles.brightnessContainer}>
                <Text style={styles.brightnessLabel}>Brightness</Text>
                <TouchableOpacity
                  style={styles.brightnessSlider}
                  onPress={handleBrightnessSliderPress}
                  activeOpacity={1}
                >
                  <View style={styles.brightnessTrack}>
                    {/* Left half: black to color */}
                    <View
                      style={[
                        styles.brightnessLeftHalf,
                        {
                          backgroundColor: `hsl(${hsv.h}, ${hsv.s}%, 50%)`,
                        },
                      ]}
                    />
                    {/* Right half: color to white */}
                    <View
                      style={[
                        styles.brightnessRightHalf,
                        {
                          backgroundColor: `hsl(${hsv.h}, ${hsv.s}%, 50%)`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.brightnessIndicator,
                        { left: `${hsv.v}%` },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hex Input */}
            <View style={styles.hexSection}>
              <Text style={styles.sectionLabel}>Hex Code</Text>
              <TextInput
                style={styles.hexInput}
                value={hex}
                onChangeText={handleHexChange}
                placeholder="#000000"
                placeholderTextColor="#666"
                maxLength={7}
                autoCapitalize="characters"
              />
            </View>

            {/* Preset Colors */}
            <View style={styles.presetSection}>
              <Text style={styles.sectionLabel}>Preset Colors</Text>
              <View style={styles.presetGrid}>
                {PRESET_COLORS.map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.presetColor,
                      { backgroundColor: color },
                      currentColor.toUpperCase() === color.toUpperCase() && styles.presetColorSelected,
                    ]}
                    onPress={() => handlePresetSelect(color)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Select</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    maxHeight: 500,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  colorPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#333',
    marginBottom: 12,
  },
  colorHex: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  colorPickerSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  colorPickerContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  colorSquareContainer: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#333',
  },
  colorSquare: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  colorSquareIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    position: 'absolute',
    marginLeft: -12,
    marginTop: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  hueSliderContainer: {
    width: 30,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#333',
  },
  hueSlider: {
    width: '100%',
    height: '100%',
    position: 'relative',
    flexDirection: 'column',
  },
  hueSliderSegment: {
    flex: 1,
  },
  hueSliderIndicator: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#228B22',
    borderRadius: 2,
    marginTop: -2,
  },
  brightnessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brightnessLabel: {
    width: 80,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  brightnessSlider: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  brightnessTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  brightnessLeftHalf: {
    flex: 1,
    height: '100%',
    backgroundColor: '#000000',
  },
  brightnessRightHalf: {
    flex: 1,
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  brightnessIndicator: {
    position: 'absolute',
    top: -9,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#228B22',
    marginLeft: -12,
  },
  hexSection: {
    marginBottom: 24,
  },
  hexInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  presetSection: {
    marginBottom: 24,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetColor: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetColorSelected: {
    borderColor: '#228B22',
    borderWidth: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#228B22',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ColorPickerModal;
