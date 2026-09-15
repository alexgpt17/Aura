import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, View, Animated } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppThemeProvider, useAppTheme } from './src/contexts/AppThemeContext';
import { hasCompletedOnboarding, setOnboardingCompleted } from './src/storage';
import SafariScreen from './src/screens/SafariScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BrowseThemesScreen from './src/screens/BrowseThemesScreen';
import CustomThemeScreen from './src/screens/CustomThemeScreen';
import CustomThemesListScreen from './src/screens/CustomThemesListScreen';
import WebsiteSettingsScreen from './src/screens/WebsiteSettingsScreen';
import ThemeSelectionScreen from './src/screens/ThemeSelectionScreen';
import ContentBlockerScreen from './src/screens/ContentBlockerScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import FocusModeScreen from './src/screens/FocusModeScreen';
import FocusModeThemeSelectionScreen from './src/screens/FocusModeThemeSelectionScreen';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
        component={SafariScreen}
        options={{
          tabBarLabel: 'Themes',
          tabBarIcon: ({ color }) => <Ionicons name="brush-outline" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="ShieldTab"
        component={ContentBlockerScreen}
        options={{
          tabBarLabel: 'Protection',
          tabBarIcon: ({ color }) => <Ionicons name="shield-outline" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={20} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const mainAppOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    if (!isLoading && !showOnboarding) {
      Animated.timing(mainAppOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, showOnboarding]);

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
    setIsTransitioning(true);
    mainAppOpacity.setValue(0);

    // Small delay to ensure onboarding overlay is visible, then fade in main app
    setTimeout(() => {
      Animated.timing(mainAppOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(async () => {
        await setOnboardingCompleted(true);
        setShowOnboarding(false);
        setIsTransitioning(false);
        mainAppOpacity.setValue(1);
      });
    }, 100);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#228B22" />
      </View>
    );
  }

  const mainAppContent = (
    <AppThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="BrowseThemes" component={BrowseThemesScreen} />
            <Stack.Screen name="CustomThemesList" component={CustomThemesListScreen} />
            <Stack.Screen name="CustomTheme" component={CustomThemeScreen} />
            <Stack.Screen name="WebsiteSettings" component={WebsiteSettingsScreen} />
            <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="FocusMode" component={FocusModeScreen} />
            <Stack.Screen name="FocusModeThemeSelection" component={FocusModeThemeSelectionScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppThemeProvider>
  );

  if (showOnboarding) {
    return (
      <AppThemeProvider>
        <SafeAreaProvider>
          <OnboardingScreen onComplete={handleOnboardingComplete} />
          {/* Pre-render main app for smooth transition */}
          {isTransitioning && (
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: mainAppOpacity,
              }}
              pointerEvents={isTransitioning ? 'auto' : 'none'}
            >
              {mainAppContent}
            </Animated.View>
          )}
        </SafeAreaProvider>
      </AppThemeProvider>
    );
  }

  return (
    <Animated.View style={{ flex: 1, opacity: mainAppOpacity }}>
      {mainAppContent}
    </Animated.View>
  );
};

export default App;
