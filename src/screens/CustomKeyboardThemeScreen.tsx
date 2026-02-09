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
import ColorPickerModal from '../components/ColorPickerModal';
import { saveThemes, getThemes, hasPurchasedCustomThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';

interface CustomKeyboardThemeScreenProps {
  navigation: any;
  route?: {
    params?: {
      creatingAura?: boolean;
      returnTo?: string;
      returnParams?: any;
    };
  };
}

const CustomKeyboardThemeScreen: React.FC<CustomKeyboardThemeScreenProps> = ({ navigation, route }) => {
  const creatingAura = route?.params?.creatingAura || false;
  const returnTo = route?.params?.returnTo;
  const returnParams = route?.params?.returnParams || {};
  const { appThemeColor } = useAppTheme();
  const [background, setBackground] = useState('#000000');
  const [text, setText] = useState('#FFFFFF');
  const [link, setLink] = useState('#228B22');
  const [keyColor, setKeyColor] = useState('#2a2a2a');
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [colorToEdit, setColorToEdit] = useState<{
    type: 'background' | 'text' | 'link' | 'keyColor';
    value: string;
  } | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    loadCurrentTheme();
    checkPurchaseStatus();
  }, []);

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.keyboardTheme) {
        setBackground(themeData.keyboardTheme.background || '#000000');
        setText(themeData.keyboardTheme.text || '#FFFFFF');
        setLink(themeData.keyboardTheme.link || '#228B22');
        setKeyColor(themeData.keyboardTheme.keyColor || '#2a2a2a');
      }
    } catch (error) {
      console.error('Error loading current keyboard theme:', error);
    }
  };

  const checkPurchaseStatus = async () => {
    const purchased = await hasPurchasedCustomThemes();
    setHasPurchased(purchased);
    
    if (!purchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom keyboard themes requires a one-time purchase of $4.99.',
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

  const openColorPicker = (type: 'background' | 'text' | 'link' | 'keyColor', currentColor: string) => {
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
    } else if (colorToEdit.type === 'keyColor') {
      setKeyColor(selectedColor);
    }

    setColorPickerVisible(false);
    setColorToEdit(null);
  };

  const handleSaveTheme = async () => {
    if (!hasPurchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom keyboard themes requires a one-time purchase of $4.99.',
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

    // If creating Aura, navigate back with theme data
    if (creatingAura && returnTo) {
      navigation.navigate(returnTo, {
        ...returnParams,
        keyboardTheme: {
          background,
          text,
          link,
        },
      });
      return;
    }

    try {
      const currentData = await getThemes();
      const newThemeData = {
        ...currentData,
        keyboardTheme: {
          enabled: currentData?.keyboardTheme?.enabled ?? true,
          background,
          text,
          link,
          backgroundType: 'color',
          backgroundImage: null,
        },
      };

      await saveThemes(newThemeData);
      Alert.alert(
        'Theme Applied',
        'Your custom keyboard theme has been applied.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving keyboard theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    }
  };

  const getColorLabel = (type: string) => {
    switch (type) {
      case 'background':
        return 'Keyboard Background';
      case 'text':
        return 'Key Text Color';
      case 'link':
        return 'Return Key Color';
      default:
        return '';
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Theme</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Keyboard Colors</Text>

        <View style={styles.colorSection}>
          <Text style={styles.colorLabel}>Keyboard Background</Text>
          <TouchableOpacity
            style={styles.colorButton}
            onPress={() => openColorPicker('background', background)}
          >
            <View style={[styles.colorPreview, { backgroundColor: background }]} />
            <Text style={styles.colorValue}>{background}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={styles.colorLabel}>Key Text Color</Text>
          <TouchableOpacity
            style={styles.colorButton}
            onPress={() => openColorPicker('text', text)}
          >
            <View style={[styles.colorPreview, { backgroundColor: text }]} />
            <Text style={styles.colorValue}>{text}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.colorSection}>
          <Text style={styles.colorLabel}>Return Key Color</Text>
          <TouchableOpacity
            style={styles.colorButton}
            onPress={() => openColorPicker('link', link)}
          >
            <View style={[styles.colorPreview, { backgroundColor: link }]} />
            <Text style={styles.colorValue}>{link}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Preview</Text>
        <View style={[styles.previewBox, { backgroundColor: background }]}>
          <View style={styles.keyboardPreview}>
            {/* Top row */}
            <View style={styles.keyboardRow}>
              {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key, index) => (
                <View
                  key={index}
                  style={[
                    styles.keyboardKey,
                    { backgroundColor: keyColor, borderColor: text + '40' },
                  ]}
                >
                  <Text style={[styles.keyboardKeyText, { color: text }]}>{key}</Text>
                </View>
              ))}
            </View>
            {/* Middle row */}
            <View style={styles.keyboardRow}>
              {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key, index) => (
                <View
                  key={index}
                  style={[
                    styles.keyboardKey,
                    { backgroundColor: keyColor, borderColor: text + '40' },
                  ]}
                >
                  <Text style={[styles.keyboardKeyText, { color: text }]}>{key}</Text>
                </View>
              ))}
            </View>
            {/* Bottom row */}
            <View style={styles.keyboardRow}>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 10 }]}>⇧</Text>
              </View>
              {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key, index) => (
                <View
                  key={index}
                  style={[
                    styles.keyboardKey,
                    { backgroundColor: keyColor, borderColor: text + '40' },
                  ]}
                >
                  <Text style={[styles.keyboardKeyText, { color: text }]}>{key}</Text>
                </View>
              ))}
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 12 }]}>⌫</Text>
              </View>
            </View>
            {/* Bottom row - 123, Emoji, Space, Return */}
            <View style={styles.keyboardRow}>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 12 }]}>123</Text>
              </View>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 10 }]}>☺</Text>
              </View>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpaceKey,
                  { backgroundColor: keyColor, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: text, fontSize: 12 }]}>space</Text>
              </View>
              <View
                style={[
                  styles.keyboardKey,
                  styles.keyboardSpecialKey,
                  { backgroundColor: link, borderColor: text + '40' },
                ]}
              >
                <Text style={[styles.keyboardKeyText, { color: '#FFFFFF', fontSize: 12 }]}>return</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveTheme}>
          <Text style={[styles.saveButtonText, { color: appThemeColor }]}>
            {creatingAura ? 'Next' : 'Apply Theme'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ColorPickerModal
        visible={colorPickerVisible}
        initialColor={colorToEdit?.value || '#000000'}
        onColorSelect={handleColorSelect}
        onClose={() => {
          setColorPickerVisible(false);
          setColorToEdit(null);
        }}
        title={colorToEdit ? `Select ${getColorLabel(colorToEdit.type)}` : 'Select Color'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    color: '#FFFFFF',
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#888888',
    marginTop: 8,
    marginBottom: 16,
  },
  colorSection: {
    marginBottom: 20,
  },
  colorLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  colorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  previewBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    minHeight: 180,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#333',
  },
  keyboardPreview: {
    padding: 6,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 3,
    gap: 3,
  },
  keyboardKey: {
    minWidth: 24,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  keyboardSpecialKey: {
    minWidth: 28,
  },
  keyboardSpaceKey: {
    flex: 1,
    maxWidth: 100,
    minWidth: 60,
  },
  keyboardKeyText: {
    fontSize: 10,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
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

export default CustomKeyboardThemeScreen;
