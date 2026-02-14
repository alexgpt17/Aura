import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { getThemes, saveThemes, deleteAuraPreset } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';
import KeyboardIcon from '../components/KeyboardIcon';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface AuraPresetsScreenProps {
  navigation: any;
}

interface AuraPreset {
  id: string;
  name: string;
  description: string;
  safariTheme: {
    background: string;
    text: string;
    link: string;
    backgroundType?: 'color' | 'gradient';
    backgroundGradient?: string;
  };
  keyboardTheme: {
    background: string;
    text: string;
    link: string;
    keyColor?: string;
    returnKeyColor?: string;
  };
  previewColor: string;
  isCustom?: boolean;
}

export const AURA_PRESETS: AuraPreset[] = [
  {
    id: 'aura',
    name: 'Aura',
    description: 'Forest green on black for a natural, calming feel',
    safariTheme: {
      background: '#000000',
      text: '#228B22',
      link: '#1B5E20',
    },
    keyboardTheme: {
      background: '#000000',
      text: '#32CD32',
      link: '#2E7D32',
      keyColor: '#2a2a2a',
      returnKeyColor: '#1B5E20',
    },
    previewColor: '#000000',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Classic dark theme for comfortable viewing',
    safariTheme: {
      background: '#121212',
      text: '#FFFFFF',
      link: '#1E90FF',
    },
    keyboardTheme: {
      background: '#121212',
      text: '#FFFFFF',
      link: '#4A9EFF',
      keyColor: '#2a2a2a',
      returnKeyColor: '#1E90FF',
    },
    previewColor: '#121212',
  },
  {
    id: 'light',
    name: 'Light Mode',
    description: 'Clean, bright theme for daytime use',
    safariTheme: {
      background: '#FFFFFF',
      text: '#000000',
      link: '#0066CC',
    },
    keyboardTheme: {
      background: '#FFFFFF',
      text: '#000000',
      link: '#0066CC',
      keyColor: '#E0E0E0',
      returnKeyColor: '#0066CC',
    },
    previewColor: '#FFFFFF',
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Vibrant, energetic themes for a modern feel',
    safariTheme: {
      background: '#1A0033',
      text: '#CCFF00',
      link: '#FF00FF',
    },
    keyboardTheme: {
      background: '#1A0033',
      text: '#E0FF33',
      link: '#FF33FF',
      keyColor: '#3A0066',
      returnKeyColor: '#FF00FF',
    },
    previewColor: '#1A0033',
  },
];

