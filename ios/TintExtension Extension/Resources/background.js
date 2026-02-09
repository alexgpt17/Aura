// Background script - Syncs App Group → browser.storage.local on extension load
// iOS Safari: Must use sendNativeMessage (not sendMessage) to reach native handler
// This runs when Safari loads the extension

console.log("🔥🔥🔥 Tint background script: LOADING - This should appear in Safari console");
console.log("🔥🔥🔥 Tint background: browser.runtime.sendNativeMessage exists?", typeof browser.runtime.sendNativeMessage);
console.log("🔥🔥🔥 Tint background: browser.runtime exists?", typeof browser.runtime);

/**
 * Syncs theme data from App Group to browser.storage.local
 * Called on initial load and when content scripts request updates
 */
async function syncThemeFromAppGroup() {
    try {
        console.log("🔥🔥🔥 Tint background: Requesting theme sync from native handler via sendNativeMessage");
        console.log("🔥🔥🔥 Tint background: sendNativeMessage type:", typeof browser.runtime.sendNativeMessage);
        
        // On iOS Safari, must use sendNativeMessage (not sendMessage)
        // The application ID is ignored on iOS but must be present
        const response = await new Promise((resolve, reject) => {
            console.log("🔥🔥🔥 Tint background: About to call sendNativeMessage");
            
            if (!browser.runtime.sendNativeMessage) {
                const error = new Error("sendNativeMessage is not available");
                console.error("🔥🔥🔥 Tint background: ERROR - sendNativeMessage not available!");
                reject(error);
                return;
            }
            
            browser.runtime.sendNativeMessage(
                "org.reactjs.native.example.TintApp.TintExtensionExtension.Extension",
                { type: "syncTheme" },
                (response) => {
                    console.log("🔥🔥🔥 Tint background: sendNativeMessage callback fired");
                    if (browser.runtime.lastError) {
                        console.error("🔥🔥🔥 Tint background: sendNativeMessage ERROR:", browser.runtime.lastError.message);
                        reject(new Error(browser.runtime.lastError.message));
                    } else {
                        console.log("🔥🔥🔥 Tint background: sendNativeMessage SUCCESS, response:", response);
                        resolve(response);
                    }
                }
            );
        });
        
        console.log("Tint background: Response from native handler:", response);
        
        if (response && response.themeData) {
            const newData = response.themeData;
            
            // Get current data to compare
            const currentData = await browser.storage.local.get('tintThemeData');
            const currentTheme = currentData?.tintThemeData?.globalTheme;
            const newTheme = newData.globalTheme;
            
            // Log what we're about to store
            if (newTheme) {
                console.log("Tint background: Syncing theme - background:", newTheme.background, 
                           "text:", newTheme.text, "enabled:", newTheme.enabled);
                
                // Check if theme actually changed
                const themeChanged = !currentTheme || 
                    currentTheme.background !== newTheme.background ||
                    currentTheme.text !== newTheme.text ||
                    currentTheme.link !== newTheme.link;
                
                if (themeChanged) {
                    console.log("Tint background: Theme CHANGED - updating storage");
                } else {
                    console.log("Tint background: Theme unchanged (still:", newTheme.background + ")");
                }
            }
            
            // Always update storage - create a new object to ensure change is detected
            // This is critical: browser.storage.local.set() might not fire onChanged
            // if the object reference is the same, even with property changes
            const dataToStore = JSON.parse(JSON.stringify(newData)); // Deep clone
            dataToStore._lastUpdated = Date.now();
            dataToStore._syncCount = (newData._syncCount || 0) + 1;
            dataToStore._forceUpdate = Math.random(); // Random value to force change detection
            
            await browser.storage.local.set({
                tintThemeData: dataToStore
            });
            console.log("🔥🔥🔥 Tint background: Theme data synced to storage successfully");
            return true;
        } else {
            console.log("🔥🔥🔥 Tint background: No themeData in response from native handler");
            return false;
        }
    } catch (error) {
        console.error("🔥🔥🔥 Tint background: Error syncing theme:", error);
        console.error("🔥🔥🔥 Tint background: Error details:", error.message, error.stack);
        return false;
    }
}

// Sync theme data from App Group to storage immediately on extension load
syncThemeFromAppGroup();

// Listen for messages from content scripts requesting theme updates
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "checkThemeUpdate") {
        console.log("🔥🔥🔥 Tint background: Received checkThemeUpdate request from content script");
        
        // Sync from App Group and respond
        // CRITICAL: Always call sendResponse, even if sync fails
        let responseSent = false;
        
        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
            if (!responseSent) {
                responseSent = true;
                console.error("🔥🔥🔥 Tint background: Sync timeout - sending error response");
                sendResponse({ success: false, error: "Sync timeout" });
            }
        }, 5000);
        
        syncThemeFromAppGroup().then((success) => {
            clearTimeout(timeout);
            if (!responseSent) {
                responseSent = true;
                const successBool = success === true;
                console.log("🔥🔥🔥 Tint background: Sync complete, sending response. Success:", successBool);
                sendResponse({ success: successBool });
            }
        }).catch((error) => {
            clearTimeout(timeout);
            if (!responseSent) {
                responseSent = true;
                console.error("🔥🔥🔥 Tint background: Error in checkThemeUpdate:", error);
                sendResponse({ success: false, error: error.message || String(error) });
            }
        });
        
        // Return true to indicate we will send response asynchronously
        return true;
    }
    
    // If message type doesn't match, still need to respond (or return false)
    return false;
});

// Periodically sync theme data from App Group (every 2 seconds)
// This ensures themes update instantly when changed in the app
setInterval(() => {
    syncThemeFromAppGroup().catch(error => {
        console.error("Tint background: Error in periodic sync:", error);
    });
}, 2000);

