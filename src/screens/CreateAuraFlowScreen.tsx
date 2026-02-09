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
import { useAppTheme } from '../contexts/AppThemeContext';
import { hasPurchasedCustomThemes, saveAuraPreset } from '../storage';

interface CreateAuraFlowScreenProps {
  navigation: any;
  route?: {
    params?: {
      safariTheme?: {
        background: string;
        text: string;
        link: string;
      };
      keyboardTheme?: {
        background: string;
        text: string;
        link: string;
        keyColor?: string;
      };
    };
  };
}

type Step = 'safari' | 'keyboard' | 'name';

const CreateAuraFlowScreen: React.FC<CreateAuraFlowScreenProps> = ({ navigation, route }) => {
  const { appThemeColor } = useAppTheme();
  const [currentStep, setCurrentStep] = useState<Step>('safari');
  const [hasPurchased, setHasPurchased] = useState(false);
  const [safariTheme, setSafariTheme] = useState<{
    background: string;
    text: string;
    link: string;
  } | null>(route?.params?.safariTheme || null);
  const [keyboardTheme, setKeyboardTheme] = useState<{
    background: string;
    text: string;
    link: string;
    keyColor?: string;
  } | null>(route?.params?.keyboardTheme || null);
  const [auraName, setAuraName] = useState('');

  useEffect(() => {
    checkPurchaseStatus();
    // Initialize from route params on mount
    const params = route?.params;
    if (params) {
      if (params.safariTheme) {
        setSafariTheme(params.safariTheme);
      }
      if (params.keyboardTheme) {
        setKeyboardTheme(params.keyboardTheme);
      }
      // Determine current step based on what we have
      if (params.safariTheme && params.keyboardTheme) {
        setCurrentStep('name');
      } else if (params.safariTheme) {
        setCurrentStep('keyboard');
      }
    }
  }, []);

  // Listen for navigation focus to get updated params
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = route?.params;
      if (params) {
        // If we have both themes from route params, go to name step
        if (params.safariTheme && params.keyboardTheme) {
          setSafariTheme(params.safariTheme);
          setKeyboardTheme(params.keyboardTheme);
          setCurrentStep('name');
        } else if (params.safariTheme) {
          setSafariTheme(params.safariTheme);
          setCurrentStep('keyboard');
        } else if (params.keyboardTheme) {
          setKeyboardTheme(params.keyboardTheme);
          if (safariTheme) {
            setCurrentStep('name');
          }
        }
      }
    });
    return unsubscribe;
  }, [navigation, route?.params, safariTheme]);

  const checkPurchaseStatus = async () => {
    const purchased = await hasPurchasedCustomThemes();
    setHasPurchased(purchased);
    
    if (!purchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom Aura presets requires a one-time purchase of $4.99.',
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
                onPurchaseComplete: async () => {
                  const purchased = await hasPurchasedCustomThemes();
                  setHasPurchased(purchased);
                },
              });
            },
          },
        ]
      );
    }
  };


  const handleFinish = async () => {
    if (!hasPurchased) {
      Alert.alert(
        'Purchase Required',
        'Creating custom Aura presets requires a one-time purchase of $4.99.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Purchase',
            onPress: () => {
              navigation.navigate('Purchase', {
                onPurchaseComplete: async () => {
                  const purchased = await hasPurchasedCustomThemes();
                  setHasPurchased(purchased);
                },
              });
            },
          },
        ]
      );
      return;
    }

    if (!auraName.trim()) {
      Alert.alert('Error', 'Please enter a name for your Aura preset.');
      return;
    }

    if (!safariTheme || !keyboardTheme) {
      Alert.alert('Error', 'Please complete both Safari and Keyboard theme steps.');
      return;
    }

    try {
      const preset = {
        id: `aura-custom-${Date.now()}`,
        name: auraName.trim(),
        description: 'Custom Aura preset',
        safariTheme: {
          background: safariTheme.background,
          text: safariTheme.text,
          link: safariTheme.link,
        },
        keyboardTheme: {
          background: keyboardTheme.background,
          text: keyboardTheme.text,
          link: keyboardTheme.link,
          keyColor: keyboardTheme.keyColor,
        },
        previewColor: safariTheme.background,
        isCustom: true,
      };

      await saveAuraPreset(preset);
      Alert.alert(
        'Aura Created',
        `"${auraName}" has been saved and is now available in your Aura presets.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Get the navigation state to find where AuraPresets is in the stack
              const state = navigation.getState();
              const routes = state.routes;
              
              // Find the index of AuraPresets in the routes
              const auraPresetsIndex = routes.findIndex(route => route.name === 'AuraPresets');
              
              if (auraPresetsIndex >= 0) {
                // Reset to AuraPresets, removing all screens after it (including CreateAuraFlow)
                navigation.reset({
                  index: auraPresetsIndex,
                  routes: routes.slice(0, auraPresetsIndex + 1),
                });
              } else {
                // If AuraPresets is not in the stack, just navigate to it
                // This shouldn't happen, but it's a fallback
                navigation.navigate('AuraPresets');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving Aura preset:', error);
      Alert.alert('Error', 'Failed to save Aura preset. Please try again.');
    }
  };

  const handleBack = () => {
    if (currentStep === 'keyboard') {
      setCurrentStep('safari');
    } else if (currentStep === 'name') {
      setCurrentStep('keyboard');
    } else {
      // If we're on the first step (safari), go back to AuraPresets
      // This prevents getting stuck in a loop
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('AuraPresets');
      }
    }
  };

  const handleNext = () => {
    if (currentStep === 'safari') {
      navigation.navigate('CustomTheme', {
        creatingAura: true,
        returnTo: 'CreateAuraFlow',
        returnParams: {
          safariTheme: safariTheme,
          keyboardTheme: keyboardTheme,
        },
      });
    } else if (currentStep === 'keyboard') {
      navigation.navigate('CustomKeyboardTheme', {
        creatingAura: true,
        returnTo: 'CreateAuraFlow',
        returnParams: {
          safariTheme: safariTheme,
          keyboardTheme: keyboardTheme,
        },
      });
    }
  };

  const renderStepContent = () => {
    if (currentStep === 'safari') {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Step 1: Create Safari Theme</Text>
          <Text style={styles.stepDescription}>
            Create a theme for your Safari browsing experience. This will be the first part of your Aura preset.
          </Text>
          {safariTheme && (
            <View style={styles.themePreview}>
              <Text style={styles.previewLabel}>Safari Theme Created ✓</Text>
              <View style={[styles.colorPreviewBox, { backgroundColor: safariTheme.background }]}>
                <Text style={[styles.previewText, { color: safariTheme.text }]}>Preview</Text>
                <Text style={[styles.previewLink, { color: safariTheme.link }]}>Link</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={[styles.nextButtonText, { color: appThemeColor }]}>
              {safariTheme ? 'Edit Safari Theme' : 'Create Safari Theme'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else if (currentStep === 'keyboard') {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Step 2: Create Keyboard Theme</Text>
          <Text style={styles.stepDescription}>
            Create a theme for your keyboard. This will be the second part of your Aura preset.
          </Text>
          {keyboardTheme && (
            <View style={styles.themePreview}>
              <Text style={styles.previewLabel}>Keyboard Theme Created ✓</Text>
              <View style={[styles.colorPreviewBox, { backgroundColor: keyboardTheme.background }]}>
                <Text style={[styles.previewText, { color: keyboardTheme.text }]}>Preview</Text>
                <Text style={[styles.previewLink, { color: keyboardTheme.link }]}>Return</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
          >
            <Text style={[styles.nextButtonText, { color: appThemeColor }]}>
              {keyboardTheme ? 'Edit Keyboard Theme' : 'Create Keyboard Theme'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      // Name step
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>Step 3: Name Your Aura</Text>
          <Text style={styles.stepDescription}>
            Give your Aura preset a name so you can easily identify it later.
          </Text>
          <Text style={styles.inputLabel}>Aura Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter aura name"
            placeholderTextColor="#666"
            value={auraName}
            onChangeText={setAuraName}
            autoFocus
          />
          <View style={styles.finalPreview}>
            <Text style={styles.finalPreviewLabel}>Your Aura Preview</Text>
            <View style={styles.finalPreviewContainer}>
              <View style={[styles.finalPreviewBox, { backgroundColor: safariTheme?.background || '#000' }]}>
                <Text style={[styles.finalPreviewText, { color: safariTheme?.text || '#FFF' }]}>Safari</Text>
              </View>
              <View style={[styles.finalPreviewBox, { backgroundColor: keyboardTheme?.background || '#000' }]}>
                <Text style={[styles.finalPreviewText, { color: keyboardTheme?.text || '#FFF' }]}>Keyboard</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinish}
          >
            <Text style={[styles.finishButtonText, { color: appThemeColor }]}>Finish</Text>
          </TouchableOpacity>
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Aura</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressStep, currentStep === 'safari' && styles.progressStepActive]} />
        <View style={[styles.progressStep, currentStep === 'keyboard' && styles.progressStepActive]} />
        <View style={[styles.progressStep, currentStep === 'name' && styles.progressStepActive]} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
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
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
    color: '#FFFFFF',
  },
  placeholder: {
    width: 60,
  },
  progressBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#228B22',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 24,
    lineHeight: 22,
  },
  themePreview: {
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 14,
    color: '#228B22',
    marginBottom: 8,
    fontWeight: '600',
  },
  colorPreviewBox: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewText: {
    fontSize: 16,
    marginBottom: 8,
  },
  previewLink: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  nextButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333',
  },
  finalPreview: {
    marginBottom: 24,
  },
  finalPreviewLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 12,
    fontWeight: '600',
  },
  finalPreviewContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  finalPreviewBox: {
    flex: 1,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  finalPreviewText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  finishButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreateAuraFlowScreen;
