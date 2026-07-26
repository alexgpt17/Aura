import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    static let appGroupID = "group.com.alexmartens.tint"
    static let themeDataKey = "tintThemeData"
    
    override init() {
        super.init()
        os_log(.fault, "Aura SafariWebExtensionHandler INIT called")
        NSLog("Aura: SafariWebExtensionHandler INIT - This should appear in Xcode console")
        print("Aura: SafariWebExtensionHandler INIT (print)")
    }
    
    func beginRequest(with context: NSExtensionContext) {
        NSLog("beginRequest CALLED - This should appear in Xcode console")
        print("beginRequest CALLED (print)")
        os_log(.fault, "Tint native handler beginRequest CALLED")
        
        guard let item = context.inputItems.first as? NSExtensionItem else {
            NSLog("beginRequest: No input items found")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        guard let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            NSLog("beginRequest: No message in userInfo")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        guard let messageType = message["type"] as? String else {
            NSLog("beginRequest: No message type found. Message keys: %@", Array(message.keys))
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        NSLog("beginRequest: Message type = %@", messageType)
        
        if messageType == "syncTheme" {
            handleSyncThemeRequest(context: context)
        } else if messageType == "getTheme" {
            handleSyncThemeRequest(context: context)
        } else {
            context.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
    
    func handleSyncThemeRequest(context: NSExtensionContext) {
        let shared = UserDefaults(suiteName: SafariWebExtensionHandler.appGroupID)
        
        guard let freshDefaults = shared else {
            os_log(.error, "Failed to access App Group: %@", SafariWebExtensionHandler.appGroupID)
            NSLog("Failed to access App Group")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        // Force fresh data read with longer delay to ensure App Group writes complete
        freshDefaults.synchronize()
        
        // Wait longer for App Group writes to complete (React Native storage is async)
        Thread.sleep(forTimeInterval: 0.3)
        
        // Force reload from disk
        freshDefaults.synchronize()
        let _ = freshDefaults.dictionaryRepresentation()
        freshDefaults.synchronize()
        
        // Read theme data from App Group
        var allThemes: [String: Any] = [:]
        
        if let dict = freshDefaults.dictionary(forKey: SafariWebExtensionHandler.themeDataKey) {
            allThemes = dict
            NSLog("Read theme data as dictionary")
        } else if let jsonString = freshDefaults.string(forKey: SafariWebExtensionHandler.themeDataKey) {
            NSLog("Read theme data as string, attempting to parse")
            if let jsonData = jsonString.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                allThemes = parsed
                NSLog("Successfully parsed JSON string")
            }
        } else if let obj = freshDefaults.object(forKey: SafariWebExtensionHandler.themeDataKey) as? [String: Any] {
            allThemes = obj
            NSLog("Read theme data as object")
        } else {
            NSLog("No theme data found in App Group")
        }
        
        // CRITICAL FIX: Only send globalTheme and siteThemes to extension
        // Don't send customThemes, auraPresets, recentlyUsedThemes, etc.
        // This prevents massive data writes that cause browser.storage to get overwhelmed
        var filteredData: [String: Any] = [:]
        
        if let globalTheme = allThemes["globalTheme"] as? [String: Any] {
            filteredData["globalTheme"] = globalTheme
            NSLog("Global theme - background: %@, text: %@",
                  globalTheme["background"] as? String ?? "nil",
                  globalTheme["text"] as? String ?? "nil")
        }
        
        if let siteThemes = allThemes["siteThemes"] as? [String: Any] {
            filteredData["siteThemes"] = siteThemes
            NSLog("Including site-specific themes (count: %d)", siteThemes.count)
        }
        
        // Time-based day/night rule (resolved color objects + boundary times)
        // so the content script can switch themes without the full preset catalog.
        if let timeBasedRule = allThemes["timeBasedRule"] as? [String: Any] {
            filteredData["timeBasedRule"] = timeBasedRule
            NSLog("Including timeBasedRule (enabled: %@)",
                  String(describing: timeBasedRule["enabled"] ?? false))
        }
        
        // Return only filtered theme data
        let responseItem = NSExtensionItem()
        responseItem.userInfo = [
            SFExtensionMessageKey: [
                "themeData": filteredData
            ]
        ]
        
        NSLog("Returning filtered theme data for sync (globalTheme: %@, siteThemes count: %d)",
              filteredData["globalTheme"] != nil ? "YES" : "NO",
              (filteredData["siteThemes"] as? [String: Any])?.count ?? 0)
        context.completeRequest(returningItems: [responseItem], completionHandler: nil)
    }
}
