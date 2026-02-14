import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';

interface ColorOption {
  id: string;
  name: string;
  color: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  { id: 'green', name: 'Green', color: '#228B22' },
  { id: 'red', name: 'Red', color: '#FF4444' },
  { id: 'orange', name: 'Orange', color: '#FF8800' },
  { id: 'blue', name: 'Blue', color: '#1E90FF' },
  { id: 'purple', name: 'Purple', color: '#9B59B6' },
  { id: 'white', name: 'White', color: '#FFFFFF' },
];

interface ColorPickerDropdownProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorPickerDropdown: React.FC<ColorPickerDropdownProps> = ({
  selectedColor,
  onColorSelect,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { backgroundColor, textColor, sectionBgColor, borderColor, appThemeColor } = useAppTheme();

  const selectedOption = COLOR_OPTIONS.find(opt => opt.color === selectedColor) || COLOR_OPTIONS[0];

  const handleSelect = (color: string) => {
    onColorSelect(color);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownButton, { backgroundColor: sectionBgColor, borderColor }]}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.dropdownContent}>
          <View style={[styles.colorPreview, { backgroundColor: selectedOption.color }]} />
          <Text style={[styles.dropdownText, { color: textColor }]}>{selectedOption.name}</Text>
        </View>
        <Text style={[styles.arrow, { color: textColor }]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: sectionBgColor, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Select App Color</Text>
            <FlatList
              data={COLOR_OPTIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.colorOption,
                    { backgroundColor: backgroundColor },
                    selectedColor === item.color && [styles.colorOptionSelected, { backgroundColor: sectionBgColor, borderColor }],
                  ]}
                  onPress={() => handleSelect(item.color)}
                >
                  <View style={[styles.colorPreview, { backgroundColor: item.color }]} />
                  <Text style={[styles.colorOptionText, { color: textColor }]}>{item.name}</Text>
                  {selectedColor === item.color && (
                    <Text style={[styles.checkmark, { color: appThemeColor }]}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 12,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  colorOptionSelected: {
    borderWidth: 1,
  },
  colorOptionText: {
    fontSize: 16,
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ColorPickerDropdown;
