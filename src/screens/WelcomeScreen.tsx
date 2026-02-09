import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

interface WelcomeScreenProps {
  navigation: any;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo removed - using app icon instead */}
        <Text style={styles.title}>Aura</Text>
        <Text style={styles.subtitle}>Customize your Safari browsing experience</Text>
        
        <TouchableOpacity 
          style={styles.safariButton}
          onPress={() => navigation.navigate('ThemeOptions')}
        >
          <Text style={styles.safariButtonText}>Safari</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#228B22',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
    opacity: 0.8,
  },
  safariButton: {
    backgroundColor: '#228B22',
    paddingVertical: 18,
    paddingHorizontal: 60,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#228B22',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  safariButtonText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default WelcomeScreen;
