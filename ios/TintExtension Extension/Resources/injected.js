// Injected script - runs before content.js
// Noir-style: Try to get theme data directly from native handler via sendMessage
// If that fails, fall back to storage

(function() {
    'use strict';
    
    // Initialize theme data
    window.__TINT_THEME_DATA__ = {
        globalTheme: null,
        siteThemes: {},
        _ready: false
    };
    
    // CRITICAL: On iOS Safari, sendMessage doesn't work - go straight to storage
    // The background script should have synced from App Group already
    console.log('🔥🔥🔥 Tint injected: Loading theme from storage (sendMessage not reliable on iOS)');
    loadFromStorage();
    
    function loadFromStorage() {
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get('tintThemeData').then(result => {
                if (result.tintThemeData) {
                    window.__TINT_THEME_DATA__ = result.tintThemeData;
                    window.__TINT_THEME_DATA__._ready = true;
                    console.log('🔥🔥🔥 Tint injected: Theme data loaded from storage');
                    if (result.tintThemeData.globalTheme) {
                        console.log('🔥🔥🔥 Tint injected: Theme - background:', result.tintThemeData.globalTheme.background, 'text:', result.tintThemeData.globalTheme.text);
                        // EARLY: Set theme-color meta tag immediately to prevent white flash
                        // This controls iOS Safari's status bar and overscroll color
                        injectThemeColorMeta(result.tintThemeData.globalTheme.background);
                    }
                } else {
                    window.__TINT_THEME_DATA__._ready = true;
                    console.log('🔥🔥🔥 Tint injected: No theme data available in storage');
                }
            }).catch(error => {
                console.error('🔥🔥🔥 Tint injected: Error loading from storage:', error);
                window.__TINT_THEME_DATA__._ready = true;
            });
        } else {
            window.__TINT_THEME_DATA__._ready = true;
            console.log('🔥🔥🔥 Tint injected: browser.storage not available');
        }
    }
    
    // Listen for storage changes to update global theme data
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.tintThemeData) {
                console.log('Tint injected: Storage changed, updating theme data');
                if (changes.tintThemeData.newValue) {
                    window.__TINT_THEME_DATA__ = changes.tintThemeData.newValue;
                    window.__TINT_THEME_DATA__._ready = true;
                }
            }
        });
    }
    
    // Inject theme-color meta tag for iOS Safari overscroll/status bar
    function injectThemeColorMeta(bgColor) {
        if (!bgColor) return;
        try {
            const head = document.head || document.documentElement;
            if (!head) return;
            let themeColorMeta = document.querySelector('meta[name="theme-color"]');
            if (themeColorMeta) {
                themeColorMeta.setAttribute('content', bgColor);
            } else {
                themeColorMeta = document.createElement('meta');
                themeColorMeta.setAttribute('name', 'theme-color');
                themeColorMeta.setAttribute('content', bgColor);
                head.appendChild(themeColorMeta);
            }
        } catch (e) {
            // Ignore errors during early injection
        }
    }
    
    // Inject viewport meta tag for safe area support
    function injectViewportMeta() {
        if (document.head) {
            // Check if viewport meta already exists
            let viewportMeta = document.querySelector('meta[name="viewport"]');
            if (!viewportMeta) {
                viewportMeta = document.createElement('meta');
                viewportMeta.setAttribute('name', 'viewport');
                viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
                document.head.appendChild(viewportMeta);
            } else {
                // Update existing viewport meta to include viewport-fit=cover
                const content = viewportMeta.getAttribute('content') || '';
                if (!content.includes('viewport-fit=cover')) {
                    viewportMeta.setAttribute('content', content + ', viewport-fit=cover');
                }
            }
        }
    }
    
    // Inject viewport meta immediately if head exists, otherwise wait for DOM
    if (document.head) {
        injectViewportMeta();
    } else {
        document.addEventListener('DOMContentLoaded', injectViewportMeta);
    }
})();
