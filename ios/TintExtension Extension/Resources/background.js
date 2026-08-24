// Background script - Syncs App Group → browser.storage.local on extension load
// iOS Safari: Must use sendNativeMessage (not sendMessage) to reach native handler
// This runs when Safari loads the extension

console.log("Tint background script: LOADING - This should appear in Safari console");
console.log("Tint background: browser.runtime.sendNativeMessage exists?", typeof browser.runtime.sendNativeMessage);
console.log("Tint background: browser.runtime exists?", typeof browser.runtime);

// Keep track of last sync time to prevent excessive syncing
let lastSyncTime = 0;
let lastStorageWriteTime = 0;
const MIN_SYNC_INTERVAL = 5000; // 5 seconds minimum between syncs
const MIN_STORAGE_WRITE_INTERVAL = 1000; // 1 second minimum between storage writes
let lastKnownTheme = null;
let pendingWrite = null;

/**
 * Syncs theme data from App Group to browser.storage.local
 * Called on initial load and when content scripts request updates
 */
async function syncThemeFromAppGroup() {
    try {
        console.log("Tint background: Requesting theme sync from native handler via sendNativeMessage");
        
        if (!browser.runtime.sendNativeMessage) {
            const error = new Error("sendNativeMessage is not available");
            console.error("Tint background: ERROR - sendNativeMessage not available!");
            throw error;
        }
        
        const response = await new Promise((resolve, reject) => {
            let messageCompleted = false;
            
            // Add timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                if (!messageCompleted) {
                    messageCompleted = true;
                    console.error("Tint background: sendNativeMessage TIMEOUT after 3 seconds");
                    reject(new Error("Native message timeout"));
                }
            }, 3000);
            
            browser.runtime.sendNativeMessage(
                "com.alexmartens.aura.SafariExtension",
                { type: "syncTheme" },
                (response) => {
                    if (!messageCompleted) {
                        messageCompleted = true;
                        clearTimeout(timeoutId);
                        
                        if (browser.runtime.lastError) {
                            console.error("Tint background: sendNativeMessage ERROR:", browser.runtime.lastError.message);
                            reject(new Error(browser.runtime.lastError.message));
                        } else {
                            console.log("Tint background: sendNativeMessage SUCCESS");
                            resolve(response);
                        }
                    }
                }
            );
        });
        
        if (response && response.themeData) {
            const newData = response.themeData;
            
            // Get current data to compare
            const currentData = await browser.storage.local.get('tintThemeData');
            
            // Normalize for comparison
            const normalizeForComparison = (data) => {
                if (!data) return null;
                const normalized = JSON.parse(JSON.stringify(data));
                delete normalized._lastUpdated;
                delete normalized._syncCount;
                delete normalized._forceUpdate;
                return normalized;
            };
            
            const currentNormalized = normalizeForComparison(currentData?.tintThemeData);
            const newNormalized = normalizeForComparison(newData);
            
            let themeChanged = false;
            if (!currentNormalized || !newNormalized) {
                themeChanged = currentNormalized !== newNormalized;
            } else {
                const currentStr = JSON.stringify(currentNormalized);
                const newStr = JSON.stringify(newNormalized);
                themeChanged = currentStr !== newStr;
                
                if (!themeChanged && currentNormalized.globalTheme && newNormalized.globalTheme) {
                    const currentTheme = currentNormalized.globalTheme;
                    const newTheme = newNormalized.globalTheme;
                    themeChanged =
                        currentTheme.background !== newTheme.background ||
                        currentTheme.text !== newTheme.text ||
                        currentTheme.link !== newTheme.link ||
                        currentTheme.enabled !== newTheme.enabled ||
                        currentTheme.backgroundType !== newTheme.backgroundType ||
                        currentTheme.backgroundGradient !== newTheme.backgroundGradient ||
                        currentTheme.backgroundImage !== newTheme.backgroundImage;
                }
            }
            
            if (themeChanged) {
                console.log("Change detected! Will update storage (debounced).");
                console.log("Tint background: New theme - background:", newData.globalTheme?.background,
                           "text:", newData.globalTheme?.text);
                
                lastKnownTheme = newData.globalTheme;
                
                // Debounce storage write - only write if enough time has passed
                const now = Date.now();
                if (now - lastStorageWriteTime >= MIN_STORAGE_WRITE_INTERVAL) {
                    // Write immediately
                    await writeToStorage(newData);
                    lastStorageWriteTime = now;
                } else {
                    // Debounce - schedule write for later
                    if (pendingWrite) {
                        clearTimeout(pendingWrite);
                    }
                    const delay = MIN_STORAGE_WRITE_INTERVAL - (now - lastStorageWriteTime);
                    console.log("Tint background: Debouncing storage write (" + delay + "ms delay)");
                    const dataToWrite = newData;
                    pendingWrite = setTimeout(() => {
                        writeToStorage(dataToWrite);
                        lastStorageWriteTime = Date.now();
                        pendingWrite = null;
                    }, delay);
                }
            } else {
                console.log("Tint background: Theme unchanged, skipping storage write");
            }
            
            return true;
        } else {
            console.log("Tint background: No themeData in response from native handler");
            return false;
        }
    } catch (error) {
        console.error("Tint background: Error syncing theme:", error);
        
        // CRITICAL: If native messaging fails, try to preserve existing cache
        // Don't clear storage - let content scripts continue using cached theme
        if (error.message?.includes("timeout") || error.message?.includes("Native message")) {
            console.error("Tint background: Native handler appears to be unresponsive");
            console.error("Tint background: Theme updates may be stuck - preserving cached theme");
            
            // Try to force re-sync by clearing internal state
            lastSyncTime = 0;
            lastStorageWriteTime = 0;
            if (pendingWrite) {
                clearTimeout(pendingWrite);
                pendingWrite = null;
            }
            
            return false;
        }
        
        return false;
    }
}

