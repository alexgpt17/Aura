import UIKit

class KeyboardViewController: UIInputViewController {
    
    private var theme: KeyboardThemeManager.KeyboardTheme?
    private var keyboardView: KeyboardView?
    private var keyboardHeightConstraint: NSLayoutConstraint?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        print("🔥🔥🔥 KeyboardExtension: viewDidLoad() CALLED")
        print("🔥🔥🔥 KeyboardExtension: Extension is loading!")
        
        // Load theme from App Group
        loadTheme()
        
        // Create and setup keyboard view
        setupKeyboard()
        
        print("🔥🔥🔥 KeyboardExtension: viewDidLoad() COMPLETE")
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        
        print("🔥🔥🔥 KeyboardExtension: viewWillAppear() called")
        
        // Reload theme in case it changed - but only rebuild if theme actually changed
        let oldTheme = theme
        loadTheme()
        
        // Only rebuild if theme actually changed to prevent flicker
        if let oldTheme = oldTheme, let newTheme = theme {
            let themeChanged = oldTheme.background != newTheme.background ||
                              oldTheme.text != newTheme.text ||
                              oldTheme.link != newTheme.link
            if themeChanged {
                applyTheme()
            }
        } else {
            // First load or theme was nil, apply it
            applyTheme()
        }

        // Adjust keyboard layout to better match the current field type (URL, number, etc.)
        keyboardView?.updateForKeyboardType(textDocumentProxy.keyboardType ?? .default)
        
        // Update return key text based on returnKeyType
        keyboardView?.updateReturnKeyType(textDocumentProxy.returnKeyType ?? .default)
        
        // Auto-capitalize on keyboard appearance (e.g., start of new text field)
        keyboardView?.performAutoCapitalizationCheck()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // iOS may change the field type as the user moves between fields; update layout accordingly.
        keyboardView?.updateForKeyboardType(textDocumentProxy.keyboardType ?? .default)
        
        // Update return key text based on returnKeyType
        keyboardView?.updateReturnKeyType(textDocumentProxy.returnKeyType ?? .default)
        
        // Reload theme in case user switched to a different app/field that has a per-app theme
        let oldTheme = theme
        loadTheme()
        
