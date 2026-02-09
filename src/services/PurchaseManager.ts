// Purchase Manager for StoreKit IAP
// Handles $4.99 one-time purchase for custom theme creation

import { Platform } from 'react-native';
import { setCustomThemesPurchased, hasPurchasedCustomThemes } from '../storage';

// Product ID for custom themes purchase
export const CUSTOM_THEMES_PRODUCT_ID = 'com.alexmartens.aura.customthemes';

// Native module bridge for StoreKit
import { NativeModules } from 'react-native';

interface NativePurchaseModule {
  purchaseProduct(productId: string): Promise<{ success: boolean; error?: string }>;
  restorePurchases(): Promise<{ success: boolean; restored: boolean }>;
  loadProducts(): Promise<{ id: string; price: string; localizedPrice: string }>;
  checkPurchaseStatus(): Promise<{ hasPurchased: boolean }>;
}

// Load native module
const PurchaseModule: NativePurchaseModule | null = NativeModules.PurchaseManagerModule || null;

export class PurchaseManager {
  /**
   * Initiates purchase flow for custom themes
   */
  static async purchaseCustomThemes(): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'Purchases only available on iOS' };
    }

    try {
      if (!PurchaseModule) {
        // Fallback for development - will be replaced with actual StoreKit
        console.warn('Purchase module not available - using development mode');
        // In development, we can simulate purchase
        await setCustomThemesPurchased(true);
        return { success: true };
      }

      const result = await PurchaseModule.purchaseProduct(CUSTOM_THEMES_PRODUCT_ID);
      
      if (result.success) {
        await setCustomThemesPurchased(true);
      }
      
      return result;
    } catch (error: any) {
      console.error('Purchase error:', error);
      // Handle React Native promise rejection format
      if (error.code) {
        return { success: false, error: error.message || error.code };
      }
      return { success: false, error: error.message || 'Purchase failed' };
    }
  }

  /**
   * Restores previous purchases
   */
  static async restorePurchases(): Promise<{ success: boolean; restored: boolean }> {
    if (Platform.OS !== 'ios') {
      return { success: false, restored: false };
    }

    try {
      if (!PurchaseModule) {
        // Check if already purchased in storage
        const hasPurchased = await hasPurchasedCustomThemes();
        return { success: true, restored: hasPurchased };
      }

      const result = await PurchaseModule.restorePurchases();
      
      if (result.restored) {
        await setCustomThemesPurchased(true);
      }
      
      return result;
    } catch (error: any) {
      console.error('Restore error:', error);
      return { success: false, restored: false };
    }
  }

  /**
   * Gets the price of the custom themes product
   */
  static async getProductPrice(): Promise<string | null> {
    if (Platform.OS !== 'ios' || !PurchaseModule) {
      return '$4.99'; // Default price
    }

    try {
      const product = await PurchaseModule.loadProducts();
      return product?.localizedPrice || product?.price || '$4.99';
    } catch (error) {
      console.error('Error getting product price:', error);
      return '$4.99';
    }
  }

  /**
   * Checks if user has purchased custom themes
   */
  static async hasPurchased(): Promise<boolean> {
    return await hasPurchasedCustomThemes();
  }
}
