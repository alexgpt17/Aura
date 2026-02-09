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
        NSLog("🔥🔥🔥 Tint: SafariWebExtensionHandler INIT - This should appear in Xcode console")
        print("🔥🔥🔥 Tint: SafariWebExtensionHandler INIT (print)")
    }
    
    func beginRequest(with context: NSExtensionContext) {
        NSLog("🔥🔥🔥 beginRequest CALLED - This should appear in Xcode console")
        print("🔥🔥🔥 beginRequest CALLED (print)")
        os_log(.fault, "Tint native handler beginRequest CALLED")
        
        // Extract message from JavaScript content script
        guard let item = context.inputItems.first as? NSExtensionItem else {
            NSLog("🔥🔥🔥 beginRequest: No input items found")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        guard let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            NSLog("🔥🔥🔥 beginRequest: No message in userInfo")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        guard let messageType = message["type"] as? String else {
            NSLog("🔥🔥🔥 beginRequest: No message type found. Message keys: %@", Array(message.keys))
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        NSLog("🔥🔥🔥 beginRequest: Message type = %@", messageType)
        
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
        // Create a fresh UserDefaults instance each time to avoid caching issues
        guard let shared = UserDefaults(suiteName: SafariWebExtensionHandler.appGroupID) else {
            os_log(.error, "Failed to access App Group: %@", SafariWebExtensionHandler.appGroupID)
            NSLog("🔥 Failed to access App Group")
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        // CRITICAL: Force synchronization BEFORE reading to ensure we get latest data from disk
        // UserDefaults can cache data in memory, so synchronize() forces a disk read
        // Call it multiple times to ensure we get fresh data
        shared.synchronize()
        
        // Force UserDefaults to reload from disk by accessing a property
        // This helps clear any in-memory cache
        let _ = shared.dictionaryRepresentation()
        
        // Synchronize again after accessing dictionaryRepresentation
        shared.synchronize()
        
        // Read theme data from App Group - try multiple methods to ensure we get fresh data
        var allThemes: [String: Any] = [:]
        
        // First, try to read as dictionary (most common case)
        if let dict = shared.dictionary(forKey: SafariWebExtensionHandler.themeDataKey) {
            allThemes = dict
            NSLog("🔥 Read theme data as dictionary")
            // Log the actual theme values for debugging
            if let globalTheme = allThemes["globalTheme"] as? [String: Any] {
                NSLog("🔥 Global theme - background: %@, text: %@, enabled: %@", 
                      globalTheme["background"] as? String ?? "nil",
                      globalTheme["text"] as? String ?? "nil",
                      globalTheme["enabled"] as? Bool ?? false ? "YES" : "NO")
            }
        } else if let jsonString = shared.string(forKey: SafariWebExtensionHandler.themeDataKey) {
            NSLog("🔥 Read theme data as string, attempting to parse")
            if let jsonData = jsonString.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                allThemes = parsed
                NSLog("🔥 Successfully parsed JSON string")
                // Log the actual theme values for debugging
                if let globalTheme = allThemes["globalTheme"] as? [String: Any] {
                    NSLog("🔥 Global theme - background: %@, text: %@", 
                          globalTheme["background"] as? String ?? "nil",
                          globalTheme["text"] as? String ?? "nil")
                }
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
