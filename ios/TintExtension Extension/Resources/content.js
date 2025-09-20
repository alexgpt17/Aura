function applyTheme(theme) {
  // Remove existing theme style element if it exists
  const existingStyle = document.getElementById('tint-theme');
  if (existingStyle) {
    existingStyle.remove();
  }

  // If the theme is disabled, don't apply a new one
  if (!theme || theme.enabled === false) {
      console.log("Tint theme is disabled.");
      return;
  }

  console.log("Applying Tint theme:", theme);

  const style = document.createElement('style');
  style.id = 'tint-theme';
  style.innerHTML = `
    body, body * {
      background-color: ${theme.background} !important;
      color: ${theme.text} !important;
    }
    a, a * {
      color: ${theme.link} !important;
    }
  `;
  document.documentElement.appendChild(style);
}

// Function to request the theme from the native extension
function getThemeAndApply() {
    browser.runtime.sendMessage({ type: "GET_THEME" }).then(response => {
        if (response && response.theme) {
            applyTheme(response.theme);
        } else {
            console.error("Tint Error: Invalid theme response from extension.", response);
        }
    }).catch(error => {
        console.error("Tint Error: Could not get theme from extension.", error);
    });
}

// Apply the theme as soon as the content script is injected
getThemeAndApply();

// Optional: Listen for messages to dynamically update the theme without a page reload
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'THEME_UPDATED') {
        console.log("Theme updated message received.");
        getThemeAndApply();
    }
});