        // Apply theme if it changed
        if let oldTheme = oldTheme, let newTheme = theme {
            let themeChanged = oldTheme.background != newTheme.background ||
                              oldTheme.text != newTheme.text ||
                              oldTheme.link != newTheme.link
            if themeChanged {
                applyTheme()
            }
        } else if theme != nil {
            // Theme was nil before, now we have one
            applyTheme()
        }
    }
    
    private func loadTheme() {
        print("🔥🔥🔥 KeyboardExtension: loadTheme() called")
        
        // Get enhanced app detection with confidence scoring
        let keyboardType = textDocumentProxy.keyboardType ?? .default
        let returnKeyType = textDocumentProxy.returnKeyType ?? .default
        let textContentType: UITextContentType? = textDocumentProxy.textContentType ?? nil
        
        let detection = KeyboardThemeManager.inferAppBundleID(
            keyboardType: keyboardType,
            returnKeyType: returnKeyType,
            textContentType: textContentType
        )
        
        var inferredAppBundleID: String? = nil
        
        if let bundleId = detection.bundleId {
            print("🔥🔥🔥 KeyboardExtension: App detection - Bundle ID: \(bundleId), Confidence: \(detection.confidence)")
            
            // Only use detection if confidence is reasonable
            if detection.confidence >= 0.3 {
                inferredAppBundleID = bundleId
                print("🔥🔥🔥 KeyboardExtension: Using detected app: \(bundleId)")
            } else {
                print("🔥🔥🔥 KeyboardExtension: Low confidence (\(detection.confidence)), using global theme")
            }
        } else {
            print("🔥🔥🔥 KeyboardExtension: No app detected, using global keyboard theme")
        }
        
        // Load theme (per-app if available, otherwise keyboard theme)
        theme = KeyboardThemeManager.getKeyboardTheme(forAppBundleID: inferredAppBundleID)
        
        if let theme = theme {
            let themeSource = inferredAppBundleID != nil ? "app-specific" : "global"
            print("🔥🔥🔥 KeyboardExtension: \(themeSource) theme loaded - background: \(theme.background), text: \(theme.text)")
        } else {
            print("🔥🔥🔥 KeyboardExtension: No theme loaded (returned nil)")
        }
    }
    
    private func setupKeyboard() {
        // Remove any existing keyboard view
        keyboardView?.removeFromSuperview()
        
        // Create new keyboard view
        let newKeyboardView = KeyboardView()
        newKeyboardView.translatesAutoresizingMaskIntoConstraints = false
        newKeyboardView.delegate = self
        newKeyboardView.showsNextKeyboardKey = needsInputModeSwitchKey
        
        view.addSubview(newKeyboardView)
        
        // CRITICAL: Direct height constraint on the VC's view at priority 999
        // This is the most reliable way to control keyboard extension height.
        // The internal backgroundView constraint at .defaultHigh (750) handles internal layout,
        // but THIS constraint actually tells the system the keyboard's desired height.
        let hc = view.heightAnchor.constraint(equalToConstant: 291)
        hc.priority = UILayoutPriority(999)
        hc.isActive = true
        self.keyboardHeightConstraint = hc
        
        preferredContentSize = CGSize(width: view.bounds.width, height: 291)
        
        NSLayoutConstraint.activate([
            newKeyboardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            newKeyboardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            newKeyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            newKeyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        
        keyboardView = newKeyboardView
        
        // Apply theme
        applyTheme()
    }
    
    private func applyTheme() {
        guard let theme = theme else {
            // Default theme if no theme loaded
            view.backgroundColor = UIColor.systemBackground
            keyboardView?.applyTheme(background: UIColor.systemBackground, text: UIColor.label, link: UIColor.systemBlue, keyColor: nil)
            return
        }
        
        view.backgroundColor = theme.backgroundColor
        keyboardView?.applyTheme(
            background: theme.backgroundColor,
            text: theme.textColor,
            link: theme.linkColor,
            keyColor: theme.keyBackgroundColor,
            backgroundType: theme.backgroundType,
            backgroundGradient: theme.backgroundGradient
        )
    }
}

// MARK: - KeyboardViewDelegate
extension KeyboardViewController: KeyboardViewDelegate {
    func didTapKey(_ key: String) {
        textDocumentProxy.insertText(key)
    }
    
    func didTapBackspace() {
        textDocumentProxy.deleteBackward()
    }
    
    func didTapReturn() {
        // Use the return key type from the text field
        let returnKeyType = textDocumentProxy.returnKeyType
        switch returnKeyType {
        case .next:
            textDocumentProxy.insertText("\n")
        case .go:
            textDocumentProxy.insertText("\n")
        case .search:
            textDocumentProxy.insertText("\n")
        case .send:
            textDocumentProxy.insertText("\n")
        case .done:
            textDocumentProxy.insertText("\n")
        default:
            textDocumentProxy.insertText("\n")
        }
    }
    
    func didTapSpace() {
        textDocumentProxy.insertText(" ")
    }
    
    func didTapShift() {
        // Shift functionality handled in KeyboardView
    }
    
    func didTapNumbers() {
        // Mode switch handled in KeyboardView
    }
    
    func didTapLetters() {
        // Mode switch handled in KeyboardView
    }
    
    func didTapSymbols() {
        // Mode switch handled in KeyboardView
    }

    func didTapNextKeyboard() {
        advanceToNextInputMode()
    }
    
    func didTapEmoji() {
        // Emoji picker is handled within KeyboardView
        // No action needed here - the view handles the toggle internally
    }
    
    func didTapPeriod() {
        textDocumentProxy.insertText(".")
    }
    
    func getDocumentContextBeforeInput() -> String? {
        return textDocumentProxy.documentContextBeforeInput
    }
    
    func emojiPickerToggled(isShowing: Bool) {
        // Emoji keyboard is significantly taller than regular keyboard on iOS
        // Regular = 291pt, Emoji = 370pt
        let newHeight: CGFloat = isShowing ? 370 : 291
        
        // Update the direct height constraint (priority 999 — most reliable for keyboard extensions)
        keyboardHeightConstraint?.constant = newHeight
        
        // Also update preferredContentSize as an additional hint
        preferredContentSize = CGSize(width: view.bounds.width, height: newHeight)
        
        // Force layout pass so the system picks up the new height immediately
        view.setNeedsLayout()
        view.layoutIfNeeded()
    }
    
    func shouldAutoCapitalize() -> Bool {
        // Respect the autocapitalization type set by the text field
        let autoCapType = textDocumentProxy.autocapitalizationType ?? .sentences
        
        switch autoCapType {
        case .none:
            return false
        case .words:
            // Capitalize at start of input or after any whitespace
            guard let context = textDocumentProxy.documentContextBeforeInput else { return true }
            return context.isEmpty || context.last == " " || context.last == "\n"
        case .allCharacters:
            return true
        case .sentences:
            // Default iOS behavior: capitalize at start and after sentence-ending punctuation + space
            guard let context = textDocumentProxy.documentContextBeforeInput else { return true }
            if context.isEmpty { return true }
            
            // After newline
            if context.last == "\n" { return true }
            
            // After sentence-ending punctuation followed by space
            if context.last == " " {
                let beforeSpace = String(context.dropLast()).trimmingCharacters(in: .whitespaces)
                if let lastChar = beforeSpace.last {
                    return lastChar == "." || lastChar == "!" || lastChar == "?"
                }
                // Only spaces — treat as start of sentence
                return true
            }
            
            return false
        @unknown default:
            return false
        }
    }
    
    func playKeyClickSound() {
        // Play the standard system keyboard click
        // This respects the user's "Keyboard Clicks" setting in iOS Settings > Sounds
        UIDevice.current.playInputClick()
    }
}

// MARK: - UIInputViewAudioFeedback
// Required for playInputClick() to work — tells the system this keyboard supports click sounds
extension KeyboardViewController: UIInputViewAudioFeedback {
    var enableInputClicksWhenVisible: Bool { return true }
}
