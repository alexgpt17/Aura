import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    
    static let appGroupID = "group.com.alexmartens.tint"
    static let themeDataKey = "tintThemeData"
    /// Written on every invocation so the container app can tell the extension is live.
    static let heartbeatKey = "auraExtensionHeartbeat"
    
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem else {
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        guard let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        guard let messageType = message["type"] as? String else {
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        if messageType == "syncTheme" || messageType == "getTheme" {
            handleSyncThemeRequest(context: context)
        } else {
            context.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
    
    func handleSyncThemeRequest(context: NSExtensionContext) {
        guard let freshDefaults = UserDefaults(suiteName: SafariWebExtensionHandler.appGroupID) else {
            os_log(.error, "Failed to access App Group: %{public}@", SafariWebExtensionHandler.appGroupID)
            context.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }
        
        freshDefaults.set(Date().timeIntervalSince1970 * 1000,
                          forKey: SafariWebExtensionHandler.heartbeatKey)
        freshDefaults.synchronize()
        
        var allThemes: [String: Any] = [:]
        
        if let dict = freshDefaults.dictionary(forKey: SafariWebExtensionHandler.themeDataKey) {
            allThemes = dict
        } else if let jsonString = freshDefaults.string(forKey: SafariWebExtensionHandler.themeDataKey),
                  let jsonData = jsonString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            allThemes = parsed
        } else if let obj = freshDefaults.object(forKey: SafariWebExtensionHandler.themeDataKey) as? [String: Any] {
            allThemes = obj
        }
        
        // Only send fields the extension needs (keeps storage small).
        var filteredData: [String: Any] = [:]
        
        if let globalTheme = allThemes["globalTheme"] as? [String: Any] {
            filteredData["globalTheme"] = globalTheme
        }
        
        if let siteThemes = allThemes["siteThemes"] as? [String: Any] {
            filteredData["siteThemes"] = siteThemes
        }
        
        if let timeBasedRule = allThemes["timeBasedRule"] as? [String: Any] {
            filteredData["timeBasedRule"] = timeBasedRule
        }
        
        let responseItem = NSExtensionItem()
        responseItem.userInfo = [
            SFExtensionMessageKey: [
                "themeData": filteredData
            ]
        ]
        
        context.completeRequest(returningItems: [responseItem], completionHandler: nil)
    }
}
