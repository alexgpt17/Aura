import Foundation
import UIKit
import UserNotifications

@objc(FocusModeManager)
class FocusModeManager: NSObject {
  
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  /// Gets the current Focus mode status
  /// Note: iOS doesn't provide a direct API to read Focus mode status
  /// This is a placeholder that will need to use Focus Filters or other methods
  @objc func getCurrentFocusMode(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // iOS 15+ Focus mode detection is limited
    // We'll use a workaround: check if we can detect Focus mode via Focus Filters
    // For now, return "none" as default
    resolve("none")
  }
  
  /// Sets up a listener for Focus mode changes
  /// This requires Focus Filters to be configured
  @objc func setupFocusModeListener(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Focus Filters require app extension
    // For now, we'll use a polling mechanism or notification-based approach
    resolve(true)
  }
  
  /// Checks if Focus Filters are available (iOS 15+)
  @objc func isFocusFiltersAvailable(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 15.0, *) {
      resolve(true)
    } else {
      resolve(false)
    }
  }
}
