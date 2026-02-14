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

interface SimpleColorPickerModalProps {
  visible: boolean;
  initialColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  title: string;
}

// Helper function to validate hex color
const isValidHex = (hex: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
};

// Helper function to normalize hex color (ensure # and uppercase)
const normalizeHex = (hex: string): string => {
  let normalized = hex.replace('#', '').toUpperCase();
  if (normalized.length === 3) {
    // Expand shorthand hex (e.g., #FFF -> #FFFFFF)
    normalized = normalized.split('').map(c => c + c).join('');
  }
  return '#' + normalized;
};

// Preset colors - common theme colors
const PRESET_COLORS = [
  // Grays and neutrals
  '#000000', '#1A1A1A', '#2A2A2A', '#333333', '#4A4A4A',
  '#666666', '#808080', '#999999', '#CCCCCC', '#FFFFFF',
  // Primary colors
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  // Common theme colors
  '#228B22', // Forest green
  '#1E90FF', // Dodger blue
  '#FF6347', // Tomato
  '#FFD700', // Gold
  '#9B59B6', // Purple
  '#FF69B4', // Hot pink
  '#00CED1', // Dark turquoise
  '#FFA500', // Orange
  '#8B4513', // Saddle brown
  '#2F4F4F', // Dark slate gray
  '#DC143C', // Crimson
  '#32CD32', // Lime green
  '#4169E1', // Royal blue
  '#FF1493', // Deep pink
  '#00FA9A', // Medium spring green
];

const SimpleColorPickerModal: React.FC<SimpleColorPickerModalProps> = ({
  visible,
  initialColor,
  onColorSelect,
  onClose,
  title,
}) => {
  const [hexInput, setHexInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (visible) {
      const normalized = normalizeHex(initialColor);
      setSelectedColor(normalized);
      setHexInput(normalized);
      setIsValid(true);
    }
  }, [visible, initialColor]);

  const handleHexChange = (value: string) => {
    // Remove # if present
    let cleanValue = value.replace('#', '').toUpperCase();
    
    // Only allow hex characters, max 6
    if (/^[0-9A-F]{0,6}$/.test(cleanValue)) {
      setHexInput('#' + cleanValue);
      
      // Validate if we have 3 or 6 characters
      if (cleanValue.length === 3 || cleanValue.length === 6) {
        const fullHex = cleanValue.length === 3
          ? '#' + cleanValue.split('').map(c => c + c).join('')
          : '#' + cleanValue;
        
        if (isValidHex(fullHex)) {
          setSelectedColor(fullHex);
          setIsValid(true);
        } else {
          setIsValid(false);
        }
      } else {
        setIsValid(false);
      }
    }
  };

  const handlePresetSelect = (color: string) => {
    const normalized = normalizeHex(color);
    setSelectedColor(normalized);
    setHexInput(normalized);
    setIsValid(true);
  };

  const handleConfirm = () => {
    if (isValid && isValidHex(selectedColor)) {
      onColorSelect(selectedColor);
      onClose();
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
            {/* Large Color Preview */}
            <View style={styles.previewSection}>
              <View 
                style={[
                  styles.colorPreview, 
                  { backgroundColor: isValid ? selectedColor : '#000000' },
                  !isValid && styles.invalidPreview
                ]} 
              />
              <Text style={styles.colorHex}>
                {isValid ? selectedColor : 'Invalid Color'}
              </Text>
            </View>

            {/* Hex Input */}
            <View style={styles.hexSection}>
              <Text style={styles.sectionLabel}>Hex Code</Text>
              <TextInput
                style={[
                  styles.hexInput,
                  !isValid && styles.hexInputInvalid
                ]}
                value={hexInput}
                onChangeText={handleHexChange}
                placeholder="#000000"
                placeholderTextColor="#666"
                maxLength={7}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {!isValid && (
                <Text style={styles.errorText}>Please enter a valid hex color</Text>
              )}
            </View>

            {/* Preset Colors */}
            <View style={styles.presetSection}>
              <Text style={styles.sectionLabel}>Preset Colors</Text>
              <View style={styles.presetGrid}>
                {PRESET_COLORS.map((color, index) => {
                  const normalized = normalizeHex(color);
                  const isSelected = normalized === selectedColor;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.presetColor,
                        { backgroundColor: color },
                        isSelected && styles.presetColorSelected,
                      ]}
                      onPress={() => handlePresetSelect(color)}
                    >
                      {isSelected && (
                        <View style={styles.checkmark}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.confirmButton,
                !isValid && styles.confirmButtonDisabled
              ]} 
              onPress={handleConfirm}
              disabled={!isValid}
            >
              <Text style={[
                styles.confirmButtonText,
                !isValid && styles.confirmButtonTextDisabled
              ]}>
                Select
              </Text>
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
  invalidPreview: {
    borderColor: '#FF4444',
    opacity: 0.5,
  },
  colorHex: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  hexSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
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
  hexInputInvalid: {
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  presetSection: {
    marginBottom: 24,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetColor: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetColorSelected: {
    borderColor: '#228B22',
    borderWidth: 3,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
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
  confirmButtonDisabled: {
    backgroundColor: '#2a2a2a',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonTextDisabled: {
    color: '#666666',
  },
});

export default SimpleColorPickerModal;
