
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  Button,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { saveTheme, getTheme } from './src/storage';

const App = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [linkColor, setLinkColor] = useState('#1E90FF');

  const [modalVisible, setModalVisible] = useState(false);
  const [currentColor, setCurrentColor] = useState('#ffffff');
  const [colorToEdit, setColorToEdit] = useState(null);

  useEffect(() => {
    const loadTheme = async () => {
      const theme = await getTheme();
      if (theme) {
        setBackgroundColor(theme.background);
        setTextColor(theme.text);
        setLinkColor(theme.link);
        setIsEnabled(theme.enabled ?? true);
      }
    };
    loadTheme();
  }, []);

  const openColorPicker = (colorType, colorValue) => {
    setColorToEdit(colorType);
    setCurrentColor(colorValue);
    setModalVisible(true);
  };

  const onColorChange = color => {
    setCurrentColor(color);
  };

  const onColorSelectDone = () => {
    if (colorToEdit === 'background') {
      setBackgroundColor(currentColor);
    } else if (colorToEdit === 'text') {
      setTextColor(currentColor);
    } else if (colorToEdit === 'link') {
      setLinkColor(currentColor);
    }
    setModalVisible(false);
  };

  const handleSave = () => {
    const theme = {
      background: backgroundColor,
      text: textColor,
      link: linkColor,
      enabled: isEnabled,
    };
    saveTheme(theme);
    Alert.alert('Theme Saved!', 'Your theme has been saved successfully.');
  };

  return (
    <View style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ColorPicker
              color={currentColor}
              onColorChangeComplete={onColorChange}
            />
            <Button title="Done" onPress={onColorSelectDone} />
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>Tint</Text>
        <Switch
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isEnabled ? '#f5dd4b' : '#f4f3f4'}
          onValueChange={() => setIsEnabled(previousState => !previousState)}
          value={isEnabled}
        />
      </View>

      <TouchableOpacity onPress={() => openColorPicker('background', backgroundColor)}>
        <View style={styles.colorPreviewContainer}>
          <Text style={styles.label}>Background:</Text>
          <View style={[styles.colorBox, { backgroundColor: backgroundColor }]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => openColorPicker('text', textColor)}>
        <View style={styles.colorPreviewContainer}>
          <Text style={styles.label}>Text:</Text>
          <View style={[styles.colorBox, { backgroundColor: textColor }]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => openColorPicker('link', linkColor)}>
        <View style={styles.colorPreviewContainer}>
          <Text style={styles.label}>Link:</Text>
          <View style={[styles.colorBox, { backgroundColor: linkColor }]} />
        </View>
      </TouchableOpacity>

      <View style={styles.spacer} />

      <Button title="Save Theme" onPress={handleSave} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    backgroundColor: '#f5f5f5',
    paddingTop: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  label: {
    fontSize: 18,
    color: '#000',
  },
  colorPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  colorBox: {
    width: 100,
    height: 40,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  spacer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
});

export default App;
