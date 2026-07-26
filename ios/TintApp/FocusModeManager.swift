import Foundation
import UIKit
import React

@objc(FocusModeManager)
class FocusModeManager: NSObject {
  
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  /// Checks if Focus Filters are available (iOS 16+)
  /// Focus Filters require iOS 16+ and the FocusFilterExtension to be installed
  @objc func isFocusFiltersAvailable(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 16.0, *) {
      resolve(true)
    } else {
      resolve(false)
    }
  }
  
  /// Verifies that the Focus Filter extension is properly configured
  /// by checking if the App Group is accessible and has focus mode settings
  @objc func isFocusFilterConfigured(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let appGroupID = "group.com.alexmartens.tint"
    let themeDataKey = "tintThemeData"
    
    guard let defaults = UserDefaults(suiteName: appGroupID) else {
      resolve(false)
      return
    }
    
    defaults.synchronize()
    
    // Check if we have focus mode settings saved
    var themeData: [String: Any]?
    if let dict = defaults.dictionary(forKey: themeDataKey) {
      themeData = dict
    } else if let jsonString = defaults.string(forKey: themeDataKey),
              let jsonData = jsonString.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
      themeData = parsed
    }
    
    if let data = themeData,
       let focusSettings = data["focusModeSettings"] as? [String: Any],
       let enabled = focusSettings["enabled"] as? Bool {
      resolve(enabled)
    } else {
      resolve(false)
    }
  }
  
  /// Gets the list of available themes (built-in + custom) for Focus mode mapping
  @objc func getAvailablePresets(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    var themes: [[String: String]] = []
    
    // Built-in themes from PRESET_THEMES
    for theme in AuraPresetDefinitions.themes {
      themes.append([
        "id": theme.id,
        "name": theme.name,
        "background": theme.theme.background,
        "text": theme.theme.text,
        "link": theme.theme.link
      ])
    }
    
    // Custom themes from App Group
    let appGroupID = "group.com.alexmartens.tint"
    let themeDataKey = "tintThemeData"
    
    if let defaults = UserDefaults(suiteName: appGroupID) {
      defaults.synchronize()
      
      var themeData: [String: Any]?
      if let dict = defaults.dictionary(forKey: themeDataKey) {
        themeData = dict
      } else if let jsonString = defaults.string(forKey: themeDataKey),
                let jsonData = jsonString.data(using: .utf8),
                let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
        themeData = parsed
      }
      
      if let data = themeData,
         let customThemes = data["customThemes"] as? [[String: Any]] {
        for custom in customThemes {
          if let id = custom["id"] as? String,
             let name = custom["name"] as? String,
             let bg = custom["background"] as? String,
             let text = custom["text"] as? String,
             let link = custom["link"] as? String {
            themes.append([
              "id": id,
              "name": name,
              "background": bg,
              "text": text,
              "link": link
            ])
          }
        }
      }
    }
    
    resolve(themes)
  }
}
