import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import SimpleColorPickerModal from '../components/SimpleColorPickerModal';
import { saveThemes, getThemes, hasPurchasedCustomThemes } from '../storage';
import { PurchaseManager } from '../services/PurchaseManager';
import { useAppTheme } from '../contexts/AppThemeContext';

interface CustomThemeScreenProps {
  navigation: any;
  route?: {
    params?: {
      forKeyboard?: boolean;
      creatingAura?: boolean;
      returnTo?: string;
      returnParams?: any;
    };
  };
}

const CustomThemeScreen: React.FC<CustomThemeScreenProps> = ({ navigation, route }) => {
  const forKeyboard = route?.params?.forKeyboard || false;
  const creatingAura = route?.params?.creatingAura || false;
  const returnTo = route?.params?.returnTo;
  const returnParams = route?.params?.returnParams || {};
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [themeName, setThemeName] = useState('');
  const [background, setBackground] = useState('#000000');
  const [text, setText] = useState('#FFFFFF');
  const [link, setLink] = useState('#228B22');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorToEdit, setColorToEdit] = useState<{
    type: 'background' | 'text' | 'link';
    value: string;
  } | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    checkPurchaseStatus();
  }, []);

  const checkPurchaseStatus = async () => {
    const purchased = await hasPurchasedCustomThemes();
    setHasPurchased(purchased);
    
    if (!purchased) {
      // Redirect to purchase screen if not purchased
      Alert.alert(
        'Purchase Required',
        'Creating custom themes requires a one-time purchase of $4.99.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Purchase',
            onPress: () => {
              navigation.navigate('Purchase', {
                onPurchaseComplete: () => {
                  checkPurchaseStatus();
                },
              });
            },
          },
        ]
      );
    }
  };

  const openColorPicker = (type: 'background' | 'text' | 'link', currentColor: string) => {
    setColorToEdit({ type, value: currentColor });
    setColorPickerVisible(true);
  };

  const handleColorSelect = (selectedColor: string) => {
    if (!colorToEdit) return;

    if (colorToEdit.type === 'background') {
      setBackground(selectedColor);
    } else if (colorToEdit.type === 'text') {
      setText(selectedColor);
    } else if (colorToEdit.type === 'link') {
      setLink(selectedColor);
    }

    setColorPickerVisible(false);
    setColorToEdit(null);
  };

  const handleSaveTheme = async () => {
    if (!hasPurchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom themes requires a one-time purchase of $4.99.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Purchase',
            onPress: () => {
              navigation.navigate('Purchase', {
                onPurchaseComplete: () => {
                  checkPurchaseStatus();
                },
              });
            },
          },
        ]
      );
      return;
    }

    // If creating Aura, navigate back to CreateAuraFlow with updated theme data
    // Using navigate instead of goBack to ensure we update the existing screen
    if (creatingAura && returnTo) {
      // Navigate to the return screen with updated params
      // React Navigation will update the existing screen if it's in the stack
      navigation.navigate(returnTo, {
        ...returnParams,
        safariTheme: {
          background,
          text,
          link,
        },
      });
      return;
    }

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

      // Create new custom theme
      const newTheme = {
        id: `custom-${Date.now()}`,
        name: themeName.trim(),
        background,
        text,
        link,
        keyColor: forKeyboard ? '#2a2a2a' : undefined, // Only include keyColor for keyboard themes
        type: (forKeyboard ? 'keyboard' : 'safari') as const,
      };

      // Add to custom themes array
      const updatedCustomThemes = [...customThemes, newTheme];

      // Apply theme based on context (keyboard or Safari)
      const newThemeData = {
        ...currentData,
        customThemes: updatedCustomThemes,
      };

      if (forKeyboard) {
        // Apply to keyboard theme
        newThemeData.keyboardTheme = {
          enabled: currentData?.keyboardTheme?.enabled ?? true,
          background,
          text,
          link,
          keyColor: '#2a2a2a', // Default key color
          backgroundType: 'color',
          backgroundImage: null,
        };
      } else {
        // Apply to Safari theme
        newThemeData.globalTheme = {
          enabled: currentData?.globalTheme?.enabled ?? true,
          background,
          text,
          link,
          backgroundType: 'color',
          backgroundImage: null,
        };
      }

      await saveThemes(newThemeData);
      Alert.alert(
        'Theme Saved',
        `Your custom theme has been saved and applied to ${forKeyboard ? 'keyboard' : 'Safari'}.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('CustomThemesList', { forKeyboard }),
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
        {!creatingAura && (
          <>
            <Text style={[styles.label, { color: textColor }]}>Theme Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: sectionBgColor, borderColor, color: textColor }]}
              placeholder="Enter theme name"
              placeholderTextColor={textColor === '#FFFFFF' ? '#666' : '#999'}
              value={themeName}
              onChangeText={setThemeName}
            />
          </>
        )}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Preview</Text>
        <View style={[styles.previewBox, { backgroundColor: background }]}>
          <Text style={[styles.previewText, { color: text }]}>
            This is how your text will look
          </Text>
          <Text style={[styles.previewLink, { color: link }]}>
            This is how links will appear
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Colors</Text>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Background</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('background', background)}
          >
            <View style={[styles.colorPreview, { backgroundColor: background }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{background}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Text</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('text', text)}
          >
            <View style={[styles.colorPreview, { backgroundColor: text }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{text}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={[styles.colorLabel, { color: textColor }]}>Link</Text>
          <TouchableOpacity
            style={[styles.colorButton, { backgroundColor: sectionBgColor, borderColor }]}
            onPress={() => openColorPicker('link', link)}
          >
            <View style={[styles.colorPreview, { backgroundColor: link }]} />
            <Text style={[styles.colorValue, { color: textColor }]}>{link}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SimpleColorPickerModal
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
  colorLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
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
  previewBox: {
    borderRadius: 12,
    padding: 20,
    marginTop: 8,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewText: {
    fontSize: 16,
    marginBottom: 12,
  },
  previewLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
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
