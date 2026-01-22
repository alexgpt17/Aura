// Background script - Syncs App Group → browser.storage.local on extension load
// iOS Safari: Must use sendNativeMessage (not sendMessage) to reach native handler
// This runs when Safari loads the extension

console.log("Tint background script: Loading");

/**
 * Syncs theme data from App Group to browser.storage.local
 * Called on initial load and when content scripts request updates
 */
async function syncThemeFromAppGroup() {
    try {
        console.log("Tint background: Requesting theme sync from native handler via sendNativeMessage");
        
        // On iOS Safari, must use sendNativeMessage (not sendMessage)
        // The application ID is ignored on iOS but must be present
        const response = await new Promise((resolve, reject) => {
            browser.runtime.sendNativeMessage(
                "org.reactjs.native.example.TintApp.TintExtensionExtension",
                { type: "syncTheme" },
                (response) => {
                    if (browser.runtime.lastError) {
                        reject(new Error(browser.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                }
            );
        });
        
        console.log("Tint background: Response from native handler:", response);
        
        if (response && response.themeData) {
            // Store in browser.storage.local
            await browser.storage.local.set({
                tintThemeData: response.themeData
            });
            console.log("Tint background: Theme data synced to storage successfully", response.themeData);
            return true;
        } else {
            console.log("Tint background: No themeData in response");
            return false;
        }
    } catch (error) {
        console.error("Tint background: Error syncing theme:", error);
        console.error("Tint background: Error details:", error.message, error.stack);
        return false;
    }
}

// Sync theme data from App Group to storage immediately on extension load
syncThemeFromAppGroup();

// Listen for messages from content scripts requesting theme updates
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "checkThemeUpdate") {
        console.log("Tint background: Received checkThemeUpdate request from content script");
        
        // Sync from App Group and respond
        syncThemeFromAppGroup().then((success) => {
            sendResponse({ success: success });
        }).catch((error) => {
            console.error("Tint background: Error in checkThemeUpdate:", error);
            sendResponse({ success: false, error: error.message });
        });
        
        // Return true to indicate we will send response asynchronously
        return true;
    }
});
