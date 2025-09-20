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
            let theme = ThemeManager.getCurrentTheme()
            let response = NSExtensionItem()
            // The userInfo dictionary must be JSON-serializable.
            // ThemeManager.getCurrentTheme() returns [String: Any]? which should be fine.
            response.userInfo = [ SFExtensionMessageKey: [ "theme": theme ?? ["enabled": false] ] ]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        } else {
            let response = NSExtensionItem()
            response.userInfo = [ SFExtensionMessageKey: ["error": "Unknown message type"] ]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
    }

}