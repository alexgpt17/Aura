import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { saveThemes, getThemes, hasPurchasedCustomThemes } from '../storage';
import { useAppTheme } from '../contexts/AppThemeContext';

interface CustomThemesListScreenProps {
  navigation: any;
  route?: {
    params?: {
      forKeyboard?: boolean;
    };
  };
}

interface CustomTheme {
  id: string;
  name: string;
  background: string;
  text: string;
  link: string;
  keyColor?: string;
}

const MAX_CUSTOM_THEMES = 5;

const CustomThemesListScreen: React.FC<CustomThemesListScreenProps> = ({ navigation, route }) => {
  const { appThemeColor } = useAppTheme();
  const forKeyboard = route?.params?.forKeyboard || false;
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    loadCustomThemes();
    loadCurrentTheme();
    checkPurchaseStatus();
  }, []);

  const checkPurchaseStatus = async () => {
    const purchased = await hasPurchasedCustomThemes();
    setHasPurchased(purchased);
  };

  // Reload when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadCustomThemes();
      loadCurrentTheme();
    });
    return unsubscribe;
  }, [navigation]);

  const loadCustomThemes = async () => {
    try {
      const themeData = await getThemes();
      if (themeData?.customThemes) {
        setCustomThemes(themeData.customThemes || []);
      }
    } catch (error) {
      console.error('Error loading custom themes:', error);
    }
  };

  const loadCurrentTheme = async () => {
    try {
      const themeData = await getThemes();
      const current = forKeyboard ? themeData?.keyboardTheme : themeData?.globalTheme;
      if (current) {
        const loadedCustomThemes = themeData?.customThemes || [];
        // Check if current theme matches any custom theme
        const matchingCustom = loadedCustomThemes.find(
          (theme: CustomTheme) =>
            theme.background === current.background &&
            theme.text === current.text &&
            theme.link === current.link
        );
        if (matchingCustom) {
          setSelectedThemeId(matchingCustom.id);
        }
      }
    } catch (error) {
      console.error('Error loading current theme:', error);
    }
  };

  const handleSelectTheme = async (theme: CustomTheme) => {
    try {
      const currentData = await getThemes();
      if (forKeyboard) {
        // Apply to keyboard theme
        const newThemeData = {
          ...currentData,
          keyboardTheme: {
            enabled: currentData?.keyboardTheme?.enabled ?? true,
            background: theme.background,
            text: theme.text,
            link: theme.link,
            keyColor: theme.keyColor || '#2a2a2a',
            backgroundType: 'color',
            backgroundImage: null,
          },
        };
        await saveThemes(newThemeData);
        Alert.alert('Theme Applied', `${theme.name} theme has been applied to keyboard.`);
      } else {
        // Apply to Safari theme
        const newThemeData = {
          ...currentData,
          globalTheme: {
            enabled: currentData?.globalTheme?.enabled ?? true,
            background: theme.background,
            text: theme.text,
            link: theme.link,
            backgroundType: 'color',
            backgroundImage: null,
          },
        };
        await saveThemes(newThemeData);
        Alert.alert('Theme Applied', `${theme.name} theme has been applied to Safari.`);
      }
      setSelectedThemeId(theme.id);
    } catch (error) {
      console.error('Error applying theme:', error);
      Alert.alert('Error', 'Failed to apply theme. Please try again.');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    Alert.alert(
      'Delete Theme',
      'Are you sure you want to delete this theme?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const currentData = await getThemes();
              const updatedCustomThemes = (currentData?.customThemes || []).filter(
                (theme: CustomTheme) => theme.id !== themeId
              );
              const newThemeData = {
                ...currentData,
                customThemes: updatedCustomThemes,
              };
              await saveThemes(newThemeData);
              setCustomThemes(updatedCustomThemes);
              if (selectedThemeId === themeId) {
                setSelectedThemeId(null);
              }
            } catch (error) {
              console.error('Error deleting theme:', error);
              Alert.alert('Error', 'Failed to delete theme. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Generate placeholders if we have less than MAX_CUSTOM_THEMES
  const placeholdersNeeded = Math.max(0, MAX_CUSTOM_THEMES - customThemes.length);
  const allItems = [
    ...customThemes,
    ...Array(placeholdersNeeded).fill(null).map((_, index) => ({ id: `placeholder-${index}`, isPlaceholder: true })),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: appThemeColor }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Themes</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Create Theme Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => {
            if (hasPurchased) {
              if (forKeyboard) {
                navigation.navigate('CustomKeyboardTheme');
              } else {
                navigation.navigate('CustomTheme', { forKeyboard });
              }
            } else {
              navigation.navigate('Purchase', {
                onPurchaseComplete: () => {
                  checkPurchaseStatus();
                  if (forKeyboard) {
                    navigation.navigate('CustomKeyboardTheme');
                  } else {
                    navigation.navigate('CustomTheme', { forKeyboard });
                  }
                },
              });
            }
          }}
        >
          <Text style={[styles.createButtonText, { color: appThemeColor }]}>
            {hasPurchased ? 'Create Theme' : 'Unlock Custom Themes'}
          </Text>
        </TouchableOpacity>

        {/* Your Themes List */}
        {allItems.length > 0 && (
          <View style={styles.themesList}>
            {allItems.map((item) => {
              if (item.isPlaceholder) {
                return (
                  <View key={item.id} style={styles.placeholderButton}>
                    <Text style={styles.placeholderText}>Empty slot</Text>
                  </View>
                );
              }

              const theme = item as CustomTheme;
              const isSelected = selectedThemeId === theme.id;

              return (
                <TouchableOpacity
                  key={theme.id}
                  style={[styles.themeButton, isSelected && [styles.themeButtonSelected, { borderColor: appThemeColor }]]}
                  onPress={() => handleSelectTheme(theme)}
                  onLongPress={() => handleDeleteTheme(theme.id)}
                >
                  <View style={styles.themeButtonContent}>
                    <View
                      style={[
                        styles.themeColorIndicator,
                        { backgroundColor: theme.background },
                      ]}
                    />
                    <Text
                      style={[
                        styles.themeButtonText,
                        { color: theme.text },
                        isSelected && styles.themeButtonTextSelected,
                      ]}
                    >
                      {theme.name}
                    </Text>
                  </View>
                  {isSelected && (
                    <Text style={styles.themeButtonCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {allItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No custom themes yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Tap "Create Theme" to create your first custom theme.
            </Text>
          </View>
        )}
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
  createButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  themesList: {
    marginBottom: 20,
  },
  themeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  themeButtonSelected: {
    borderColor: '#228B22',
    backgroundColor: '#1a2a1a',
  },
  themeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  themeColorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  themeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  themeButtonTextSelected: {
    // Color is set dynamically from theme.text
  },
  themeButtonCheckmark: {
    color: '#228B22',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholderButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  placeholderText: {
    color: '#888888',
    fontSize: 16,
    fontStyle: 'italic',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CustomThemesListScreen;
