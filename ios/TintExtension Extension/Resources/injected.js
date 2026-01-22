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
    
    // Try to sync from native handler first (most reliable)
    console.log('Tint injected: Checking browser.runtime.sendMessage availability');
    console.log('Tint injected: browser exists?', typeof browser !== 'undefined');
    console.log('Tint injected: browser.runtime exists?', typeof browser !== 'undefined' && !!browser.runtime);
    console.log('Tint injected: browser.runtime.sendMessage exists?', typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.sendMessage === 'function');
    
    if (typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.sendMessage === 'function') {
        console.log('Tint injected: Attempting to call native handler via sendMessage');
        browser.runtime.sendMessage({ type: "syncTheme" }).then(response => {
            console.log('Tint injected: sendMessage promise resolved with:', response);
            console.log('Tint injected: response type:', typeof response);
            console.log('Tint injected: response is null?', response === null);
            console.log('Tint injected: response is undefined?', response === undefined);
            
            if (response && response.themeData) {
                window.__TINT_THEME_DATA__ = response.themeData;
                window.__TINT_THEME_DATA__._ready = true;
                console.log('Tint injected: Theme data loaded from native handler', response.themeData);
                
                // Also cache in storage for next time
                if (browser.storage) {
                    browser.storage.local.set({ tintThemeData: response.themeData });
                }
            } else {
                console.log('Tint injected: No themeData in response, falling back to storage');
                // Fall back to storage
                loadFromStorage();
            }
        }).catch(error => {
            console.error('Tint injected: sendMessage promise rejected with error:', error);
            console.error('Tint injected: Error message:', error?.message);
            console.error('Tint injected: Error stack:', error?.stack);
            console.log('Tint injected: Falling back to storage due to error');
            loadFromStorage();
        });
    } else {
        console.log('Tint injected: sendMessage not available, using storage only');
        loadFromStorage();
    }
    
    function loadFromStorage() {
        if (typeof browser !== 'undefined' && browser.storage) {
            browser.storage.local.get('tintThemeData').then(result => {
                if (result.tintThemeData) {
                    window.__TINT_THEME_DATA__ = result.tintThemeData;
                    window.__TINT_THEME_DATA__._ready = true;
                    console.log('Tint injected: Theme data loaded from storage', result.tintThemeData);
                } else {
                    window.__TINT_THEME_DATA__._ready = true;
                    console.log('Tint injected: No theme data available');
                }
            }).catch(error => {
                console.error('Tint injected: Error loading from storage:', error);
                window.__TINT_THEME_DATA__._ready = true;
            });
        } else {
            window.__TINT_THEME_DATA__._ready = true;
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
})();
