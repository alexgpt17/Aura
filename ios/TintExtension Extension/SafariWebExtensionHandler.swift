import SafariServices
import os.log

// Native handler - Receives messages from JavaScript content scripts
// Noir-style architecture: Content script → sendMessage → beginRequest → Read App Group → Return theme config
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    static let appGroupID = "group.com.alexmartens.tint"
    static let themeDataKey = "tintThemeData"
    
    override init() {
        super.init()
        os_log(.fault, "Tint SafariWebExtensionHandler INIT called")
        NSLog("Tint: SafariWebExtensionHandler INIT")
    }
    
    func beginRequest(with context: NSExtensionContext) {
        NSLog("🔥 beginRequest CALLED")
        os_log(.fault, "Tint native handler beginRequest CALLED")
        
        // Extract message from JavaScript content script
        guard let item = context.inputItems.first as? NSExtensionItem,
              let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
              let messageType = message["type"] as? String else {
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        // Handle sync request from background script
        // This is called when Safari loads the extension and background script requests sync
        if messageType == "syncTheme" {
            handleSyncThemeRequest(context: context)
        } else {
            // Also handle direct getTheme requests (fallback)
            if messageType == "getTheme" {
                handleSyncThemeRequest(context: context)
            } else {
                context.completeRequest(returningItems: nil, completionHandler: nil)
            }
        }
    }
    
    func handleSyncThemeRequest(context: NSExtensionContext) {
        // Read theme data from App Group
        guard let shared = UserDefaults(suiteName: SafariWebExtensionHandler.appGroupID) else {
            os_log(.error, "Failed to access App Group: %@", SafariWebExtensionHandler.appGroupID)
            NSLog("🔥 Failed to access App Group")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        shared.synchronize()
        
        // Read theme data from App Group
        var allThemes: [String: Any] = [:]
        
        if let dict = shared.dictionary(forKey: SafariWebExtensionHandler.themeDataKey) {
            allThemes = dict
            NSLog("🔥 Read theme data as dictionary")
        } else if let jsonString = shared.string(forKey: SafariWebExtensionHandler.themeDataKey) {
            NSLog("🔥 Read theme data as string, attempting to parse")
            if let jsonData = jsonString.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                allThemes = parsed
                NSLog("🔥 Successfully parsed JSON string")
            }
        } else if let obj = shared.object(forKey: SafariWebExtensionHandler.themeDataKey) as? [String: Any] {
            allThemes = obj
            NSLog("🔥 Read theme data as object")
        } else {
            NSLog("🔥 No theme data found in App Group")
        }
        
        // Return all theme data (globalTheme + siteThemes) for storage
        let responseItem = NSExtensionItem()
        responseItem.userInfo = [
            SFExtensionMessageKey: [
                "themeData": allThemes
            ]
        ]
        
        NSLog("🔥 Returning theme data for sync (has globalTheme: %@, siteThemes count: %d)", 
              allThemes["globalTheme"] != nil ? "YES" : "NO",
              (allThemes["siteThemes"] as? [String: Any])?.count ?? 0)
        context.completeRequest(returningItems: [responseItem], completionHandler: nil)
    }
}
