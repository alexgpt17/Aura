import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { PurchaseManager } from '../services/PurchaseManager';
import { useAppTheme } from '../contexts/AppThemeContext';

interface PurchaseScreenProps {
  navigation: any;
  onPurchaseComplete?: () => void;
}

const PurchaseScreen: React.FC<PurchaseScreenProps> = ({ navigation, onPurchaseComplete }) => {
  const { appThemeColor } = useAppTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [price, setPrice] = useState('$4.99');

  useEffect(() => {
    loadPrice();
  }, []);

  const loadPrice = async () => {
    const productPrice = await PurchaseManager.getProductPrice();
    if (productPrice) {
      setPrice(productPrice);
    }
  };

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const result = await PurchaseManager.purchaseCustomThemes();
      
      if (result.success) {
        // For testing: directly navigate to CustomTheme screen
        if (onPurchaseComplete) {
          onPurchaseComplete();
        }
        navigation.navigate('CustomTheme');
      } else {
        Alert.alert('Purchase Failed', result.error || 'Unable to complete purchase. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred during purchase.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const result = await PurchaseManager.restorePurchases();
      
      if (result.restored) {
        Alert.alert(
          'Purchases Restored',
          'Your purchase has been restored. You can now create custom themes.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (onPurchaseComplete) {
                  onPurchaseComplete();
                } else {
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred while restoring purchases.');
    } finally {
      setIsLoading(false);
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
        <Text style={styles.headerTitle}>Unlock Custom Themes</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Create Custom Themes</Text>
        <Text style={styles.description}>
          Unlock the ability to create unlimited custom themes for both Safari and Keyboard.
          Mix and match colors to create your perfect browsing experience.
        </Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>Unlimited custom themes</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>Works with Safari & Keyboard</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>One-time purchase</Text>
          </View>
          <View style={styles.feature}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>No subscriptions</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.purchaseButton}
          onPress={handlePurchase}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={appThemeColor} />
          ) : (
            <Text style={[styles.purchaseButtonText, { color: appThemeColor }]}>Unlock</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isLoading}
        >
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Payment will be charged to your Apple ID account. Purchase is a one-time payment.
        </Text>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  features: {
    width: '100%',
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 20,
    color: '#228B22',
    marginRight: 12,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  purchaseButton: {
    backgroundColor: '#1a1a1a',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  purchaseButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  restoreButtonText: {
    color: '#888888',
    fontSize: 14,
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});

export default PurchaseScreen;
