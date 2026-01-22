
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
  ScrollView,
} from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { saveThemes, getThemes, clearThemes } from './src/storage';

const App = () => {
  const [themeData, setThemeData] = useState({
    globalTheme: {
      enabled: true,
      background: '#FFFFFF',
      text: '#000000',
      link: '#0000EE',
      backgroundType: 'color',
      backgroundImage: null,
    },
    siteThemes: {},
  });
  
  const [website, setWebsite] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [colorToEdit, setColorToEdit] = useState(null);
  const [tempColor, setTempColor] = useState(null);

  // Load initial themes from storage
  useEffect(() => {
    const loadInitialThemes = async () => {
      console.log('Loading themes on app start...');
      try {
        const loadedData = await getThemes();
        if (loadedData) {
          setThemeData(loadedData);
          console.log('Themes loaded and set in state:', loadedData);
        } else {
          console.log('No themes found in storage, using defaults.');
        }
      } catch (error) {
        console.error('Error loading themes:', error);
        // If there's a corruption error, clear and use defaults
        if (error.message && error.message.includes('Property storage')) {
          console.log('Corruption detected, clearing storage...');
          try {
            await clearThemes();
          } catch (clearError) {
            console.error('Error clearing storage:', clearError);
          }
        }
      }
    };
    loadInitialThemes();
  }, []);

  const openColorPicker = (colorType, colorValue) => {
    setColorToEdit({ type: colorType, value: colorValue });
    setTempColor(colorValue);
    setModalVisible(true);
  };

  const handleColorChange = (newColor) => {
    setTempColor(newColor);
  };

  const handleColorSelect = async () => {
    if (!colorToEdit || !tempColor) return;

    const newThemeData = { ...themeData };
    newThemeData.globalTheme[colorToEdit.type] = tempColor;
    setThemeData(newThemeData);
    
    // Save to storage
    await saveThemes(newThemeData);

    // Close picker
    setModalVisible(false);
    setColorToEdit(null);
    setTempColor(null);
  };

  const handleCancelColorPicker = () => {
    setModalVisible(false);
    setColorToEdit(null);
    setTempColor(null);
  };

  const applyPreset = (preset) => {
    let presetTheme;
    if (preset === 'grayscale') {
      presetTheme = { background: '#1E1E1E', text: '#E0E0E0', link: '#BB86FC' };
    } else if (preset === 'amoled') {
      presetTheme = { background: '#000000', text: '#FFFFFF', link: '#1E90FF' };
    } else if (preset === 'sepia') {
      presetTheme = { background: '#F1EADF', text: '#4A3F35', link: '#006A71' };
    } else return;

    const newThemeData = { ...themeData, globalTheme: { ...themeData.globalTheme, ...presetTheme } };
    setThemeData(newThemeData);
    saveThemes(newThemeData);
    Alert.alert('Preset Applied', 'The preset has been applied to the global theme and saved.');
  };

  const handleToggleGlobalEnabled = (value) => {
    const newThemeData = { ...themeData };
    newThemeData.globalTheme.enabled = value;
    setThemeData(newThemeData);
    saveThemes(newThemeData);
  };

  const handleSaveSiteSpecific = () => {
    const domain = website.trim();
    if (!domain) {
      Alert.alert('Invalid Input', 'Please enter a website domain.');
      return;
    }

    const newThemeData = { ...themeData };
    newThemeData.siteThemes[domain] = themeData.globalTheme; // Use current global as template
    setThemeData(newThemeData);
    saveThemes(newThemeData);
    
    Alert.alert('Site Theme Saved!', `The current global theme has been saved for ${domain}.`);
    setWebsite('');
  };

  const handleDeleteSite = (domain) => {
    const newThemeData = { ...themeData };
    delete newThemeData.siteThemes[domain];
    setThemeData(newThemeData);
    saveThemes(newThemeData);
    Alert.alert('Site Theme Deleted!', `The theme for ${domain} has been deleted.`);
  };

  // Safely extract globalTheme with fallback
  const globalTheme = themeData?.globalTheme || {
    enabled: true,
    background: '#FFFFFF',
    text: '#000000',
    link: '#0000EE',
    backgroundType: 'color',
    backgroundImage: null,
  };
  const siteThemes = themeData?.siteThemes || {};

  return (
    <ScrollView style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select {colorToEdit?.type === 'background' ? 'Background' : colorToEdit?.type === 'text' ? 'Text' : 'Link'} Color
            </Text>
            <View style={styles.colorPickerContainer}>
              <ColorPicker
                color={tempColor || colorToEdit?.value}
                onColorChange={handleColorChange}
                onColorChangeComplete={handleColorChange}
                thumbSize={30}
                sliderSize={30}
                noSnap={true}
                row={false}
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handleCancelColorPicker}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={handleColorSelect}>
                <Text style={styles.modalSaveButtonText}>Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>Tint</Text>
        <Switch
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={globalTheme.enabled ? '#f5dd4b' : '#f4f3f4'}
          onValueChange={handleToggleGlobalEnabled}
          value={globalTheme.enabled}
        />
      </View>
      
      <Text style={styles.sectionHeader}>Global Theme</Text>

      <TouchableOpacity onPress={() => openColorPicker('background', globalTheme.background)}>
        <View style={styles.colorPreviewContainer}>
          <Text style={styles.label}>Background:</Text>
          <View style={[styles.colorBox, { backgroundColor: globalTheme.background }]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => openColorPicker('text', globalTheme.text)}>
        <View style={styles.colorPreviewContainer}>
          <Text style={styles.label}>Text:</Text>
          <View style={[styles.colorBox, { backgroundColor: globalTheme.text }]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => openColorPicker('link', globalTheme.link)}>
        <View style={styles.colorPreviewContainer}>
          <Text style={styles.label}>Link:</Text>
          <View style={[styles.colorBox, { backgroundColor: globalTheme.link }]} />
        </View>
      </TouchableOpacity>

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

      <TouchableOpacity style={styles.saveButton} onPress={async () => {
        await saveThemes(themeData);
        Alert.alert('Theme Saved', 'Your theme has been saved successfully.');
      }}>
        <Text style={styles.saveButtonText}>Save Theme</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.saveButton, styles.clearButton]} 
        onPress={async () => {
          Alert.alert(
            'Clear All Data',
            'This will delete all saved themes and reset to defaults. Are you sure?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                  try {
                    // Clear corrupted data and set defaults
                    await clearThemes();
                    
                    // Reset to default theme in UI
                    const defaultData = {
                      globalTheme: {
                        enabled: true,
                        background: '#FFFFFF',
                        text: '#000000',
                        link: '#0000EE',
                        backgroundType: 'color',
                        backgroundImage: null,
                      },
                      siteThemes: {},
                    };
                    setThemeData(defaultData);
                    
                    // Verify by reading back (this will auto-fix if needed)
                    const loaded = await getThemes();
                    if (loaded) {
                      setThemeData(loaded);
                    }
                    
                    Alert.alert('Success', 'All data cleared and reset to defaults.');
                  } catch (error) {
                    const errorMsg = error?.message || String(error);
                    if (errorMsg.includes('reinstall')) {
                      Alert.alert(
                        'Clear Failed', 
                        'Data is too corrupted to clear automatically. Please delete and reinstall the app to fix this.',
                        [
                          { text: 'OK' },
                          {
                            text: 'Try Again Anyway',
                            onPress: async () => {
                              // Force reset UI state even if storage failed
                              const defaultData = {
                                globalTheme: {
                                  enabled: true,
                                  background: '#FFFFFF',
                                  text: '#000000',
                                  link: '#0000EE',
                                  backgroundType: 'color',
                                  backgroundImage: null,
                                },
                                siteThemes: {},
                              };
                              setThemeData(defaultData);
                              try {
                                await saveThemes(defaultData);
                              } catch (saveError) {
                                Alert.alert('Error', 'Could not save defaults. App reinstall required.');
                              }
                            }
                          }
                        ]
                      );
                    } else {
                      Alert.alert('Error', `Failed to clear data: ${errorMsg}`);
                    }
                  }
                },
              },
            ]
          );
        }}>
        <Text style={styles.saveButtonText}>Clear All Data</Text>
      </TouchableOpacity>

      <Text style={styles.sectionHeader}>Site-Specific Themes</Text>

      <TextInput
        style={styles.input}
        placeholder="e.g., wikipedia.org"
        value={website}
        onChangeText={setWebsite}
        autoCapitalize="none"
        keyboardType="url"
      />
      <Button title="Save Current Theme for Website" onPress={handleSaveSiteSpecific} />

      <View style={styles.listContainer}>
        {Object.keys(siteThemes || {}).length > 0 ? (
          Object.keys(siteThemes).map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.listItemText}>{item}</Text>
              <TouchableOpacity onPress={() => handleDeleteSite(item)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.emptyListText}>No site-specific themes yet.</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#000',
    },
    sectionHeader: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
        paddingBottom: 5,
    },
    label: {
        fontSize: 18,
        color: '#000',
    },
    colorPreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        elevation: 1,
    },
    colorBox: {
        width: 100,
        height: 40,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ccc',
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
        padding: 20,
        width: '85%',
        alignItems: 'center',
        maxHeight: '90%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#000',
    },
    colorPickerContainer: {
        width: '100%',
        height: 300,
        marginVertical: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 20,
        gap: 10,
    },
    modalCancelButton: {
        flex: 1,
        backgroundColor: '#e0e0e0',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalSaveButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCancelButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    modalSaveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    clearButton: {
        backgroundColor: '#FF3B30',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        fontSize: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    presetContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 20,
    },
    presetButton: {
        backgroundColor: '#e9e9e9',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
    },
    presetButtonText: {
        fontSize: 16,
        color: '#333',
    },
    listContainer: {
        marginTop: 10,
        minHeight: 150, // Give the list a minimum height
    },
    emptyListText: {
        textAlign: 'center',
        color: '#888',
        marginTop: 20,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 10,
        elevation: 1,
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
