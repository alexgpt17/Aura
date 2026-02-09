import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';

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

  const selectedOption = COLOR_OPTIONS.find(opt => opt.color === selectedColor) || COLOR_OPTIONS[0];

  const handleSelect = (color: string) => {
    onColorSelect(color);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.dropdownContent}>
          <View style={[styles.colorPreview, { backgroundColor: selectedOption.color }]} />
          <Text style={styles.dropdownText}>{selectedOption.name}</Text>
        </View>
        <Text style={styles.arrow}>▼</Text>
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select App Color</Text>
            <FlatList
              data={COLOR_OPTIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.colorOption,
                    selectedColor === item.color && styles.colorOptionSelected,
                  ]}
                  onPress={() => handleSelect(item.color)}
                >
                  <View style={[styles.colorPreview, { backgroundColor: item.color }]} />
                  <Text style={styles.colorOptionText}>{item.name}</Text>
                  {selectedColor === item.color && (
                    <Text style={styles.checkmark}>✓</Text>
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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
    color: '#FFFFFF',
  },
  arrow: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    backgroundColor: '#0a0a0a',
  },
  colorOptionSelected: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  colorOptionText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    color: '#228B22',
    fontWeight: 'bold',
  },
});

export default ColorPickerDropdown;
