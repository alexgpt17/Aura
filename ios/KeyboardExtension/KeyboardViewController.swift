import UIKit

class KeyboardViewController: UIInputViewController {
    let textChecker = UITextChecker()  // Made public for KeyboardView access
    
    // Common fast-typing corrections for immediate response
    private let fastTypingCorrections: [String: String] = [
        "teh": "the", "hte": "the", "adn": "and", "nad": "and",
        "yuo": "you", "uyo": "you", "wihch": "which", "wich": "which",
        "becuase": "because", "beause": "because", "recieve": "receive",
        "seperate": "separate", "definately": "definitely", "dont": "don't",
        "wont": "won't", "cant": "can't", "shouldnt": "shouldn't"
    ]
    
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

    override func textWillChange(_ textInput: UITextInput?) {
        super.textWillChange(textInput)
        // iOS calls this before text changes - prepare for optimal performance
        keyboardView?.prepareForTextChange()
    }
    
    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // iOS may change the field type as the user moves between fields; update layout accordingly.
        keyboardView?.updateForKeyboardType(textDocumentProxy.keyboardType ?? .default)
        
        // Update return key text based on returnKeyType
        keyboardView?.updateReturnKeyType(textDocumentProxy.returnKeyType ?? .default)
        
        // Adapt to keyboard appearance (dark mode text fields)
        keyboardView?.updateKeyboardAppearance(textDocumentProxy.keyboardAppearance ?? .default)
        
        // Detect Safari/WebView context for special handling
        if let bundleId = Bundle.main.bundleIdentifier {
            let isSafariContext = textDocumentProxy.documentContextBeforeInput?.contains("http") == true ||
                                textDocumentProxy.documentContextAfterInput?.contains("www") == true ||
                                bundleId.contains("Safari") || bundleId.contains("WebKit")
            keyboardView?.configureSafariMode(isSafariContext)
        }
        
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
        
        // Set controller reference for word-context analysis
        newKeyboardView.keyboardViewController = self
        
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
            keyboardView?.applyTheme(background: UIColor.systemBackground, text: UIColor.label, link: UIColor.systemBlue, keyColor: nil, displayUppercaseKeys: true)
            return
        }
        
        view.backgroundColor = theme.backgroundColor
        keyboardView?.applyTheme(
            background: theme.backgroundColor,
            text: theme.textColor,
            link: theme.linkColor,
            keyColor: theme.keyBackgroundColor,
            backgroundType: theme.backgroundType,
            backgroundGradient: theme.backgroundGradient,
            displayUppercaseKeys: theme.displayUppercaseKeys ?? true
        )
    }
}

