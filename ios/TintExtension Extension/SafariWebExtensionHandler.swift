import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let userInfo = item.userInfo,
              let message = userInfo[SFExtensionMessageKey] as? [String: Any],
              let messageType = message["type"] as? String else {
            let response = NSExtensionItem()
            response.userInfo = [ SFExtensionMessageKey: ["error": "Invalid message format"] ]
            context.completeRequest(returningItems: [response], completionHandler: nil)
            return
        }

        os_log(.default, "Received message type: %@", messageType)

        if messageType == "GET_THEME" {
            let hostname = message["hostname"] as? String
            var themeToApply: [String: Any]?

            // 1. Check for a site-specific theme
            if let host = hostname, let siteThemes = ThemeManager.getSiteThemes() {
                // Check for exact match first (e.g., "www.google.com")
                if let siteTheme = siteThemes[host] as? [String: Any] {
                    themeToApply = siteTheme
                    os_log(.default, "Found site-specific theme for %@", host)
                } else {
                    // Fallback to checking the base domain (e.g., "google.com")
                    let components = host.split(separator: ".")
                    if components.count > 1 {
                        let baseDomain = components.suffix(2).joined(separator: ".")
                        if let siteTheme = siteThemes[baseDomain] as? [String: Any] {
                            themeToApply = siteTheme
                            os_log(.default, "Found site-specific theme for base domain %@", baseDomain)
                        }
                    }
                }
            }

            // 2. If no site-specific theme, use the global theme
            if themeToApply == nil {
                themeToApply = ThemeManager.getCurrentTheme()
                os_log(.default, "No site-specific theme found. Using global theme.")
            }

            let response = NSExtensionItem()
            response.userInfo = [ SFExtensionMessageKey: [ "theme": themeToApply ?? ["enabled": false] ] ]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        } else {
            let response = NSExtensionItem()
            response.userInfo = [ SFExtensionMessageKey: ["error": "Unknown message type"] ]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

}