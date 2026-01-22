import Foundation

struct ThemeManager {
    static let appGroup = "group.com.alexmartens.tint"
    
    static func getCurrentTheme() -> [String: Any]? {
        if let defaults = UserDefaults(suiteName: appGroup) {
            // Try dictionary first
            if let theme = defaults.dictionary(forKey: "currentTheme") {
                return theme
            }
            // Try string and parse it
            if let themeString = defaults.string(forKey: "currentTheme"),
               let data = themeString.data(using: .utf8),
               let theme = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                return theme
            }
            // Try object(forKey:) as fallback
            if let theme = defaults.object(forKey: "currentTheme") as? [String: Any] {
                return theme
            }
        }
        return nil
    }
    
    static func getSiteThemes() -> [String: Any]? {
        if let defaults = UserDefaults(suiteName: appGroup),
           let themes = defaults.dictionary(forKey: "siteThemes") {
            return themes
        }
        return nil
    }
}
