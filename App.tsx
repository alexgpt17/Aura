import React, { useState, useEffect } from 'react';
import { Text, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppThemeProvider, useAppTheme } from './src/contexts/AppThemeContext';
import { hasCompletedOnboarding, setOnboardingCompleted } from './src/storage';
import HomeScreen from './src/screens/HomeScreen';
import SafariScreen from './src/screens/SafariScreen';
import KeyboardScreen from './src/screens/KeyboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BrowseThemesScreen from './src/screens/BrowseThemesScreen';
import CustomThemeScreen from './src/screens/CustomThemeScreen';
import CustomKeyboardThemeScreen from './src/screens/CustomKeyboardThemeScreen';
import CustomThemesListScreen from './src/screens/CustomThemesListScreen';
import WebsiteSettingsScreen from './src/screens/WebsiteSettingsScreen';
import AppSettingsScreen from './src/screens/AppSettingsScreen';
import AppPickerScreen from './src/screens/AppPickerScreen';
import FocusModePresetSelectionScreen from './src/screens/FocusModePresetSelectionScreen';
import KeyboardIcon from './src/components/KeyboardIcon';
import AuraPresetsScreen from './src/screens/AuraPresetsScreen';
import CreateAuraFlowScreen from './src/screens/CreateAuraFlowScreen';
import PurchaseScreen from './src/screens/PurchaseScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main tab navigator
const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const { appThemeColor, backgroundColor, borderColor, textColor } = useAppTheme();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: backgroundColor,
          borderTopColor: borderColor,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 60 + Math.max(insets.bottom - 8, 0),
        },
        tabBarActiveTintColor: appThemeColor,
        tabBarInactiveTintColor: textColor === '#FFFFFF' ? '#888888' : '#666666',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⌂</Text>,
        }}
      />
      <Tab.Screen
        name="SafariTab"
        component={SafariScreen}
        options={{
          tabBarLabel: 'Safari',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⌘</Text>,
        }}
      />
      <Tab.Screen
        name="KeyboardTab"
        component={KeyboardScreen}
        options={{
          tabBarLabel: 'Keyboard',
          tabBarIcon: ({ color }) => <KeyboardIcon size={20} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const completed = await hasCompletedOnboarding();
      setShowOnboarding(!completed);
    } catch (e) {
      console.error('Error checking onboarding status:', e);
      // Show onboarding on error to be safe
      setShowOnboarding(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = async () => {
    await setOnboardingCompleted(true);
    setShowOnboarding(false);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#228B22" />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <AppThemeProvider>
        <SafeAreaProvider>
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </SafeAreaProvider>
      </AppThemeProvider>
    );
  }

  return (
    <AppThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="BrowseThemes" component={BrowseThemesScreen} />
            <Stack.Screen name="CustomThemesList" component={CustomThemesListScreen} />
            <Stack.Screen name="CustomTheme" component={CustomThemeScreen} />
            <Stack.Screen name="CustomKeyboardTheme" component={CustomKeyboardThemeScreen} />
            <Stack.Screen name="WebsiteSettings" component={WebsiteSettingsScreen} />
            <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
            <Stack.Screen name="AppPicker" component={AppPickerScreen} />
            <Stack.Screen name="FocusModePresetSelection" component={FocusModePresetSelectionScreen} />
            <Stack.Screen name="AuraPresets" component={AuraPresetsScreen} />
            <Stack.Screen name="CreateAuraFlow" component={CreateAuraFlowScreen} />
            <Stack.Screen name="Purchase" component={PurchaseScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppThemeProvider>
  );
};

export default App;
