import Foundation

struct ThemeManager {
    static let appGroup = "group.com.alexmartens.tint"
    
    static func getCurrentTheme() -> [String: Any]? {
        if let defaults = UserDefaults(suiteName: appGroup),
           let theme = defaults.dictionary(forKey: "currentTheme") {
            return theme
        }
        return nil
    }
}
