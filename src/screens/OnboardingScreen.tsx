import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import HapticService from '../services/HapticService';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface OnboardingPage {
  icon: string;
  title: string;
  description: string;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isCompleting, setIsCompleting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const pages: OnboardingPage[] = [
    {
      icon: 'color-palette-outline',
      title: 'Welcome to Aura',
      description: 'Recolor Safari with beautiful themes, custom colours, and per-site overrides — all on your device.',
    },
    {
      icon: 'extension-puzzle-outline',
      title: 'Enable the Safari Extension',
      description:
        'Aura needs its Safari extension to apply themes. Open Settings → Safari → Extensions, turn on Aura, and allow All Websites.',
    },
    {
      icon: 'brush-outline',
      title: 'Create Custom Themes',
      description: 'Design your perfect theme with the colour picker. Choose backgrounds, text, and links.',
    },
    {
      icon: 'shield-outline',
      title: 'Block Distractions',
      description: 'Optionally enable Aura’s content blocker in Protection to filter ads, trackers, and annoyances.',
    },
    {
      icon: 'checkmark-circle-outline',
      title: 'Ready to Start?',
      description: 'Pick a theme on the Themes tab, then open Safari. If pages look unchanged, double-check that the extension is enabled.',
    },
  ];

  // Per-page animation refs - create one set of animations per page
  const pageAnimations = useRef(
    pages.map(() => ({
      iconScale: new Animated.Value(0.9),
      titleOpacity: new Animated.Value(0),
      descriptionOpacity: new Animated.Value(0),
      buttonTranslateY: new Animated.Value(20),
    }))
  ).current;

  useEffect(() => {
    // Fade in animation when component first mounts
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Animate first page
    runPageIntroAnimation(0);
  }, []);

  useEffect(() => {
    // Animate page when it becomes active
    runPageIntroAnimation(currentPage);
  }, [currentPage]);

  const runPageIntroAnimation = (pageIndex: number) => {
    const anims = pageAnimations[pageIndex];
    if (!anims) return;

    // Reset values
    anims.iconScale.setValue(0.9);
    anims.titleOpacity.setValue(0);
    anims.descriptionOpacity.setValue(0);
    anims.buttonTranslateY.setValue(20);

    // Run animation sequence
    Animated.sequence([
      Animated.spring(anims.iconScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 6,
      }),
      Animated.parallel([
        Animated.timing(anims.titleOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(anims.descriptionOpacity, {
          toValue: 1,
          duration: 350,
          delay: 120,
          useNativeDriver: true,
        }),
        Animated.timing(anims.buttonTranslateY, {
          toValue: 0,
          duration: 350,
          delay: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handleScroll = (event: any) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    if (page !== currentPage && page >= 0 && page < pages.length) {
      // Light haptic feedback when page changes via swipe
      HapticService.light();
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      // Medium haptic feedback for button press
      HapticService.medium();
      const nextIndex = currentPage + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
      setCurrentPage(nextIndex);
    } else {
      handleGetStarted();
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      // Medium haptic feedback for button press
      HapticService.medium();
      const prevIndex = currentPage - 1;
      scrollViewRef.current?.scrollTo({
        x: prevIndex * width,
        animated: true,
      });
      setCurrentPage(prevIndex);
    }
  };

  const handleGetStarted = () => {
    // Success haptic feedback for completing onboarding
    HapticService.success();
    setIsCompleting(true);
    // Fade out animation before completing
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
    });
  };

  const skip = () => {
    // Light haptic feedback for skip action
    HapticService.light();
    handleGetStarted();
  };

  const goToPage = (index: number) => {
    if (index === currentPage) return;
    // Selection haptic feedback for pagination dot tap
    HapticService.selection();
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
    setCurrentPage(index);
  };

  const renderPage = (page: OnboardingPage, index: number) => {
    const isLastPage = index === pages.length - 1;
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const iconParallaxScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const anims = pageAnimations[index];
    if (!anims) return null;
    
    return (
      <View key={index} style={styles.page}>
        <View style={styles.content}>
          {/* Large Icon with gradient and depth */}
          <Animated.View
            style={[
              styles.iconContainer,
              { transform: [{ scale: Animated.multiply(anims.iconScale, iconParallaxScale) }] },
            ]}
          >
            <LinearGradient
              colors={isLastPage ? ['#228B22', '#2fa72f'] : ['#228B22', '#1a6b1a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.iconGradient, isLastPage && styles.iconGradientFinal]}
            >
              <Ionicons name={page.icon} size={isLastPage ? 48 : 40} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Animated.Text style={[styles.title, isLastPage && styles.titleFinal, { opacity: anims.titleOpacity }]}>
            {page.title}
          </Animated.Text>

          {/* Description */}
          <Animated.Text style={[styles.description, { opacity: anims.descriptionOpacity }]}>
            {page.description}
          </Animated.Text>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#000000', '#050709', '#0a0f14']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientBackground}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Skip Button */}
        <TouchableOpacity
          style={[styles.skipButton, { top: Math.max(insets.top, 20) + 16 }]}
          onPress={skip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        {/* Pages ScrollView */}
        <Animated.ScrollView
          ref={scrollViewRef as any}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          style={styles.scrollView}
          bounces={false}
        >
          {pages.map((page, index) => renderPage(page, index))}
        </Animated.ScrollView>

        {/* Bottom Bar: pagination + a single, consistent primary action.
            Anchored here (outside the paged ScrollView) so the button keeps a
            fixed size and position on every page instead of shifting with
            per-page content height. */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.pagination}>
            {pages.map((_, index) => {
              const isActive = index === currentPage;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => goToPage(index)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dot,
                      isActive && styles.dotActive,
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.buttonShadow}>
            <TouchableOpacity
              style={styles.buttonTouchable}
              onPress={nextPage}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#228B22', '#1a6b1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {currentPage === pages.length - 1 ? 'Get Started' : 'Continue'}
                </Text>
                <Ionicons
                  name={currentPage === pages.length - 1 ? 'arrow-forward' : 'chevron-forward'}
                  size={18}
                  color="#FFFFFF"
                  style={styles.buttonIcon}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonText: {
    color: '#888888',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(34, 139, 34, 0.8)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  iconGradientFinal: {
    width: 140,
    height: 140,
    borderRadius: 70,
    shadowRadius: 32,
  },
  title: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: -0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  titleFinal: {
    fontSize: 38,
    color: '#2fa72f',
    textShadowColor: 'rgba(47, 167, 47, 0.6)',
  },
  description: {
    fontSize: 17,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  bottomBar: {
    paddingHorizontal: 32,
    paddingTop: 8,
  },
  buttonShadow: {
    width: '100%',
    shadowColor: 'rgba(34, 139, 34, 0.9)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  buttonTouchable: {
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
    gap: 8,
    overflow: 'visible',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333333',
    marginHorizontal: 6,
  },
  dotActive: {
    backgroundColor: '#228B22',
    width: 28,
    borderRadius: 5,
    shadowColor: 'rgba(34, 139, 34, 0.9)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
});

export default OnboardingScreen;
