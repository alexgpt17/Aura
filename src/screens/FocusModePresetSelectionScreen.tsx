import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { getThemes, saveThemes } from '../storage';
import FocusModeService from '../services/FocusModeService';

interface FocusModePresetSelectionScreenProps {
  navigation: any;
  route: {
    params?: {
      focusMode?: string;
    };
  };
}

// Aura Presets (same as in HomeScreen)
const AURA_PRESETS = [
  { id: 'aura', name: 'Aura' },
  { id: 'dark', name: 'Dark Mode' },
  { id: 'light', name: 'Light Mode' },
  { id: 'neon', name: 'Neon' },
];

const FocusModePresetSelectionScreen: React.FC<FocusModePresetSelectionScreenProps> = ({
  navigation,
  route,
}) => {
  const focusMode = route.params?.focusMode || 'work';
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentMapping();
  }, []);

  const loadCurrentMapping = async () => {
    try {
      const themeData = await getThemes();
      const mappings = themeData?.focusModeSettings?.mappings;
      if (mappings) {
        setSelectedPreset(mappings[focusMode as keyof typeof mappings] || null);
      }
    } catch (error) {
      console.error('Error loading Focus Mode mapping:', error);
    }
  };

  const handleSelectPreset = async (presetId: string | null) => {
    try {
      const themeData = await getThemes();
      const currentMappings = themeData?.focusModeSettings?.mappings || {
        work: null,
        sleep: null,
        personal: null,
        doNotDisturb: null,
      };

      const newMappings = {
        ...currentMappings,
        [focusMode]: presetId,
      };

      await FocusModeService.updateSettings({
        mappings: newMappings,
      });

      setSelectedPreset(presetId);
      Alert.alert('Saved', `Preset ${presetId ? `"${presetId}"` : 'removed'} mapped to ${focusMode} Focus.`);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving Focus Mode mapping:', error);
      Alert.alert('Error', 'Failed to save mapping. Please try again.');
    }
  };

  const focusModeNames: { [key: string]: string } = {
    work: 'Work',
    sleep: 'Sleep',
    personal: 'Personal',
    doNotDisturb: 'Do Not Disturb',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>
          {focusModeNames[focusMode] || focusMode} Focus
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.description}>
          Select an Aura preset to apply when {focusModeNames[focusMode] || focusMode} Focus is active.
        </Text>

        <TouchableOpacity
          style={[
            styles.presetOption,
            selectedPreset === null && styles.presetOptionSelected,
          ]}
          onPress={() => handleSelectPreset(null)}
        >
          <Text style={styles.presetOptionText}>None (No auto-apply)</Text>
          {selectedPreset === null && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        {AURA_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.presetOption,
              selectedPreset === preset.id && styles.presetOptionSelected,
            ]}
            onPress={() => handleSelectPreset(preset.id)}
          >
            <Text style={styles.presetOptionText}>{preset.name}</Text>
            {selectedPreset === preset.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    flex: 1,
    textAlign: 'center',
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
    color: '#888888',
    marginBottom: 24,
    lineHeight: 20,
  },
  presetOption: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  presetOptionSelected: {
    borderColor: '#228B22',
    borderWidth: 2,
  },
  presetOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  checkmark: {
    fontSize: 20,
    color: '#228B22',
    fontWeight: 'bold',
  },
});

export default FocusModePresetSelectionScreen;
