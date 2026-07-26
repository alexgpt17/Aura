import Foundation

/// Shared theme definitions for the Focus Filter Extension.
/// These mirror the PRESET_THEMES array from src/screens/BrowseThemesScreen.tsx.
/// The extension runs independently of React Native, so it needs its own copy.
struct AuraPresetDefinitions {

    struct SafariTheme {
        let background: String
        let text: String
        let link: String
        let backgroundType: String?
        let backgroundGradient: String?

        init(background: String, text: String, link: String, backgroundType: String? = nil, backgroundGradient: String? = nil) {
            self.background = background
            self.text = text
            self.link = link
            self.backgroundType = backgroundType
            self.backgroundGradient = backgroundGradient
        }
    }

    struct ThemeDefinition {
        let id: String
        let name: String
        let theme: SafariTheme
    }

    // MARK: - Built-in Themes (mirrors PRESET_THEMES from BrowseThemesScreen.tsx)

    static let themes: [ThemeDefinition] = [
        ThemeDefinition(
            id: "dark",
            name: "Dark Mode",
            theme: SafariTheme(
                background: "#000000",
                text: "#ffffff",
                link: "#1E90FF"
            )
        ),
        ThemeDefinition(
            id: "light",
            name: "Light Mode",
            theme: SafariTheme(
                background: "#ffffff",
                text: "#000000",
                link: "#0066cc"
            )
        ),
        ThemeDefinition(
            id: "monochrome",
            name: "Monochrome",
            theme: SafariTheme(
                background: "#000000",
                text: "#ffffff",
                link: "#0066cc",
                backgroundType: "split",
                backgroundGradient: "linear-gradient(135deg, #000000 0%, #ffffff 100%)"
            )
        ),
        ThemeDefinition(
            id: "forest",
            name: "Forest",
            theme: SafariTheme(
                background: "#1a3d1a",
                text: "#c8e6c9",
                link: "#81c784"
            )
        ),
        ThemeDefinition(
            id: "ocean",
            name: "Ocean",
            theme: SafariTheme(
                background: "#001f3f",
                text: "#b3d9ff",
                link: "#4da6ff"
            )
        ),
        ThemeDefinition(
            id: "sepia",
            name: "Sepia",
            theme: SafariTheme(
                background: "#F1EADF",
                text: "#4A3F35",
                link: "#006A71"
            )
        ),
        ThemeDefinition(
            id: "grayscale",
            name: "Grayscale",
            theme: SafariTheme(
                background: "#1E1E1E",
                text: "#E0E0E0",
                link: "#BB86FC"
            )
        ),
        ThemeDefinition(
            id: "midnight",
            name: "Midnight",
            theme: SafariTheme(
                background: "#0a0e27",
                text: "#6c5ce7",
                link: "#6c5ce7"
            )
        ),
        ThemeDefinition(
            id: "chroma",
            name: "Chroma",
            theme: SafariTheme(
                background: "#1a1a2e",
                text: "#f0f0f0",
                link: "#ff6b6b"
            )
        ),
        ThemeDefinition(
            id: "ocean-split",
            name: "Ocean Split",
            theme: SafariTheme(
                background: "#001f3f",
                text: "#ffffff",
                link: "#4da6ff",
                backgroundType: "split",
                backgroundGradient: "linear-gradient(135deg, #001f3f 0%, #b3d9ff 100%)"
            )
        ),
        ThemeDefinition(
            id: "forest-split",
            name: "Forest Split",
            theme: SafariTheme(
                background: "#0a2e0a",
                text: "#ffffff",
                link: "#81c784",
                backgroundType: "split",
                backgroundGradient: "linear-gradient(135deg, #0a2e0a 0%, #c8e6c9 100%)"
            )
        ),
        ThemeDefinition(
            id: "sunset-split",
            name: "Sunset Split",
            theme: SafariTheme(
                background: "#1a0a2e",
                text: "#ffffff",
                link: "#ff6b6b",
                backgroundType: "split",
                backgroundGradient: "linear-gradient(135deg, #1a0a2e 0%, #ff8c42 100%)"
            )
        ),
    ]

    // MARK: - Lookup Methods

    /// Find a theme by its ID (exact match)
    static func getTheme(byID id: String) -> ThemeDefinition? {
        // First check built-in themes
        if let theme = themes.first(where: { $0.id == id }) {
            return theme
        }
        // Then check custom themes from App Group storage
        return getCustomTheme(byID: id)
    }

    /// Find a theme by name (case-insensitive)
    static func getTheme(byName name: String) -> ThemeDefinition? {
        let lowered = name.lowercased()
        if let theme = themes.first(where: { $0.name.lowercased() == lowered || $0.id.lowercased() == lowered }) {
            return theme
        }
        return getCustomTheme(byName: name)
    }

    /// Load a custom theme from App Group storage by ID
    private static func getCustomTheme(byID id: String) -> ThemeDefinition? {
        guard let customThemes = loadCustomThemes() else { return nil }
        return customThemes.first(where: { $0.id == id })
    }

    private static func getCustomTheme(byName name: String) -> ThemeDefinition? {
        guard let customThemes = loadCustomThemes() else { return nil }
        let lowered = name.lowercased()
        return customThemes.first(where: { $0.name.lowercased() == lowered })
    }

    /// Load custom themes from App Group storage
    private static func loadCustomThemes() -> [ThemeDefinition]? {
        let appGroupID = "group.com.alexmartens.tint"
        let themeDataKey = "tintThemeData"

        guard let defaults = UserDefaults(suiteName: appGroupID) else { return nil }
        defaults.synchronize()

        var themeData: [String: Any]?
        if let dict = defaults.dictionary(forKey: themeDataKey) {
            themeData = dict
        } else if let jsonString = defaults.string(forKey: themeDataKey),
                  let jsonData = jsonString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            themeData = parsed
        }

        guard let data = themeData,
              let customThemesArray = data["customThemes"] as? [[String: Any]] else {
            return nil
        }

        return customThemesArray.compactMap { dict -> ThemeDefinition? in
            guard let id = dict["id"] as? String,
                  let name = dict["name"] as? String,
                  let bg = dict["background"] as? String,
                  let text = dict["text"] as? String,
                  let link = dict["link"] as? String else {
                return nil
            }

            return ThemeDefinition(
                id: id,
                name: name,
                theme: SafariTheme(
                    background: bg,
                    text: text,
                    link: link,
                    backgroundType: dict["backgroundType"] as? String,
                    backgroundGradient: dict["backgroundGradient"] as? String
                )
            )
        }
    }
}
