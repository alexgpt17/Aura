// PurchaseManager.swift
// Native StoreKit bridge for React Native
// Handles $4.99 one-time purchase for custom theme creation

import Foundation
import StoreKit
import React

@available(iOS 15.0, *)
@objc(PurchaseManager)
class PurchaseManager: NSObject {
    
    static let CUSTOM_THEMES_PRODUCT_ID = "com.alexmartens.aura.customthemes"
    
    private var products: [Product] = []
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    // MARK: - Product Loading
    
    @objc
    func loadProducts(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task { @MainActor in
            do {
                let products = try await Product.products(for: [PurchaseManager.CUSTOM_THEMES_PRODUCT_ID])
                self.products = products
                
                if let product = products.first {
                    resolve([
                        "id": product.id,
                        "price": product.displayPrice,
                        "localizedPrice": product.displayPrice,
                    ])
                } else {
                    reject("PRODUCT_NOT_FOUND", "Product not found in App Store", nil)
                }
            } catch {
                reject("LOAD_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Purchase
    
    @objc
    func purchaseProduct(_ productId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard productId == PurchaseManager.CUSTOM_THEMES_PRODUCT_ID else {
            reject("INVALID_PRODUCT", "Invalid product ID", nil)
            return
        }
        
        Task { @MainActor in
            do {
                // Load product if not already loaded
                if products.isEmpty {
                    let loadedProducts = try await Product.products(for: [PurchaseManager.CUSTOM_THEMES_PRODUCT_ID])
                    self.products = loadedProducts
                }
                
                guard let product = products.first else {
                    reject("PRODUCT_NOT_FOUND", "Product not found", nil)
                    return
                }
                
                // Initiate purchase
                let result = try await product.purchase()
                
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        // Purchase successful
                        await transaction.finish()
                        resolve(["success": true])
                    case .unverified(_, let error):
                        reject("VERIFICATION_FAILED", "Purchase verification failed: \(error.localizedDescription)", error)
                    }
                case .userCancelled:
                    reject("USER_CANCELLED", "User cancelled the purchase", nil)
                case .pending:
                    reject("PENDING", "Purchase is pending", nil)
                @unknown default:
                    reject("UNKNOWN_ERROR", "Unknown purchase result", nil)
                }
            } catch {
                reject("PURCHASE_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Restore Purchases
    
    @objc
    func restorePurchases(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                
                // Check if user has purchased the product
                var hasPurchased = false
                
                for await result in Transaction.currentEntitlements {
                    switch result {
                    case .verified(let transaction):
                        if transaction.productID == PurchaseManager.CUSTOM_THEMES_PRODUCT_ID {
                            hasPurchased = true
                        }
                    case .unverified:
                        break
                    }
                }
                
                resolve([
                    "success": true,
                    "restored": hasPurchased
                ])
            } catch {
                reject("RESTORE_ERROR", error.localizedDescription, error)
            }
        }
    }
    
    // MARK: - Check Purchase Status
    
    @objc
    func checkPurchaseStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task { @MainActor in
            var hasPurchased = false
            
            for await result in Transaction.currentEntitlements {
                switch result {
                case .verified(let transaction):
                    if transaction.productID == PurchaseManager.CUSTOM_THEMES_PRODUCT_ID {
                        hasPurchased = true
                    }
                case .unverified:
                    break
                }
            }
            
            resolve(["hasPurchased": hasPurchased])
        }
    }
}

// MARK: - React Native Bridge

@available(iOS 15.0, *)
@objc(PurchaseManagerModule)
class PurchaseManagerModule: RCTEventEmitter {
    
    private let manager = PurchaseManager()
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return []
    }
    
    @objc
    func loadProducts(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 15.0, *) {
            manager.loadProducts(resolve, rejecter: reject)
        } else {
            reject("UNSUPPORTED", "StoreKit 2 requires iOS 15.0+", nil)
        }
    }
    
    @objc
    func purchaseProduct(_ productId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 15.0, *) {
            manager.purchaseProduct(productId, resolver: resolve, rejecter: reject)
        } else {
            reject("UNSUPPORTED", "StoreKit 2 requires iOS 15.0+", nil)
        }
    }
    
    @objc
    func restorePurchases(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 15.0, *) {
            manager.restorePurchases(resolve, rejecter: reject)
        } else {
            reject("UNSUPPORTED", "StoreKit 2 requires iOS 15.0+", nil)
        }
    }
    
    @objc
    func checkPurchaseStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 15.0, *) {
            manager.checkPurchaseStatus(resolve, rejecter: reject)
        } else {
            reject("UNSUPPORTED", "StoreKit 2 requires iOS 15.0+", nil)
        }
    }
}