const AuraPresetsScreen: React.FC<AuraPresetsScreenProps> = ({ navigation }) => {
  const { appThemeColor, backgroundColor, textColor, sectionBgColor, borderColor } = useAppTheme();
  const [customPresets, setCustomPresets] = useState<AuraPreset[]>([]);

  useEffect(() => {
    loadCustomPresets();
    // Reload when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadCustomPresets();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCustomPresets = async () => {
    try {
      const themeData = await getThemes();
      setCustomPresets(themeData?.auraPresets || []);
    } catch (error) {
      console.error('Error loading custom Aura presets:', error);
    }
  };

  const handleDeletePreset = async (preset: AuraPreset) => {
    if (!preset.isCustom) {
      return; // Can't delete hardcoded presets
    }

    Alert.alert(
      'Delete Aura Preset',
      `Are you sure you want to delete "${preset.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAuraPreset(preset.id);
              await loadCustomPresets();
              Alert.alert('Deleted', `"${preset.name}" has been deleted.`);
            } catch (error) {
              console.error('Error deleting Aura preset:', error);
              Alert.alert('Error', 'Failed to delete preset. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleApplyPreset = async (preset: AuraPreset) => {
    try {
      const currentData = await getThemes();
      const newThemeData = {
        ...currentData,
        globalTheme: {
          ...currentData?.globalTheme,
          ...preset.safariTheme,
          enabled: true,
          presetId: preset.id, // Store which preset was applied
        },
        keyboardTheme: {
          ...currentData?.keyboardTheme,
          ...preset.keyboardTheme,
          enabled: true,
          presetId: preset.id, // Store which preset was applied
        },
      };
      await saveThemes(newThemeData);
      Alert.alert('Preset Applied', `${preset.name} has been applied to Safari and Keyboard.`);
      navigation.goBack();
    } catch (error) {
      console.error('Error applying Aura preset:', error);
      Alert.alert('Error', 'Failed to apply preset. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Set Aura</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.description, { color: textColor }]}>
          One-tap themes that apply to both Safari and Keyboard
        </Text>

        {/* Create Aura Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: sectionBgColor, borderColor }]}
          onPress={() => navigation.navigate('CreateAuraFlow')}
        >
          <Text style={[styles.createButtonText, { color: textColor }]}>Create Aura</Text>
          <Ionicons name="add" size={20} color={appThemeColor} />
        </TouchableOpacity>

        {/* Custom Presets - Moved to top */}
        {customPresets.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Your Auras</Text>
            {customPresets.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={[styles.presetCard, { backgroundColor: preset.previewColor }]}
                onPress={() => handleApplyPreset(preset)}
                onLongPress={() => handleDeletePreset(preset)}
              >
                <View style={styles.presetPreview}>
                  {['A', 'U', 'R', 'A'].map((letter, index) => (
                    <View
                      key={index}
                      style={[
                        styles.presetPreviewBox,
                        { backgroundColor: index < 2 ? preset.safariTheme.background : preset.keyboardTheme.background },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetPreviewText,
                          { color: index < 2 ? preset.safariTheme.text : preset.keyboardTheme.text },
                        ]}
                      >
                        {letter}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.presetHeader}>
                  <Text style={[styles.presetName, { color: preset.safariTheme.text }]}>{preset.name}</Text>
                  <View style={styles.presetIcons}>
                    <Text style={[styles.presetIcon, { color: '#666666' }]}>⌘</Text>
                    <View style={styles.presetIconContainer}>
                      <KeyboardIcon size={18} color="#666666" />
                    </View>
                  </View>
                </View>
                <Text style={[styles.presetDescription, { color: preset.safariTheme.text }]}>
                  {preset.description}
                </Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePreset(preset)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Hardcoded Presets */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Aura Presets</Text>
        {AURA_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={[styles.presetCard, { backgroundColor: preset.previewColor }]}
            onPress={() => handleApplyPreset(preset)}
          >
            <View style={styles.presetPreview}>
              {['A', 'U', 'R', 'A'].map((letter, index) => (
                <View
                  key={index}
                  style={[
                    styles.presetPreviewBox,
                    { backgroundColor: index < 2 ? preset.safariTheme.background : preset.keyboardTheme.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.presetPreviewText,
                      { color: index < 2 ? preset.safariTheme.text : preset.keyboardTheme.text },
                    ]}
                  >
                    {letter}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.presetHeader}>
              <Text style={[styles.presetName, { color: preset.safariTheme.text }]}>{preset.name}</Text>
              <View style={styles.presetIcons}>
                <Text style={[styles.presetIcon, { color: '#666666' }]}>⌘</Text>
                <View style={styles.presetIconContainer}>
                  <KeyboardIcon size={18} color="#666666" />
                </View>
              </View>
            </View>
            <Text style={[styles.presetDescription, { color: preset.safariTheme.text }]}>{preset.description}</Text>
            </TouchableOpacity>
        ))}
      </ScrollView>
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
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  presetCard: {
    width: '100%',
    minHeight: 120,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  presetPreview: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'center',
    gap: 6,
  },
  presetPreviewBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  presetPreviewText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  presetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  presetName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  presetIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  presetIcon: {
    fontSize: 18,
  },
  presetIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetDescription: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  createButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    marginBottom: 24,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonIcon: {
    // Style no longer used - replaced with Ionicons
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 16,
  },
  deleteButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AuraPresetsScreen;