async function writeToStorage(newData) {
    try {
        const dataToStore = JSON.parse(JSON.stringify(newData));
        dataToStore._lastUpdated = Date.now();
        dataToStore._syncCount = (newData._syncCount || 0) + 1;
        dataToStore._forceUpdate = Math.random();
        
        await browser.storage.local.set({
            tintThemeData: dataToStore
        });
        console.log("Tint background: Theme data synced to storage successfully");
        
        // Broadcast to tabs
        if (browser.tabs && browser.tabs.query) {
            try {
                const tabs = await browser.tabs.query({});
                const globalTheme = newData.globalTheme;
                
                let messagesSent = 0;
                tabs.forEach(tab => {
                    if (tab.id !== undefined && tab.url) {
                        try {
                            let themeToSend = globalTheme;
                            const tabHostname = new URL(tab.url).hostname;
                            
                            if (newData.siteThemes?.[tabHostname]?.enabled !== false
                                && newData.siteThemes?.[tabHostname]) {
                                themeToSend = newData.siteThemes[tabHostname];
                            } else if (newData.timeBasedRule?.enabled) {
                                // Approximate day/night here so newly opened tabs
                                // get the right theme immediately; content.js also
                                // re-resolves on a 60s timer.
                                const rule = newData.timeBasedRule;
                                const now = new Date();
                                const mins = now.getHours() * 60 + now.getMinutes();
                                const parse = (v) => {
                                    const p = String(v || '0:0').split(':');
                                    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
                                };
                                const dayStart = parse(rule.dayStartTime || '07:00');
                                const nightStart = parse(rule.nightStartTime || '19:00');
                                const isDay = dayStart <= nightStart
                                    ? (mins >= dayStart && mins < nightStart)
                                    : (mins >= dayStart || mins < nightStart);
                                const timed = isDay ? rule.dayThemeColors : rule.nightThemeColors;
                                if (timed) themeToSend = timed;
                            }
                            
                            if (themeToSend) {
                                browser.tabs.sendMessage(tab.id, {
                                    type: "UPDATE_THEME",
                                    theme: themeToSend,
                                    themeData: newData
                                }).then(() => {
                                    messagesSent++;
                                }).catch(() => {});
                            }
                        } catch (e) {}
                    }
                });
                console.log("Tint background: Sent UPDATE_THEME messages to", messagesSent, "tabs");
            } catch (error) {
                console.error("Tint background: Error sending messages:", error);
            }
        }
    } catch (error) {
        console.error("Tint background: Error writing to storage:", error);
    }
}

// Sync theme data from App Group to storage immediately on extension load
syncThemeFromAppGroup();

// Listen for messages from content scripts requesting theme updates
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "checkThemeUpdate") {
        console.log("Tint background: Received checkThemeUpdate request from content script");
        
        let responseSent = false;
        
        const timeout = setTimeout(() => {
            if (!responseSent) {
                responseSent = true;
                console.error("Tint background: Sync timeout - sending error response");
                sendResponse({ success: false, error: "Sync timeout" });
            }
        }, 5000);
        
        syncThemeFromAppGroup().then((success) => {
            clearTimeout(timeout);
            if (!responseSent) {
                responseSent = true;
                console.log("Tint background: Sync complete, sending response");
                sendResponse({ success: success === true });
            }
        }).catch((error) => {
            clearTimeout(timeout);
            if (!responseSent) {
                responseSent = true;
                console.error("Tint background: Error in checkThemeUpdate:", error);
                sendResponse({ success: false, error: error.message });
            }
        });
        
        return true;
    }
    
    return false;
});

// Periodic sync with debouncing
setInterval(() => {
    const now = Date.now();
    if (now - lastSyncTime < MIN_SYNC_INTERVAL) {
        console.log("Tint background: Skipping sync (only " + (now - lastSyncTime) + "ms since last)");
        return;
    }
    
    lastSyncTime = now;
    console.log("Tint background: Running periodic sync");
    
    syncThemeFromAppGroup().catch(error => {
        console.error("Tint background: Error in periodic sync:", error);
    });
}, 5000);
