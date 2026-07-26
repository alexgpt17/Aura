import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  PanResponder,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import HapticService from '../services/HapticService';

interface ModernColorPickerModalProps {
  visible: boolean;
  initialColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  title?: string;
}

const { width: screenWidth } = Dimensions.get('window');

// Color conversion utilities
const hexToHsv = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6;
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return { h, s: s * 100, v: v * 100 };
};

const hsvToHex = (h: number, s: number, v: number) => {
  s /= 100;
  v /= 100;

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
  else if (h >= 60 && h < 120) [r, g, b] = [x, c, 0];
  else if (h >= 120 && h < 180) [r, g, b] = [0, c, x];
  else if (h >= 180 && h < 240) [r, g, b] = [0, x, c];
  else if (h >= 240 && h < 300) [r, g, b] = [x, 0, c];
  else if (h >= 300 && h < 360) [r, g, b] = [c, 0, x];

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Quick preset colors for fast selection
const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#808080', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB',
];

const ModernColorPickerModal: React.FC<ModernColorPickerModalProps> = ({
  visible,
  initialColor,
  onColorSelect,
  onClose,
  title = 'Select Color',
}) => {
  const [hsv, setHsv] = useState(hexToHsv(initialColor));
  const [selectedColor, setSelectedColor] = useState(initialColor);
  
  // Dimensions for color square and hue strip
  const colorSquareSize = screenWidth - 100; // Leave space for hue strip and padding
  const hueStripWidth = 30;
  
  // Refs for gesture handling
  const colorSquareRef = useRef({ x: 0, y: 0, width: colorSquareSize, height: colorSquareSize });
  const hueStripRef = useRef({ x: 0, y: 0, width: hueStripWidth, height: colorSquareSize });

  useEffect(() => {
    if (visible) {
      const newHsv = hexToHsv(initialColor);
      setHsv(newHsv);
      setSelectedColor(initialColor);
    }
  }, [visible, initialColor]);

  useEffect(() => {
    const newColor = hsvToHex(hsv.h, hsv.s, hsv.v);
    setSelectedColor(newColor);
  }, [hsv]);

  // Color square PanResponder for saturation and brightness
  const colorSquarePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
    
    onPanResponderGrant: (evt) => {
      HapticService.light();
      updateColorSquare(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
    },
    onPanResponderMove: (evt, gestureState) => {
      // Use gestureState for smoother tracking during drags
      const x = evt.nativeEvent.locationX;
      const y = evt.nativeEvent.locationY;
      updateColorSquare(x, y);
    },
    onPanResponderRelease: () => {
      // Optional: add haptic feedback here
    },
  });

  // Hue strip PanResponder
  const hueStripPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => false,
    
    onPanResponderGrant: (evt) => {
      HapticService.light();
      updateHue(evt.nativeEvent.locationY);
    },
    onPanResponderMove: (evt, gestureState) => {
      // Use gestureState for smoother tracking during drags
      const y = evt.nativeEvent.locationY;
      updateHue(y);
    },
    onPanResponderRelease: () => {
      // Optional: add haptic feedback here
    },
  });

  const updateColorSquare = (x: number, y: number) => {
    const saturation = Math.max(0, Math.min(100, (x / colorSquareSize) * 100));
    const brightness = Math.max(0, Math.min(100, 100 - (y / colorSquareSize) * 100));
    setHsv(prev => ({ ...prev, s: saturation, v: brightness }));
  };

  const updateHue = (y: number) => {
    const hue = Math.max(0, Math.min(360, (y / colorSquareSize) * 360));
    setHsv(prev => ({ ...prev, h: hue }));
  };

  const handleConfirm = () => {
    HapticService.success();
    onColorSelect(selectedColor);
    onClose();
  };

  const handlePresetSelect = (color: string) => {
    HapticService.selection();
    const newHsv = hexToHsv(color);
    setHsv(newHsv);
  };

  const handleHexInput = (text: string) => {
    if (!text.startsWith('#')) {
      text = '#' + text.replace('#', '');
    }
    
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
      const newHsv = hexToHsv(text);
      setHsv(newHsv);
    } else if (text.length <= 7) {
      setSelectedColor(text.toUpperCase());
    }
  };

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
            {/* Color Preview */}
            <View style={styles.previewSection}>
              <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />
              <Text style={styles.colorHex}>{selectedColor}</Text>
            </View>

            {/* Main Color Picker Area */}
            <View style={styles.colorPickerContainer}>
              {/* Color Square (Saturation & Brightness) */}
              <View 
                style={[styles.colorSquare, { width: colorSquareSize, height: colorSquareSize }]}
                {...colorSquarePanResponder.panHandlers}
              >
                {/* Base hue background */}
                <View style={[
                  styles.colorSquareBase, 
                  { backgroundColor: hsvToHex(hsv.h, 100, 100) }
                ]} />
                
                {/* White to transparent gradient for saturation */}
                <LinearGradient
                  colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.colorSquareGradient}
                />
                
                {/* Black to transparent gradient for brightness */}
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.colorSquareGradient}
                />
                
                {/* Draggable indicator */}
                <View style={[
                  styles.colorSquareIndicator,
                  {
                    left: (hsv.s / 100) * colorSquareSize - 10,
                    top: ((100 - hsv.v) / 100) * colorSquareSize - 10,
                  }
                ]} />
              </View>

              {/* Hue Strip */}
              <View 
                style={[styles.hueStrip, { width: hueStripWidth, height: colorSquareSize }]}
                {...hueStripPanResponder.panHandlers}
              >
                {/* Smooth hue gradient */}
                <LinearGradient
                  colors={[
                    '#FF0000', '#FF8000', '#FFFF00', '#80FF00', 
                    '#00FF00', '#00FF80', '#00FFFF', '#0080FF',
                    '#0000FF', '#8000FF', '#FF00FF', '#FF0080', '#FF0000'
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.hueGradient}
                />
                
                {/* Hue indicator */}
                <View style={[
                  styles.hueIndicator,
                  {
                    top: (hsv.h / 360) * colorSquareSize - 3,
                  }
                ]} />
              </View>
            </View>

            {/* Hex Input */}
            <View style={styles.hexSection}>
              <Text style={styles.sectionLabel}>Hex Code</Text>
              <TextInput
                style={styles.hexInput}
                value={selectedColor}
                onChangeText={handleHexInput}
                placeholder="#000000"
                placeholderTextColor="#666"
                maxLength={7}
                autoCapitalize="characters"
              />
            </View>

            {/* Preset Colors */}
            <View style={styles.presetSection}>
              <Text style={styles.sectionLabel}>Quick Colors</Text>
              <View style={styles.presetGrid}>
                {PRESET_COLORS.map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.presetColor,
                      { backgroundColor: color },
                      selectedColor.toUpperCase() === color.toUpperCase() && styles.presetColorSelected,
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
    paddingTop: 20,
    paddingHorizontal: 20,
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
    maxHeight: '75%',
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#333',
    marginBottom: 8,
  },
  colorHex: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  colorPickerContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 15,
    alignItems: 'flex-start',
  },
  colorSquare: {
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  colorSquareBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  colorSquareGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  colorSquareIndicator: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  hueStrip: {
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  hueGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hueSection: {
    width: '100%',
  },
  hueIndicator: {
    position: 'absolute',
    left: -4,
    right: -4,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 6,
  },
  hexSection: {
    marginBottom: 20,
  },
  hexInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  presetSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetColor: {
    width: 44,
    height: 44,
    borderRadius: 8,
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
    marginBottom: 20,
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

export default ModernColorPickerModal;