// Content script - Noir-style static injection model
// Reads theme from window.__TINT_THEME_DATA__ (injected by native handler)
// No async messaging - iOS Safari compatible

console.log("Tint content script loaded");

/**
 * Applies the given theme to the document.
 */
function applyTheme(theme) {
    // Remove existing theme style element
    const existingStyle = document.getElementById('tint-theme');
    if (existingStyle) {
        existingStyle.remove();
    }

    // If theme is disabled, don't apply
    if (!theme || theme.enabled === false) {
        console.log("Tint: Theme is disabled");
        return;
    }

    console.log("Tint: Applying theme:", theme);

    // Determine background CSS
    let backgroundCSS = '';
    const backgroundType = theme.backgroundType || 'color';

    if (backgroundType === 'image' && theme.backgroundImage) {
        backgroundCSS = `
            background-image: url("${theme.backgroundImage}") !important;
            background-size: cover !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            background-attachment: fixed !important;
            background-color: ${theme.background || 'transparent'} !important;
        `;
    } else {
        backgroundCSS = `background-color: ${theme.background || '#FFFFFF'} !important;`;
    }

    const style = document.createElement('style');
    style.id = 'tint-theme';
    style.innerHTML = `
        html, body, body * {
            ${backgroundCSS}
            color: ${theme.text || '#000000'} !important;
        }
        a, a * {
            color: ${theme.link || '#0000EE'} !important;
        }
    `;
    document.documentElement.appendChild(style);
}

/**
 * Reads theme config from window.__TINT_THEME_DATA__
 * Waits for injected script to load theme data from storage
 * Noir-style: reads from injected global, no per-page messaging
 */
async function getThemeConfig() {
    const hostname = window.location.hostname;
    console.log("Tint: Loading theme config for:", hostname);
    
    // Wait for injected script to finish loading theme data
    if (!window.__TINT_THEME_DATA__) {
        console.log("Tint: window.__TINT_THEME_DATA__ not yet available");
        return null;
    }
    
    // Wait for async storage load to complete
    let attempts = 0;
    while (!window.__TINT_THEME_DATA__._ready && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 10));
        attempts++;
    }
    
    const themeData = window.__TINT_THEME_DATA__;
    
    if (!themeData || !themeData.globalTheme) {
        console.log("Tint: No theme data found");
        return null;
    }
    
    // Determine which theme to apply (global or site-specific)
    let themeToApply = { ...themeData.globalTheme };
    
    if (themeData.siteThemes && themeData.siteThemes[hostname]) {
        // Merge site-specific theme over global
        themeToApply = { ...themeToApply, ...themeData.siteThemes[hostname] };
        console.log("Tint: Using site-specific theme for", hostname);
    } else {
        console.log("Tint: Using global theme");
    }
    
    return themeToApply;
}

/**
 * Loads and applies theme on page load
 * Noir-style: reads from injected global variable
 */
async function loadAndApplyTheme() {
    const themeConfig = await getThemeConfig();
    
    if (themeConfig) {
        applyTheme(themeConfig);
        window.__TINT_THEME__ = themeConfig;
    } else {
        console.log("Tint: No theme config available");
    }
}

// Load and apply theme when page loads
loadAndApplyTheme();

/**
 * Triggers a theme sync by requesting background script to check for updates
 * This ensures fresh theme data when user returns to Safari after changing settings
 */
async function requestThemeUpdate() {
    try {
        console.log("Tint: Requesting theme update from background script");
        const response = await browser.runtime.sendMessage({ type: "checkThemeUpdate" });
        
        if (response && response.success) {
            console.log("Tint: Theme update successful, reloading theme from storage");
            // Wait a moment for storage to update, then reload theme
            setTimeout(async () => {
                // Reload theme data from storage via injected script's mechanism
                // The storage change listener will handle applying it
                await loadAndApplyTheme();
            }, 100);
        } else {
            console.log("Tint: Theme update failed or no changes");
        }
    } catch (error) {
        console.error("Tint: Error requesting theme update:", error);
        // Still try to reload theme in case storage was updated
        await loadAndApplyTheme();
    }
}

// Listen for storage changes (when background script updates theme data)
if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.tintThemeData) {
            console.log("Tint: Storage changed, theme data updated");
            
            // Update the injected script's global data
            if (changes.tintThemeData.newValue) {
                window.__TINT_THEME_DATA__ = changes.tintThemeData.newValue;
                window.__TINT_THEME_DATA__._ready = true;
                
                // Re-apply theme with new data
                loadAndApplyTheme();
            }
        }
    });
}

// Listen for visibility changes (Safari tab focus) to check for theme updates
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        console.log("Tint: Page visible, checking for theme updates");
        requestThemeUpdate();
    }
});

// Also handle SPA navigation (if needed)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log("Tint: URL changed, re-applying theme");
        loadAndApplyTheme();
    }
}).observe(document, { subtree: true, childList: true });
