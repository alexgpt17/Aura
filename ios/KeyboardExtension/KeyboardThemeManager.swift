import Foundation
import UIKit

/// Manages keyboard theme data from App Group storage
class KeyboardThemeManager {
    static let appGroupID = "group.com.alexmartens.tint"
    static let themeDataKey = "tintThemeData"
    
    /// Enhanced app detection with multiple heuristics and confidence scoring
    /// Returns the most likely app bundle ID and confidence level
    static func inferAppBundleID(keyboardType: UIKeyboardType, returnKeyType: UIReturnKeyType, textContentType: UITextContentType? = nil) -> (bundleId: String?, confidence: Float) {
        
        // High confidence matches (very specific patterns)
        switch (keyboardType, returnKeyType) {
        // Email fields are quite specific
        case (.emailAddress, .send):
            return ("com.apple.mail", 0.8)
        case (.emailAddress, .next), (.emailAddress, .continue):
            return ("com.apple.mail", 0.7)
            
        // URL fields are highly specific to browsers
        case (.URL, .go):
            return ("com.apple.mobilesafari", 0.9)
        case (.URL, .search):
            return ("com.apple.mobilesafari", 0.8)
            
        // Web search is browser-specific
        case (.webSearch, _):
            return ("com.apple.mobilesafari", 0.7)
            
        // Decimal pad is usually calculator
        case (.decimalPad, _):
            return ("com.apple.calculator", 0.8)
            
        // Phone pad patterns
        case (.phonePad, _):
            return ("com.apple.mobilephone", 0.7)
        case (.numberPad, _):
            return ("com.apple.mobilephone", 0.5) // Lower confidence, could be many apps
        default:
            break
        }
        
        // Medium confidence matches using text content type
        if let contentType = textContentType {
            switch contentType {
            case .emailAddress:
                return ("com.apple.mail", 0.6)
            case .URL:
                return ("com.apple.mobilesafari", 0.6)
            case .telephoneNumber:
                return ("com.apple.mobilephone", 0.6)
            default:
                break
            }
        }
        
        // Lower confidence matches based on return key patterns
        switch returnKeyType {
        case .send:
            // Could be Messages, Mail, or any messaging app
            if keyboardType == .default {
                return ("com.apple.MobileSMS", 0.4) // Low confidence, many apps use this
            }
        case .search:
            // Could be Safari, Settings search, or app search
            return ("com.apple.mobilesafari", 0.3)
        default:
            break
        }
        
        // No match found
        return (nil, 0.0)
    }
    
    /// Legacy method for backwards compatibility
    static func inferAppBundleID(keyboardType: UIKeyboardType, returnKeyType: UIReturnKeyType) -> String? {
        let result = inferAppBundleID(keyboardType: keyboardType, returnKeyType: returnKeyType, textContentType: nil)
        return result.confidence > 0.5 ? result.bundleId : nil
    }
    
    struct KeyboardTheme {
        let background: String
        let text: String
        let link: String
        let keyColor: String?
        let enabled: Bool
        let backgroundType: String?
        let backgroundGradient: String?
        
        // Cache UIColor objects to avoid recreating them
        private static var colorCache: [String: UIColor] = [:]
        
        var backgroundColor: UIColor {
            if let cached = KeyboardTheme.colorCache[background] {
                return cached
            }
            let color = UIColor(hexString: background) ?? UIColor.black
            KeyboardTheme.colorCache[background] = color
            return color
        }
        
        var textColor: UIColor {
            if let cached = KeyboardTheme.colorCache[text] {
                return cached
            }
            let color = UIColor(hexString: text) ?? UIColor.white
            KeyboardTheme.colorCache[text] = color
            return color
        }
        
        var linkColor: UIColor {
            if let cached = KeyboardTheme.colorCache[link] {
                return cached
            }
            let color = UIColor(hexString: link) ?? UIColor.systemGreen
            KeyboardTheme.colorCache[link] = color
            return color
        }
        
        var keyBackgroundColor: UIColor {
            if let keyColor = keyColor, let cached = KeyboardTheme.colorCache[keyColor] {
                return cached
            }
            if let keyColor = keyColor {
                let color = UIColor(hexString: keyColor) ?? UIColor(white: 0.27, alpha: 1.0)
                KeyboardTheme.colorCache[keyColor] = color
                return color
            }
            // Fallback to default system color if keyColor not provided
            return UIColor(white: 0.27, alpha: 1.0)
        }
        
        // Clear cache when theme changes significantly
        static func clearCache() {
            colorCache.removeAll()
        }
    }
    
    /// Reads keyboard theme from App Group storage
    /// If appBundleID is provided, checks for per-app theme first, then falls back to global theme
    static func getKeyboardTheme(forAppBundleID appBundleID: String? = nil) -> KeyboardTheme? {
        print("🔥🔥🔥 KeyboardExtension: getKeyboardTheme() CALLED")
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            print("❌ KeyboardExtension: Failed to access App Group")
            return nil
        }
        
        print("🔥🔥🔥 KeyboardExtension: Successfully accessed App Group")
        
        // CRITICAL: Force synchronization BEFORE reading to ensure we get latest data from disk
        // UserDefaults can cache data in memory, so synchronize() forces a disk read
        // Call it multiple times to ensure we get fresh data
        defaults.synchronize()
        print("🔥🔥🔥 KeyboardExtension: First synchronize() called")
        
