import Foundation
import SafariServices
import React

@objc(ContentBlockerManager)
class ContentBlockerManager: NSObject {
  
  private let contentBlockerIdentifier = "org.reactjs.native.example.TintApp.ContentBlockerExtension"
  
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  /// Reloads the content blocker rules in Safari.
  /// Call this after the user changes content blocker settings.
  @objc func reloadContentBlocker(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    SFContentBlockerManager.reloadContentBlocker(withIdentifier: contentBlockerIdentifier) { error in
      if let error = error {
        reject("RELOAD_ERROR", "Failed to reload content blocker: \(error.localizedDescription)", error)
      } else {
        resolve(true)
      }
    }
  }
  
  /// Gets the current state of the content blocker (enabled/disabled in Safari settings)
  @objc func getContentBlockerState(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    SFContentBlockerManager.getStateOfContentBlocker(withIdentifier: contentBlockerIdentifier) { state, error in
      if let error = error {
        reject("STATE_ERROR", "Failed to get content blocker state: \(error.localizedDescription)", error)
        return
      }
      
      resolve([
        "isEnabled": state?.isEnabled ?? false
      ])
    }
  }
  
  /// Gets statistics about the active block rules per category
  @objc func getBlockListStats(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    var stats: [String: Int] = [:]
    
    // Count rules in each bundled block list
    // Try loading from the content blocker extension bundle first, fall back to main bundle
    let categories = ["blocklist-ads", "blocklist-trackers", "blocklist-social", "blocklist-annoyances"]
    let categoryNames = ["ads", "trackers", "socialWidgets", "annoyances"]
    
    // Find the ContentBlockerExtension bundle
    var extensionBundle: Bundle? = nil
    if let pluginsURL = Bundle.main.builtInPlugInsURL {
      let extensionURL = pluginsURL.appendingPathComponent("ContentBlockerExtension.appex")
      extensionBundle = Bundle(url: extensionURL)
    }
    
    let searchBundle = extensionBundle ?? Bundle.main
    
    for (index, filename) in categories.enumerated() {
      if let url = searchBundle.url(forResource: filename, withExtension: "json"),
         let data = try? Data(contentsOf: url),
         let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
        stats[categoryNames[index]] = rules.count
      } else {
        stats[categoryNames[index]] = 0
      }
    }
    
    // Calculate total active rules based on current settings
    let appGroupID = "group.com.alexmartens.tint"
    let themeDataKey = "tintThemeData"
    var totalActive = 0
    
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
         let cbSettings = data["contentBlockerSettings"] as? [String: Any],
         let enabled = cbSettings["enabled"] as? Bool, enabled,
         let categories = cbSettings["categories"] as? [String: Any] {
        for (index, name) in categoryNames.enumerated() {
          if let isEnabled = categories[name] as? Bool, isEnabled {
            totalActive += stats[name] ?? 0
          }
        }
      }
    }
    
    stats["totalActive"] = totalActive
    resolve(stats)
  }
}
