
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
  TextInput,
  FlatList,
} from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import {
  saveTheme,
  getTheme,
  saveSiteTheme,
  getSiteThemes,
  overwriteSiteThemes,
} from './src/storage';

const App = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [linkColor, setLinkColor] = useState('#1E90FF');
  const [website, setWebsite] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [currentColor, setCurrentColor] = useState('#ffffff');
  const [colorToEdit, setColorToEdit] = useState(null);

  const [siteThemes, setSiteThemes] = useState({});

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
    const loadSiteThemes = async () => {
      const themes = await getSiteThemes();
      if (themes) {
        setSiteThemes(themes);
      }
    };
    loadTheme();
    loadSiteThemes();
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

  const applyPreset = (preset) => {
    if (preset === 'grayscale') {
      setBackgroundColor('#1E1E1E');
      setTextColor('#E0E0E0');
      setLinkColor('#BB86FC');
    } else if (preset === 'amoled') {
      setBackgroundColor('#000000');
      setTextColor('#FFFFFF');
      setLinkColor('#1E90FF');
    } else if (preset === 'sepia') {
      setBackgroundColor('#F1EADF');
      setTextColor('#4A3F35');
      setLinkColor('#006A71');
    }
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

  const handleSaveSiteSpecific = () => {
    if (!website.trim()) {
      Alert.alert('Invalid Input', 'Please enter a website domain.');
      return;
    }
    const theme = {
      background: backgroundColor,
      text: textColor,
      link: linkColor,
      enabled: true,
    };
    // Optimistically update UI
    const newSiteThemes = { ...siteThemes, [website.trim()]: theme };
    setSiteThemes(newSiteThemes);
    saveSiteTheme(website.trim(), theme);
    Alert.alert('Site Theme Saved!', `The theme has been saved for ${website.trim()}.`);
    setWebsite('');
  };

  const handleDeleteSite = (domain) => {
    const newSiteThemes = { ...siteThemes };
    delete newSiteThemes[domain];
    setSiteThemes(newSiteThemes);
    overwriteSiteThemes(newSiteThemes);
    Alert.alert('Site Theme Deleted!', `The theme for ${domain} has been deleted.`);
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

      <TextInput
        style={styles.input}
        placeholder="e.g., wikipedia.org"
        value={website}
        onChangeText={setWebsite}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Button title="Save for this Website" onPress={handleSaveSiteSpecific} />

      <View style={styles.presetContainer}>
        <TouchableOpacity style={styles.presetButton} onPress={() => applyPreset('grayscale')}>
          <Text style={styles.presetButtonText}>Grayscale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetButton} onPress={() => applyPreset('amoled')}>
          <Text style={styles.presetButtonText}>AMOLED</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetButton} onPress={() => applyPreset('sepia')}>
          <Text style={styles.presetButtonText}>Sepia</Text>
        </TouchableOpacity>
      </View>

      <Button title="Save Theme" onPress={handleSave} />

      <View style={styles.listContainer}>
        <Text style={styles.listHeader}>Site-Specific Themes</Text>
        <FlatList
          data={Object.keys(siteThemes)}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <Text style={styles.listItemText}>{item}</Text>
              <TouchableOpacity onPress={() => handleDeleteSite(item)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
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
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  presetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#DDDDDD',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  presetButtonText: {
    fontSize: 16,
    color: '#000',
  },
  listContainer: {
    marginTop: 30,
    flex: 1,
  },
  listHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 10,
  },
  listItemText: {
    fontSize: 16,
    color: '#000',
  },
  deleteButton: {
    backgroundColor: '#ff4d4d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default App;