        // Force UserDefaults to reload from disk by accessing a property
        // This helps clear any in-memory cache
        let _ = defaults.dictionaryRepresentation()
        print("🔥🔥🔥 KeyboardExtension: dictionaryRepresentation() accessed")
        
        // Synchronize again after accessing dictionaryRepresentation
        defaults.synchronize()
        print("🔥🔥🔥 KeyboardExtension: Second synchronize() called")
        
        // Read theme data from App Group - try multiple methods to ensure we get fresh data
        var themeData: [String: Any]?
        
        // First, try to read as dictionary (most common case)
        if let dict = defaults.dictionary(forKey: themeDataKey) {
            themeData = dict
            print("✅ KeyboardExtension: Read theme data as dictionary")
            print("🔥🔥🔥 KeyboardExtension: Dictionary keys:", dict.keys)
        } else if let jsonString = defaults.string(forKey: themeDataKey) {
            print("✅ KeyboardExtension: Read theme data as string, attempting to parse")
            if let jsonData = jsonString.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
                themeData = parsed
                print("✅ KeyboardExtension: Successfully parsed JSON string")
            }
        } else if let obj = defaults.object(forKey: themeDataKey) as? [String: Any] {
            themeData = obj
            print("✅ KeyboardExtension: Read theme data as object")
        } else {
            print("❌ KeyboardExtension: No data found with any read method")
            print("🔥🔥🔥 KeyboardExtension: Checking if key exists...")
            if defaults.object(forKey: themeDataKey) != nil {
                print("🔥🔥🔥 KeyboardExtension: Key exists but couldn't read as expected type")
            } else {
                print("🔥🔥🔥 KeyboardExtension: Key does not exist in UserDefaults")
            }
        }
        
        guard let themeData = themeData else {
            print("❌ KeyboardExtension: No theme data found in App Group")
            return nil
        }
        
        print("🔥🔥🔥 KeyboardExtension: Theme data found, keys:", themeData.keys)
        
        // First, try to get per-app theme if appBundleID is provided
        if let appBundleID = appBundleID, !appBundleID.isEmpty {
            if let appThemes = themeData["appThemes"] as? [String: [String: Any]],
               let appTheme = appThemes[appBundleID] {
                print("✅ KeyboardExtension: Found per-app theme for \(appBundleID)")
                
                // Check if per-app theme is enabled
                let enabled = appTheme["enabled"] as? Bool ?? true
                if !enabled {
                    print("ℹ️ KeyboardExtension: Per-app theme for \(appBundleID) is disabled, falling back to global")
                } else {
                    let background = appTheme["background"] as? String ?? "#000000"
                    let text = appTheme["text"] as? String ?? "#FFFFFF"
                    let link = appTheme["link"] as? String ?? "#228B22"
                    let keyColor = appTheme["keyColor"] as? String
                    let backgroundType = appTheme["backgroundType"] as? String
                    let backgroundGradient = appTheme["backgroundGradient"] as? String
                    
                    print("✅ KeyboardExtension: Loaded per-app theme for \(appBundleID) - background: \(background), text: \(text), link: \(link), keyColor: \(keyColor ?? "nil")")
                    if let bgType = backgroundType, bgType == "gradient", let gradient = backgroundGradient {
                        print("🎨 KeyboardExtension: Per-app theme has gradient: \(gradient)")
                    }
                    
                    return KeyboardTheme(
                        background: background,
                        text: text,
                        link: link,
                        keyColor: keyColor,
                        enabled: enabled,
                        backgroundType: backgroundType,
                        backgroundGradient: backgroundGradient
                    )
                }
            } else {
                print("ℹ️ KeyboardExtension: No per-app theme found for \(appBundleID), using global theme")
            }
        }
        
        // Fall back to global keyboard theme
        guard let keyboardTheme = themeData["keyboardTheme"] as? [String: Any] else {
            print("❌ KeyboardExtension: No keyboardTheme found in theme data")
            return nil
        }
        
        // Check if keyboard theme is enabled
        let enabled = keyboardTheme["enabled"] as? Bool ?? true
        if !enabled {
            print("ℹ️ KeyboardExtension: Keyboard theme is disabled")
            return nil
        }
        
        let background = keyboardTheme["background"] as? String ?? "#000000"
        let text = keyboardTheme["text"] as? String ?? "#FFFFFF"
        let link = keyboardTheme["link"] as? String ?? "#228B22"
        let keyColor = keyboardTheme["keyColor"] as? String
        let backgroundType = keyboardTheme["backgroundType"] as? String
        let backgroundGradient = keyboardTheme["backgroundGradient"] as? String
        
        print("✅ KeyboardExtension: Loaded global theme - background: \(background), text: \(text), link: \(link), keyColor: \(keyColor ?? "nil")")
        if let bgType = backgroundType, bgType == "gradient", let gradient = backgroundGradient {
            print("🎨 KeyboardExtension: Global theme has gradient: \(gradient)")
        }
        
        return KeyboardTheme(
            background: background,
            text: text,
            link: link,
            keyColor: keyColor,
            enabled: enabled,
            backgroundType: backgroundType,
            backgroundGradient: backgroundGradient
        )
    }
}

/// UIColor extension for hex color support
extension UIColor {
    convenience init?(hexString: String) {
        let hex = hexString.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RRGGBB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // RRGGBBAA (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            return nil
        }
        
        self.init(
            red: CGFloat(r) / 255,
            green: CGFloat(g) / 255,
            blue: CGFloat(b) / 255,
            alpha: CGFloat(a) / 255
        )
    }
}
