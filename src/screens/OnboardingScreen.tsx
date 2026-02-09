import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated } from 'react-native';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isCompleting, setIsCompleting] = useState(false);

  const pages = [
    {
      title: 'Welcome to Aura',
      description: 'Customize your Safari browsing and keyboard experience',
      showPreview: false,
    },
    {
      title: 'Safari Extension',
      description: 'Apply themes to any website you visit',
      showPreview: 'safari',
    },
    {
      title: 'Custom Keyboard',
      description: 'Personalize your keyboard with themes that match your Safari experience.',
      showPreview: 'keyboard',
    },
    {
      title: 'Set Your Aura',
      description: 'Choose from hundreds of available themes or create your own! One click sets one theme across the app.',
      showPreview: false,
    },
  ];

  useEffect(() => {
    // Fade in animation when component first mounts
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const nextPage = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = () => {
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
    handleGetStarted();
  };

  const skipToLast = () => {
    setCurrentPage(pages.length - 1);
  };

  const renderSafariPreview = () => (
    <View style={styles.previewContainer}>
      <View style={styles.safariPreview}>
        {/* Browser chrome */}
        <View style={styles.browserChrome}>
          <View style={styles.browserButtons}>
            <View style={[styles.browserButton, { backgroundColor: '#FF5F57' }]} />
            <View style={[styles.browserButton, { backgroundColor: '#FFBD2E' }]} />
            <View style={[styles.browserButton, { backgroundColor: '#28CA42' }]} />
          </View>
          <View style={styles.urlBar}>
            <Text style={styles.urlText}>example.com</Text>
          </View>
        </View>
        {/* Themed content */}
        <View style={[styles.safariContent, { backgroundColor: '#1a1a2e' }]}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>Welcome to Example Site</Text>
            <Text style={styles.contentSubtitle}>Your themed browsing experience</Text>
          </View>
          <View style={styles.contentBody}>
            <Text style={styles.contentParagraph}>
              This is how websites look with your custom theme applied. The background, text, and link colors all match your chosen theme.
            </Text>
            <Text style={styles.contentParagraph}>
              Navigate through any website and see your theme in action. Every page will reflect your personal style.
            </Text>
            <View style={styles.contentLink}>
              <Text style={styles.linkText}>Learn more about themes →</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const renderKeyboardPreview = () => (
    <View style={styles.previewContainer}>
      <View style={styles.keyboardPreview}>
        {/* Keyboard rows */}
        <View style={styles.keyboardRow}>
          {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key, i) => (
            <View key={i} style={[styles.keyPreview, { backgroundColor: '#2d2d2d' }]}>
              <Text style={[styles.keyText, { color: '#ffffff' }]}>{key}</Text>
            </View>
          ))}
        </View>
        <View style={styles.keyboardRow}>
          {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key, i) => (
            <View key={i} style={[styles.keyPreview, { backgroundColor: '#2d2d2d' }]}>
              <Text style={[styles.keyText, { color: '#ffffff' }]}>{key}</Text>
            </View>
          ))}
        </View>
        <View style={styles.keyboardRow}>
          <View style={[styles.keyPreview, styles.shiftKey, { backgroundColor: '#3d3d3d' }]}>
            <Text style={[styles.keyText, { color: '#ffffff' }]}>⇧</Text>
          </View>
          {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key, i) => (
            <View key={i} style={[styles.keyPreview, { backgroundColor: '#2d2d2d' }]}>
              <Text style={[styles.keyText, { color: '#ffffff' }]}>{key}</Text>
            </View>
          ))}
          <View style={[styles.keyPreview, styles.backspaceKey, { backgroundColor: '#3d3d3d' }]}>
            <Text style={[styles.keyText, { color: '#ffffff' }]}>⌫</Text>
          </View>
        </View>
        <View style={styles.keyboardRow}>
          <View style={[styles.keyPreview, styles.spaceKey, { backgroundColor: '#2d2d2d' }]}>
            <Text style={[styles.keyText, { color: '#ffffff' }]}>space</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Skip All Button */}
      <TouchableOpacity style={styles.skipAllButton} onPress={skipToLast}>
        <Text style={styles.skipAllText}>Skip All →</Text>
      </TouchableOpacity>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentPage(page);
        }}
        style={styles.scrollView}
      >
        {pages.map((page, index) => (
          <View key={index} style={styles.page}>
            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.description}>{page.description}</Text>
            {page.showPreview === 'safari' && renderSafariPreview()}
            {page.showPreview === 'keyboard' && renderKeyboardPreview()}
          </View>
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentPage && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.buttonContainer}>
        {currentPage < pages.length - 1 ? (
          <>
            <TouchableOpacity style={styles.skipButton} onPress={skip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={nextPage}>
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted} disabled={isCompleting}>
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  skipAllButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipAllText: {
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#228B22',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    opacity: 0.9,
    marginBottom: 40,
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  safariPreview: {
    width: width - 80,
    maxWidth: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  browserChrome: {
    backgroundColor: '#2d2d2d',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  browserButtons: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  browserButton: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  urlBar: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  urlText: {
    color: '#888888',
    fontSize: 12,
  },
  safariContent: {
    padding: 20,
    minHeight: 200,
  },
  contentHeader: {
    marginBottom: 20,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  contentSubtitle: {
    fontSize: 16,
    color: '#228B22',
    marginBottom: 4,
  },
  contentBody: {
    marginTop: 8,
  },
  contentParagraph: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
    marginBottom: 12,
  },
  contentLink: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#228B22',
    fontWeight: '500',
  },
  keyboardPreview: {
    width: width - 80,
    maxWidth: 400,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  keyboardRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  keyPreview: {
    width: 32,
    height: 40,
    borderRadius: 6,
    marginHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
  },
  shiftKey: {
    width: 50,
  },
  backspaceKey: {
    width: 50,
  },
  spaceKey: {
    width: width - 140,
    maxWidth: 300,
  },
  keyText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#228B22',
    width: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 30,
  },
  skipButtonText: {
    color: '#888888',
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: '#228B22',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  getStartedButton: {
    backgroundColor: '#228B22',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 8,
    alignSelf: 'center',
    minWidth: 200,
    alignItems: 'center',
  },
  getStartedButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OnboardingScreen;