// MARK: - KeyboardViewDelegate
extension KeyboardViewController: KeyboardViewDelegate {
    func didTapKey(_ key: String) {
        textDocumentProxy.insertText(key)
        // iOS doesn't autocorrect while typing a word - only on completion
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
        // iOS-style: autocorrect AFTER inserting space, so it doesn't interrupt typing
        textDocumentProxy.insertText(" ")
        checkForAutocorrect()
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
    
    func getDocumentContextAfterInput() -> String? {
        return textDocumentProxy.documentContextAfterInput
    }
    
    func adjustTextPosition(byCharacterOffset offset: Int) {
        // iOS-style cursor positioning for advanced text manipulation
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
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

// MARK: - Autocorrect
extension KeyboardViewController {
    private func checkForAutocorrect() {
        guard let context = textDocumentProxy.documentContextBeforeInput,
              !context.isEmpty else { return }
        
        // iOS-style: Look at the word BEFORE the space we just inserted
        // Since we insert space first, the last character should be space
        guard context.last == " " else { return }
        
        // Get the word before the space
        let contextWithoutSpace = String(context.dropLast())
        let words = contextWithoutSpace.components(separatedBy: CharacterSet.whitespacesAndNewlines)
        guard let lastWord = words.last, !lastWord.isEmpty,
              lastWord.rangeOfCharacter(from: CharacterSet.letters) != nil else { return }
        
        // Skip very short words and words that look like they might be intentional
        guard lastWord.count >= 2 else { return }
        
        // First check our fast typing corrections dictionary
        let lowercaseWord = lastWord.lowercased()
        if let correction = fastTypingCorrections[lowercaseWord] {
            // iOS-style: Delete the word AND the space, then insert correction + space
            for _ in 0..<(lastWord.count + 1) { // +1 for the space
                textDocumentProxy.deleteBackward()
            }
            textDocumentProxy.insertText(correction + " ")
            print("⚡ Fast autocorrect: \(lastWord) → \(correction)")
            return
        }
        
        // For longer words, use UITextChecker
        guard lastWord.count >= 3 else { return }
        
        // Check if word is misspelled
        let wordRange = NSRange(location: 0, length: lastWord.count)
        let misspelledRange = textChecker.rangeOfMisspelledWord(
            in: lastWord,
            range: wordRange,
            startingAt: 0,
            wrap: false,
            language: "en_US"
        )
        
        // If word is misspelled, get corrections
        if misspelledRange.location != NSNotFound {
            let guesses = textChecker.guesses(
                forWordRange: misspelledRange,
                in: lastWord,
                language: "en_US"
            ) ?? []
            
            // iOS-style conservative autocorrect with confidence filtering
            if let correction = guesses.first, shouldApplyCorrection(original: lastWord, suggestion: correction, allGuesses: guesses) {
                // iOS-style: Delete the word AND the space, then insert correction + space
                for _ in 0..<(lastWord.count + 1) { // +1 for the space
                    textDocumentProxy.deleteBackward()
                }
                textDocumentProxy.insertText(correction + " ")
                
                print("📝 Autocorrect: \(lastWord) → \(correction)")
            }
        }
    }
    
    /// iOS-style conservative autocorrect filtering
    /// Based on research: iOS only corrects when highly confident, uses context analysis
    private func shouldApplyCorrection(original: String, suggestion: String, allGuesses: [String]) -> Bool {
        // Don't correct very short words (iOS is conservative here)
        guard original.count >= 3 else { return false }
        
        // Don't correct if the original and suggestion are too similar (likely intentional)
        if editDistance(original.lowercased(), suggestion.lowercased()) <= 1 {
            return false
        }
        
        // iOS confidence factors:
        // 1. Length similarity - iOS prefers corrections that maintain similar length
        let lengthDifference = abs(original.count - suggestion.count)
        if lengthDifference > 2 { return false } // Too different in length
        
        // 2. Multiple candidates reduce confidence - if UITextChecker returns many guesses, less confident
        if allGuesses.count > 5 { return false } // Too many possibilities, uncertain
        
        // 3. Common word filter - iOS is more likely to suggest common words
        let commonWords = ["the", "and", "that", "have", "for", "not", "with", "you", "this", "but", "his", "from", "they", "she", "her", "been", "than", "its", "who", "did", "get", "may", "him", "old", "see", "now", "way", "could", "my", "come", "your", "make", "more", "over"]
        
        // 4. Reject corrections to very uncommon words unless original is clearly wrong
        if !commonWords.contains(suggestion.lowercased()) && allGuesses.count > 2 {
            return false
        }
        
        // 5. Context-based filtering - don't correct if the word might be intentional
        // Check if it looks like a name (starts with capital)
        if original.first?.isUppercase == true && original.count > 3 {
            return false // Likely a proper noun
        }
        
        // 6. Don't correct words that look like abbreviations
        if original.uppercased() == original && original.count <= 4 {
            return false // Likely acronym/abbreviation
        }
        
        return true // Passed all confidence checks
    }
    
    /// Calculate edit distance between two strings (Levenshtein distance)
    private func editDistance(_ s1: String, _ s2: String) -> Int {
        let s1Array = Array(s1)
        let s2Array = Array(s2)
        let s1Count = s1Array.count
        let s2Count = s2Array.count
        
        var dp = Array(repeating: Array(repeating: 0, count: s2Count + 1), count: s1Count + 1)
        
        for i in 0...s1Count {
            dp[i][0] = i
        }
        for j in 0...s2Count {
            dp[0][j] = j
        }
        
        for i in 1...s1Count {
            for j in 1...s2Count {
                if s1Array[i-1] == s2Array[j-1] {
                    dp[i][j] = dp[i-1][j-1]
                } else {
                    dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1
                }
            }
        }
        
        return dp[s1Count][s2Count]
    }
}
