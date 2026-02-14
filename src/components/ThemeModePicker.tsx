import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ThemeModeOption {
  id: 'dark' | 'light';
  name: string;
  icon: string;
}

const THEME_MODE_OPTIONS: ThemeModeOption[] = [
  { id: 'dark', name: 'Dark Mode', icon: 'moon' },
  { id: 'light', name: 'Light Mode', icon: 'sunny' },
];

interface ThemeModePickerProps {
  selectedMode: 'dark' | 'light';
  onModeSelect: (mode: 'dark' | 'light') => void;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  sectionBgColor?: string;
}

const ThemeModePicker: React.FC<ThemeModePickerProps> = ({
  selectedMode,
  onModeSelect,
  backgroundColor = '#1a1a1a',
  textColor = '#FFFFFF',
  borderColor = '#2a2a2a',
  sectionBgColor = '#0a0a0a',
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = THEME_MODE_OPTIONS.find(opt => opt.id === selectedMode) || THEME_MODE_OPTIONS[0];

  const handleSelect = (mode: 'dark' | 'light') => {
    onModeSelect(mode);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownButton, { backgroundColor, borderColor }]}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.dropdownContent}>
          <Ionicons 
            name={selectedOption.icon} 
            size={20} 
            color={textColor}
            style={styles.icon}
          />
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
          <View style={[styles.modalContent, { backgroundColor, borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Select App Theme</Text>
            {THEME_MODE_OPTIONS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.themeOption,
                  { backgroundColor: sectionBgColor },
                  selectedMode === item.id && [styles.themeOptionSelected, { backgroundColor, borderColor }],
                ]}
                onPress={() => handleSelect(item.id)}
              >
                <Ionicons 
                  name={item.icon} 
                  size={24} 
                  color={textColor}
                  style={styles.optionIcon}
                />
                <Text style={[styles.themeOptionText, { color: textColor }]}>{item.name}</Text>
                {selectedMode === item.id && (
                  <Text style={[styles.checkmark, { color: textColor }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
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
  icon: {
    marginRight: 12,
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
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  themeOptionSelected: {
    borderWidth: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  themeOptionText: {
    fontSize: 16,
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ThemeModePicker;
