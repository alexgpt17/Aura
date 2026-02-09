// Content script - Modular theme system
// Reads theme from window.__TINT_THEME_DATA__ (injected by native handler)
// Uses site-specific CSS generators for better compatibility

// Configuration constants
const DEBUG = false; // Set to true for debugging
const NATIVE_MESSAGE_ID = "org.reactjs.native.example.TintApp.TintExtensionExtension.Extension";
const THEME_SYNC_DELAY_MS = 500; // Delay before syncing theme from storage
const POLLING_INTERVAL_MS = 5000; // Check for theme updates every 5 seconds (reduced from 2s for battery)
const MUTATION_DEBOUNCE_MS = 100; // Debounce time for MutationObserver

// Gradient positioning constants (for monochrome diagonal split effect)
// The gradient goes from top-right (black) to bottom-left (white) - "to bottom left" direction
// Large size ensures smooth transition across entire scrollable area
// Fixed attachment keeps gradient fixed relative to viewport, creating shifting effect as you scroll
const MONOCHROME_GRADIENT_SIZE = '500% 500%'; // Large enough to show smooth gradient transition
const MONOCHROME_GRADIENT_POSITION = '100% 0%'; // Align gradient so black starts at top-right, white at bottom-left
const DEFAULT_GRADIENT_SIZE = '200% 200%';

// Debug logging utility
function debugLog(...args) {
    if (DEBUG) console.log(...args);
}

function debugError(...args) {
    if (DEBUG) console.error(...args);
}

debugLog("Tint content script loaded");
debugLog("Tint content: Current theme data:", window.__TINT_THEME_DATA__);
debugLog("Tint content: browser.runtime exists?", typeof browser !== 'undefined' && !!browser.runtime);
debugLog("Tint content: browser.storage exists?", typeof browser !== 'undefined' && !!browser.storage);

// DIAGNOSTIC: Immediately try to read from storage to see what's there
if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    browser.storage.local.get('tintThemeData').then(result => {
        debugLog("Tint content: Storage read on load:", result);
        if (result && result.tintThemeData) {
            debugLog("Tint content: Found theme in storage - background:", result.tintThemeData.globalTheme?.background);
            debugLog("Tint content: Found theme in storage - text:", result.tintThemeData.globalTheme?.text);
        } else {
            debugLog("Tint content: NO THEME DATA IN STORAGE!");
        }
    }).catch(e => {
        debugError("Tint content: Error reading storage:", e);
    });
}


/**
 * Calculate luminance of a color (0-1, where 1 is white)
 * Used to determine if a background is "bright" and should be made transparent
 * @param {string|null|undefined} rgb - RGB color string (e.g., "rgb(255, 255, 255)")
 * @returns {number} Luminance value between 0 and 1
 */
function getLuminance(rgb) {
    // Handle null/undefined input
    if (!rgb || typeof rgb !== 'string') return 0.5;
    
    // Handle rgb() format: "rgb(255, 255, 255)" or "rgba(255, 255, 255, 0.5)"
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return 0.5; // Default to medium if can't parse
    
    const r = parseInt(match[0]) / 255;
    const g = parseInt(match[1]) / 255;
    const b = parseInt(match[2]) / 255;
    
    // Relative luminance formula (WCAG)
    const [rs, gs, bs] = [r, g, b].map(val => {
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Check if a gradient string represents a monochrome diagonal split
 * @param {string} gradientStr - Gradient CSS string
 * @returns {boolean} True if it's a monochrome diagonal gradient
 */
function isMonochromeDiagonalGradient(gradientStr) {
    if (!gradientStr || typeof gradientStr !== 'string') return false;
    const lower = gradientStr.toLowerCase();
    return (lower.includes('#000000') || lower.includes('000000')) && 
           (lower.includes('#ffffff') || lower.includes('ffffff') || lower.includes('#fff'));
}

/**
 * Check if theme has changed by comparing key properties
 * @param {Object|null} currentTheme - Current theme object
 * @param {Object} newTheme - New theme object to compare
 * @returns {boolean} True if theme has changed
 */
function hasThemeChanged(currentTheme, newTheme) {
    return !currentTheme || 
        currentTheme.background !== newTheme?.background ||
        currentTheme.text !== newTheme?.text ||
        currentTheme.link !== newTheme?.link ||
        currentTheme.backgroundType !== newTheme?.backgroundType ||
        currentTheme.backgroundGradient !== newTheme?.backgroundGradient ||
        currentTheme.backgroundImage !== newTheme?.backgroundImage;
}

/**
 * Check if an element has a bright background that should be made transparent
 * Returns true if background is bright (luminance > 0.8)
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if background is bright
 */
function isBrightBackground(element) {
    try {
        const style = window.getComputedStyle(element);
        const bgColor = style.backgroundColor;
        
        // If transparent or no background, don't process
        if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
            return false;
        }
        
        // Check if element has distinguishing UI features (border, shadow, etc.)
        // These indicate it's a card/button/UI element that should remain visible
        const hasBorder = style.borderWidth && parseFloat(style.borderWidth) > 0;
        const hasShadow = style.boxShadow && style.boxShadow !== 'none';
        const hasOutline = style.outlineWidth && parseFloat(style.outlineWidth) > 0;
        const hasBorderRadius = parseFloat(style.borderRadius) > 8;
        
        // If element has UI features, don't make it transparent (it's a UI element)
        if (hasBorder || hasShadow || hasOutline || hasBorderRadius) {
            return false;
        }
        
        // Don't make small elements transparent (likely buttons/chips)
        const rect = element.getBoundingClientRect();
        if (rect.width < 200 && rect.height < 100) {
            return false;
        }
        
        // Don't make elements with interactive roles transparent
        const role = element.getAttribute('role');
        if (role && ['button', 'tab', 'menuitem', 'option', 'dialog', 'tooltip', 'alert'].includes(role)) {
            return false;
        }
        
        const luminance = getLuminance(bgColor);
        return luminance > 0.8; // Bright threshold
    } catch (e) {
        return false;
    }
}

/**
 * Apply intelligent transparency to new elements based on luminance
 * Excludes UI elements that need visible backgrounds (buttons, cards, dropdowns, etc.)
 */
function processNewElements() {
    // Find layout containers that might have bright backgrounds
    // Exclude interactive/UI elements that need their backgrounds
    const selector = 'div:not(.tint-transparent):not(.tint-ui-exclude):not(.tint-image-container):not(.tint-icon-preserved)' +
        ':not([role="button"]):not([role="dialog"]):not([role="menu"]):not([role="listbox"])' +
        ':not([role="tooltip"]):not([role="alert"]):not([role="alertdialog"])' +
        ':not([class*="btn"]):not([class*="button"]):not([class*="card"]):not([class*="chip"])' +
        ':not([class*="dropdown"]):not([class*="popup"]):not([class*="popover"])' +
        ':not([class*="tooltip"]):not([class*="toast"]):not([class*="modal"])' +
        ':not([class*="menu"]):not([class*="cookie"]):not([class*="consent"])' +
        ':not([class*="toolbar"]):not([class*="tabbar"]):not([class*="tab-bar"])' +
        ':not([class*="icon"]):not([class*="Icon"])' +
        ', section:not(.tint-transparent):not(.tint-ui-exclude):not(.tint-icon-preserved)' +
        ', article:not(.tint-transparent):not(.tint-ui-exclude):not(.tint-icon-preserved)';
    
    document.querySelectorAll(selector).forEach(el => {
        try {
            const style = window.getComputedStyle(el);
            const zIndex = parseInt(style.zIndex);
            
            // Z-INDEX AWARENESS: Elements with positive z-index are likely floating UI layers
            // (dropdowns, modals, popovers, sticky headers) — never make them transparent
            if (!isNaN(zIndex) && zIndex > 0) {
                el.classList.add('tint-ui-exclude');
                return;
            }
            
            // Don't make fixed/sticky elements transparent — they need visible backgrounds
            if (style.position === 'fixed' || style.position === 'sticky') {
                el.classList.add('tint-ui-exclude');
                return;
            }
            
            // LOGO PROTECTION: Never make logo containers transparent
            // Logos often use background-image which gets stripped by tint-transparent
            const elClass = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
            const elId = (el.id || '').toLowerCase();
            if (elClass.includes('logo') || elClass.includes('brand') ||
                elId.includes('logo') || elId.includes('brand') ||
                el.classList.contains('tint-logo-preserved') ||
                el.classList.contains('branding-box') ||
                el.classList.contains('mw-wiki-logo') ||
                el.classList.contains('mw-logo') ||
                el.classList.contains('nav-sprite') ||
                elId === 'nav-logo' || elId === 'nav-logo-sprites') {
                return; // Skip — this is a logo container
            }
            
            // ICON SPRITE PROTECTION: Don't strip background-image from elements that use
            // url() backgrounds (CSS sprites) — these are likely icon visuals, not layout decoration
            const bgImage = style.backgroundImage;
            const hasSpriteBackground = bgImage && bgImage !== 'none' && bgImage.includes('url(');
            
            // MASK-IMAGE PROTECTION: Don't strip background-color from elements using mask-image
            // (background-color IS the icon color for mask-image based icons)
            const maskImage = style.webkitMaskImage || style.maskImage;
            const hasMaskImage = maskImage && maskImage !== 'none';
            
            if (hasSpriteBackground || hasMaskImage) {
                // This element uses a visual technique that requires its background — skip it
                el.classList.add('tint-icon-preserved');
                return;
            }
            
            if (isBrightBackground(el)) {
                el.classList.add('tint-transparent');
                el.style.setProperty('background-color', 'transparent', 'important');
                // Only strip background-image if it's a gradient (layout decoration)
                // url() background-images might be CSS sprites and should be preserved
                if (bgImage && bgImage !== 'none' && !bgImage.includes('url(')) {
                    el.style.setProperty('background-image', 'none', 'important');
                } else if (!bgImage || bgImage === 'none') {
                    el.style.setProperty('background-image', 'none', 'important');
                }
                // If bgImage contains url(), don't strip it (preserve CSS sprites)
            }
        } catch (e) {
            // Ignore errors from getComputedStyle
        }
    });
}

/**
 * Apply CSS filters to logos for dark themes.
 * On dark themed pages, logos with dark colors (black, navy, etc.) become invisible
 * against the dark background. This function detects logo images and inverts them
 * so they remain visible.
 * 
 * We use a broad set of selectors to catch logos across many sites:
 *  - Direct attribute matches: img[src*="logo"], img[alt*="logo"], etc.
 *  - Container-based: elements inside .logo, [class*="logo"], [id*="logo"] containers
 *  - Positional: first significant image inside <header>, <nav>, [role="banner"]
 *  - Link-based: images inside a[href="/"] (home links are almost always logos)
 *  - Site-specific: .branding-box img (Wikipedia), #nav-logo img (Amazon), etc.
 */
function applyIconFilters(theme) {
    const textColor = theme.text || '#000000';
    const textLuminance = getLuminance(textColor);
    // Only needed for dark themes (light text on dark background)
    if (textLuminance <= 0.5) return;
    
    // Broad logo selector covering common patterns across sites
    const logoSelector = [
        // Direct attribute matches
        'img[src*="logo"]', 'img[alt*="logo"]', 'img[alt*="Logo"]',
        'img[class*="logo"]', 'img[class*="Logo"]',
        'img[id*="logo"]', 'img[id*="Logo"]',
        'svg[class*="logo"]', 'svg[class*="Logo"]',
        'svg[id*="logo"]', 'svg[id*="Logo"]',
        // Container-based (images/SVGs inside logo-named containers)
        '[class*="logo"] img', '[class*="Logo"] img',
        '[id*="logo"] img', '[id*="Logo"] img',
        '[class*="logo"] svg', '[class*="Logo"] svg',
        '[id*="logo"] svg', '[id*="Logo"] svg',
        '[class*="brand"] img', '[class*="Brand"] img',
        '[id*="brand"] img', '[id*="Brand"] img',
        '.logo img', '.logo svg',
        // Home link images (almost always logos)
        'a[href="/"] > img', 'a[href="/"] > svg',
        // Semantic banner region
        '[role="banner"] img',
        // Site-specific: Wikipedia
        '.branding-box img', '.branding-box svg',
        '.mw-logo img', '.mw-logo svg',
        '.mw-logo-container img', '.mw-logo-container svg',
        '.mw-wiki-logo',
        // Site-specific: Amazon
        '#nav-logo img', '#nav-logo svg',
        '.nav-logo-link img',
        '#nav-logo-sprites img',
    ].join(', ');
    
    document.querySelectorAll(logoSelector).forEach(el => {
        if (el.classList.contains('tint-filter-applied')) return;
        // Skip tiny tracking pixels (1×1)
        if (el.tagName === 'IMG') {
            const w = el.getAttribute('width');
            const h = el.getAttribute('height');
            if ((w === '1' || w === '0') && (h === '1' || h === '0')) return;
        }
        el.style.setProperty('filter', 'brightness(0) invert(1)', 'important');
        el.classList.add('tint-filter-applied');
        el.classList.add('tint-logo-preserved');
    });
    
    // Also handle header/nav first-images that might be logos
    // Only apply if no logo was found above (avoid double-processing)
    document.querySelectorAll('header, nav, [role="banner"]').forEach(container => {
        const firstImg = container.querySelector('img:not(.tint-filter-applied):not([width="1"]):not([height="1"])');
        if (firstImg) {
            const rect = firstImg.getBoundingClientRect();
            // Only process reasonably-sized images (logos are typically 20-300px wide)
            if (rect.width > 15 && rect.width < 350 && rect.height > 10 && rect.height < 120) {
                firstImg.style.setProperty('filter', 'brightness(0) invert(1)', 'important');
                firstImg.classList.add('tint-filter-applied');
                firstImg.classList.add('tint-logo-preserved');
            }
        }
    });
    
    // Handle logos rendered as BACKGROUND-IMAGE on container elements
    // Many sites (Wikipedia, Amazon) use background-image for their logo instead of <img>
    // These logos become invisible when our theme strips background-image
    const bgLogoSelector = [
        '.branding-box', '.mw-wiki-logo', '.mw-logo', '.mw-logo-container',
        '#nav-logo', '#nav-logo-sprites', '.nav-logo-link', '.nav-sprite',
        '[class*="logo"]', '[id*="logo"]', '[class*="Logo"]', '[id*="Logo"]',
        '[class*="brand-logo"]', '[id*="brand-logo"]',
    ].join(', ');
    
    document.querySelectorAll(bgLogoSelector).forEach(el => {
        // Skip if filter already applied (fully processed)
        if (el.classList.contains('tint-filter-applied')) return;
        try {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            // Only mark elements that actually have a url() background-image (the logo)
            if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
                el.classList.add('tint-logo-preserved');
                // Re-assert the background-image inline to override any CSS stripping
                el.style.setProperty('background-image', bgImage, 'important');
                // On dark themes, invert the logo for visibility
                el.style.setProperty('filter', 'brightness(0) invert(1)', 'important');
                el.classList.add('tint-filter-applied');
            } else if (el.classList.contains('tint-logo-preserved')) {
                // Element was pre-preserved by preserveLogoBackgrounds() — inline bg-image
                // is already set, but we still need to apply the invert filter for dark themes.
                // The inline style has the correct background-image; just add the filter.
                const inlineBg = el.style.getPropertyValue('background-image');
                if (inlineBg && inlineBg !== 'none' && inlineBg.includes('url(')) {
                    el.style.setProperty('filter', 'brightness(0) invert(1)', 'important');
                    el.classList.add('tint-filter-applied');
                }
            }
        } catch (e) {
            // Ignore errors
        }
    });
}

/**
 * Detect and protect icon elements that use CSS sprites or mask-image.
 * CSS sprite icons use background-image: url(...) to display icon visuals.
 * Mask-image icons use -webkit-mask-image with background-color as the icon color.
 * Both techniques break when our theme strips background-image or background-color.
 * This function marks these elements with 'tint-icon-preserved' to exempt them from theme stripping.
 * @param {Object} theme - The current theme object
 */
function preserveIconElements(theme) {
    const textColor = theme.text || '#000000';
    
    // 1. Scan icon-class elements that use CSS sprite background-images
    // These elements use background-image: url(...) for their icon visuals
    document.querySelectorAll(
        '[class*="icon"]:not(.tint-icon-preserved):not(.tint-image-container), ' +
        '[class*="Icon"]:not(.tint-icon-preserved):not(.tint-image-container), ' +
        '[id*="icon"]:not(.tint-icon-preserved):not(.tint-image-container), ' +
        '[id*="Icon"]:not(.tint-icon-preserved):not(.tint-image-container), ' +
        '.mw-ui-icon:not(.tint-icon-preserved), .vector-icon:not(.tint-icon-preserved), ' +
        '.cdx-icon:not(.tint-icon-preserved), .cdx-button__icon:not(.tint-icon-preserved)'
    ).forEach(el => {
        try {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            
            // If element has a url() background-image, it's a CSS sprite icon — preserve it
            if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
                el.classList.add('tint-icon-preserved');
                // Re-assert the original background-image via inline style
                el.style.setProperty('background-image', bgImage, 'important');
            }
        } catch (e) {
            // Ignore errors
        }
    });
    
    // 2. Scan for mask-image icons — small elements with mask-image/webkit-mask-image
    // Only check likely icon containers (buttons, links, spans, small divs)
    document.querySelectorAll(
        'button:not(.tint-icon-preserved), a:not(.tint-icon-preserved), ' +
        'span:not(.tint-icon-preserved), i:not(.tint-icon-preserved), ' +
        '[class*="icon"]:not(.tint-icon-preserved), [class*="Icon"]:not(.tint-icon-preserved)'
    ).forEach(el => {
        try {
            const style = window.getComputedStyle(el);
            const maskImage = style.webkitMaskImage || style.maskImage;
            
            if (maskImage && maskImage !== 'none') {
                // This element uses mask-image for its icon
                // The background-color IS the icon color — set it to theme text color
                el.style.setProperty('background-color', textColor, 'important');
                el.classList.add('tint-icon-preserved');
            }
        } catch (e) {
            // Ignore errors
        }
    });
    
    // 3. Scan all elements for inline style mask-image (catches dynamically set styles)
    document.querySelectorAll('[style*="mask-image"], [style*="-webkit-mask-image"]').forEach(el => {
        if (!el.classList.contains('tint-icon-preserved')) {
            el.style.setProperty('background-color', textColor, 'important');
            el.classList.add('tint-icon-preserved');
        }
    });
}

/**
 * Fix SVG icons that are invisible on dark themes.
 * Many SVGs have hardcoded dark fill values (e.g., fill="#333", fill="black") which
 * become invisible on dark theme backgrounds. This function detects small SVGs
 * (likely icons) and forces their fill to currentColor so they inherit the theme text color.
 * @param {Object} theme - The current theme object
 */
function fixDarkThemeSVGs(theme) {
    const textColor = theme.text || '#000000';
    const textLuminance = getLuminance(textColor);
    
    // Only needed for dark themes (where text is light, luminance > 0.5)
    // On light themes, dark SVG fills are already visible
    if (textLuminance <= 0.5) return;
    
    document.querySelectorAll('svg').forEach(svg => {
        try {
            const rect = svg.getBoundingClientRect();
            // Only process small SVGs (icon-sized: up to 64×64px)
            // Large SVGs are charts, illustrations, logos — don't touch them
            if (rect.width <= 0 || rect.height <= 0 || rect.width > 64 || rect.height > 64) return;
            
            // Skip SVGs with logo-related classes (logos should keep original colors)
            const svgClass = (svg.getAttribute('class') || '').toLowerCase();
            if (svgClass.includes('logo') || svgClass.includes('brand')) return;
            
            // Force fill:currentColor on all shape children with hardcoded dark fills
            svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, use').forEach(child => {
                const fill = child.getAttribute('fill');
                // Skip if already using currentColor or no fill set (inherits from parent)
                if (!fill || fill === 'none' || fill === 'currentColor' || fill === 'inherit') return;
                
                // Check if the fill is dark (would be invisible on dark background)
                // Dark fills: #000, #333, #666, black, rgb(0,0,0), etc.
                const darkFillPatterns = /^(#[0-7][0-9a-f]{0,5}|black|rgb\s*\(\s*[0-9]{1,2}\s*,|rgba\s*\(\s*0)/i;
                if (darkFillPatterns.test(fill.trim())) {
                    child.style.setProperty('fill', 'currentColor', 'important');
                }
            });
        } catch (e) {
            // Ignore errors
        }
    });
}

/**
 * Helper function to generate background CSS for any element
 */
function getBackgroundCSS(theme) {
    if (theme.backgroundType === 'image' && theme.backgroundImage) {
        return `background-image: url('${theme.backgroundImage}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;`;
    } else if (theme.backgroundType === 'gradient' && theme.backgroundGradient) {
        // Special handling for the Monochrome diagonal split theme
        // Diagonal split: black (top-right/left) to white (bottom-left/right)
        // Creates a diagonal line that shifts as you scroll
        // Use fixed attachment so gradient stays in place relative to viewport, creating the "adjusting" effect
        // Large background-size ensures smooth transition across the entire scrollable area
        if (isMonochromeDiagonalGradient(theme.backgroundGradient)) {
            return `background: ${theme.backgroundGradient} !important; background-size: ${MONOCHROME_GRADIENT_SIZE} !important; background-position: ${MONOCHROME_GRADIENT_POSITION} !important; background-attachment: fixed !important; background-repeat: no-repeat !important;`;
        }
        // Default gradient handling: slightly enlarged, centered for consistent coverage.
        return `background: ${theme.backgroundGradient} !important; background-size: ${DEFAULT_GRADIENT_SIZE} !important; background-position: center !important; background-attachment: fixed !important; background-repeat: no-repeat !important;`;
    } else {
        return `background-color: ${theme.background || '#FFFFFF'} !important;`;
    }
}

/**
 * Generates base CSS - minimal, safe rules for all sites
 */
function generateBaseCSS(theme) {
    let backgroundCSS;
    
    if (theme.backgroundType === 'image' && theme.backgroundImage) {
        backgroundCSS = `background-image: url('${theme.backgroundImage}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; background-attachment: fixed !important;`;
    } else if (theme.backgroundType === 'gradient' && theme.backgroundGradient) {
        // Support for gradient backgrounds (split, diagonal, etc.)
        debugLog("Tint: Using gradient background:", theme.backgroundGradient);
            // Match getBackgroundCSS behavior for Monochrome: diagonal split that adjusts as you scroll
            // Fixed attachment keeps gradient in place relative to viewport, creating scroll effect
        if (isMonochromeDiagonalGradient(theme.backgroundGradient)) {
            backgroundCSS = `background: ${theme.backgroundGradient} !important; background-attachment: fixed !important; background-size: ${MONOCHROME_GRADIENT_SIZE} !important; background-position: ${MONOCHROME_GRADIENT_POSITION} !important; background-repeat: no-repeat !important;`;
        } else {
            // Default gradient behavior.
            backgroundCSS = `background: ${theme.backgroundGradient} !important; background-attachment: fixed !important; background-size: ${DEFAULT_GRADIENT_SIZE} !important; background-position: center !important; background-repeat: no-repeat !important;`;
        }
    } else {
        // Default to solid color
        backgroundCSS = `background-color: ${theme.background || '#FFFFFF'} !important;`;
    }

    const textColor = theme.text || '#000000';
    const linkColor = theme.link || '#0000EE';
    const isMonochrome = theme.backgroundType === 'gradient' && isMonochromeDiagonalGradient(theme.backgroundGradient);
    
    // Extract RGB values from background color for rgba() usage in UI elements
    const bgColor = theme.background || '#FFFFFF';
    let bgRgb = '255, 255, 255'; // Default white
    if (bgColor.startsWith('#')) {
        const hex = bgColor.slice(1);
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            bgRgb = `${r}, ${g}, ${b}`;
        } else if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            bgRgb = `${r}, ${g}, ${b}`;
        }
    } else if (bgColor.startsWith('rgb')) {
        const match = bgColor.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            bgRgb = `${match[1]}, ${match[2]}, ${match[3]}`;
        }
    }

    return `
        /* BASE THEME - Universal Theme Engine with CSS Variables */
        /* 1. Inject CSS Variables into :root for universal compatibility */
        :root {
            --tint-bg: ${theme.background || '#FFFFFF'};
            --tint-bg-rgb: ${bgRgb};
            --tint-text: ${textColor};
            --tint-link: ${linkColor};
            ${backgroundCSS}
            background-attachment: fixed !important;
        }
        
        /* 2. Apply theme to the root layers - ensure full scrollable coverage */
        /* CRITICAL: For gradients, don't set background-color as it overrides the gradient */
        html {
            ${backgroundCSS}
            ${theme.backgroundType !== 'gradient' && theme.backgroundType !== 'image' ? `background-color: ${theme.background || '#FFFFFF'} !important;` : ''}
            min-height: 100vh !important;
            height: auto !important;
            /* No padding here — html background extends into the safe area behind the status bar */
        }
        body {
            ${backgroundCSS}
            ${theme.backgroundType !== 'gradient' && theme.backgroundType !== 'image' ? `background-color: ${theme.background || '#FFFFFF'} !important;` : ''}
            min-height: 100vh !important;
            height: auto !important;
            /* Only body gets safe-area padding to push content below the status bar */
            /* html has no padding so its background fills the entire viewport including safe area */
            padding-top: env(safe-area-inset-top) !important;
        }
        /* Ensure background covers entire scrollable area, not just viewport */
        html, body {
            background-clip: border-box !important;
            background-origin: border-box !important;
            /* For gradients, don't override the size - let backgroundCSS handle it */
            /* For solid colors, use 100% 100% to ensure full coverage */
            ${theme.backgroundType !== 'gradient' ? 'background-size: 100% 100% !important;' : ''}
        }
        
        /* UNIVERSAL SAFETY NET: Fixed pseudo-element behind everything to prevent any white gaps */
        /* This covers overscroll areas, safe area behind status bar, and any gaps in element stacking */
        html::before {
            content: '' !important;
            position: fixed !important;
            top: -200px !important;
            left: 0 !important;
            right: 0 !important;
            bottom: -200px !important;
            ${theme.backgroundType === 'gradient' && theme.backgroundGradient ? 
                (isMonochromeDiagonalGradient(theme.backgroundGradient) ?
                    `background: ${theme.backgroundGradient} !important; background-attachment: fixed !important; background-size: ${MONOCHROME_GRADIENT_SIZE} !important; background-position: ${MONOCHROME_GRADIENT_POSITION} !important; background-repeat: no-repeat !important;` :
                    `background: ${theme.backgroundGradient} !important; background-attachment: fixed !important; background-size: ${DEFAULT_GRADIENT_SIZE} !important; background-position: center !important; background-repeat: no-repeat !important;`) :
                (theme.backgroundType === 'image' && theme.backgroundImage ?
                    `background-image: url('${theme.backgroundImage}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; background-attachment: fixed !important;` :
                    `background-color: ${theme.background || '#FFFFFF'} !important;`)}
            z-index: -9999 !important;
            pointer-events: none !important;
        }

        /* 2. Target high-level wrappers that cover the whole page */
        body > div:first-child, 
        #overlap-manager-root, 
        #root, 
        #__next,
        body > main:first-child,
        body > section:first-child {
            background-color: transparent !important;
            background-image: none !important;
        }

        /* 3. Make intermediate containers transparent so the background shows through */
        /* SURGICAL APPROACH: Only target layout wrappers, not UI elements */
        /* Extensive exclusion list to prevent making interactive elements invisible */
        /* IMPORTANT: Only exclude INTERACTIVE roles (dialog, tooltip, menu, listbox, combobox) */
        /* Structural roles (banner, navigation, search, main, etc.) MUST be transparent */
        /* CRITICAL: Exclude icon containers — they use background-image sprites that MUST be preserved */
        /* CRITICAL: Exclude logo containers — they use background-image for site logos */
        div:not(.tint-ui-exclude):not(.tint-image-container):not(.tint-icon-preserved):not(.tint-logo-preserved):not([role="dialog"]):not([role="alertdialog"]):not([role="tooltip"]):not([role="menu"]):not([role="listbox"]):not([role="combobox"]):not([aria-modal]):not([class*="modal"]):not([class*="dialog"]):not([class*="popup"]):not([class*="dropdown"]):not([class*="menu"]):not([class*="tooltip"]):not([class*="popover"]):not([class*="toast"]):not([class*="snackbar"]):not([class*="cookie"]):not([class*="consent"]):not([class*="toolbar"]):not([class*="tabbar"]):not([class*="tab-bar"]):not([class*="card"]:not([class*="container"])):not([class*="btn"]):not([class*="button"]:not([class*="container"])):not([id*="modal"]):not([id*="dialog"]):not([id*="popup"]):not([id*="dropdown"]):not([id*="menu"]):not([id*="cookie"]):not([id*="consent"]):not([class*="icon"]):not([class*="Icon"]):not([id*="icon"]):not([id*="Icon"]):not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([id*="brand"]),
        div#content:not(.tint-ui-exclude):not(.tint-image-container),
        div#main:not(.tint-ui-exclude):not(.tint-image-container),
        main:not(.tint-ui-exclude):not(.tint-image-container),
        section:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([role="tooltip"]):not([aria-modal]),
        article:not(.tint-ui-exclude):not(.tint-image-container),
        .wrapper:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]),
        .container:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]),
        div[class*="content"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]):not([class*="modal"]):not([class*="dialog"]):not([class*="popup"]),
        div[class*="main"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]):not([class*="modal"]):not([class*="dialog"]),
        div[class*="wrapper"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]):not([class*="modal"]),
        div[class*="container"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]):not([class*="modal"]),
        /* CRITICAL: Structural role elements MUST be transparent — these are page layout elements */
        [role="banner"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="search"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="main"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="contentinfo"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="complementary"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="region"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="modal"]):not([class*="dialog"]),
        [role="form"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="group"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="modal"]):not([class*="dialog"]),
        /* Target header and nav elements directly (catch site headers with white backgrounds) */
        header:not(.tint-ui-exclude):not(.tint-image-container),
        nav:not(.tint-ui-exclude):not(.tint-image-container),
        footer:not(.tint-ui-exclude):not(.tint-image-container),
        aside:not(.tint-ui-exclude):not(.tint-image-container),
        form:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]) {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Note: High z-index elements are detected and marked by JavaScript */

        /* 4. Nuke white AND near-white backgrounds - Fix Wikipedia "highlight" issue */
        /* Target pure white - be specific to avoid over-matching */
        [style*="background-color: #fff"],
        [style*="background-color: #ffffff"],
        [style*="background-color: white"],
        [style*="background-color: rgb(255, 255, 255)"],
        [style*="background-color: rgba(255, 255, 255"],
        /* Target near-white colors (f8f9fa, fafafa, f5f5f5, etc.) - be more specific with full hex codes */
        [style*="background-color: #f8f8"],
        [style*="background-color: #f9f9"],
        [style*="background-color: #fafa"],
        [style*="background-color: #fbfb"],
        [style*="background-color: #fcfc"],
        [style*="background-color: #fdfd"],
        [style*="background-color: #fefe"],
        [style*="background-color: rgb(248, 248"],
        [style*="background-color: rgb(249, 249"],
        [style*="background-color: rgb(250, 250"],
        [style*="background-color: rgb(251, 251"],
        [style*="background-color: rgb(252, 252"],
        [style*="background-color: rgb(253, 253"],
        [style*="background-color: rgb(254, 254"],
        /* Target specific white background classes - be more selective */
        div[class*="bg-white"]:not(.tint-ui-exclude):not(.tint-image-container),
        div[class*="background-white"]:not(.tint-ui-exclude):not(.tint-image-container),
        div[id*="bg-white"]:not(.tint-ui-exclude):not(.tint-image-container) {
            background-color: transparent !important;
        }
        /* REMOVED: The overly broad [style*="background-color"] rule that was causing the highlight overlay */

        /* 5. Global Text Control - Apply to text elements, but exclude image containers and icons */
        /* Exclude elements that are likely part of an image overlay where original color matters */
        *:not(.tint-image-container):not(.tint-image-container *) {
            color: ${textColor} !important;
            text-shadow: none !important; /* Prevents blurry text on dark themes */
        }
        /* Border theming — apply SELECTIVELY to form elements and tables only */
        /* REMOVED from * rule: was causing visible boxes around icons, colored borders on banners, */
        /* and boxed outlines on toolbar wrappers that don't have "icon" in their class */
        input:not(.tint-image-container),
        textarea:not(.tint-image-container),
        select:not(.tint-image-container),
        table:not(.tint-image-container),
        td:not(.tint-image-container),
        th:not(.tint-image-container),
        hr:not(.tint-image-container),
        fieldset:not(.tint-image-container) {
            border-color: ${textColor}33 !important;
        }
        /* CRITICAL: Preserve icon colors — let SVGs inherit theme color through currentColor */
        /* IMPORTANT: Do NOT set fill:currentColor on "svg *" — that overrides explicit fills */
        /* on child elements (rects, circles, paths) causing colored boxes over icons */
        svg:not(.tint-image-container):not([class*="logo"]):not([class*="Logo"]),
        [class*="icon"]:not(.tint-image-container), 
        [id*="icon"]:not(.tint-image-container),
        [class*="Icon"]:not(.tint-image-container), 
        [id*="Icon"]:not(.tint-image-container),
        i[class*="fa-"], 
        [class*="material-icons"], 
        [class*="glyphicon"],
        .icon, .Icon, 
        [role="img"] svg,
        /* Wikipedia specific icon classes */
        .mw-ui-icon,
        .vector-icon,
        .cdx-icon,
        [class*="mw-ui-icon"],
        [class*="vector-icon"],
        [class*="cdx-icon"] {
            color: inherit !important;
            -webkit-text-fill-color: inherit !important;
            /* CRITICAL: Icon containers must be transparent — prevent themed bg from hiding icon sprites */
            background-color: transparent !important;
        }
        /* Only set fill:currentColor on explicitly-named icon elements, NOT on all SVG children */
        /* This prevents colored boxes over icons caused by overriding background/decorative fills */
        [class*="icon"]:not(.tint-image-container):not(div):not(span):not(a),
        [id*="icon"]:not(.tint-image-container):not(div):not(span):not(a),
        [class*="Icon"]:not(.tint-image-container):not(div):not(span):not(a),
        [id*="Icon"]:not(.tint-image-container):not(div):not(span):not(a),
        i[class*="fa-"],
        [class*="material-icons"],
        [class*="glyphicon"],
        .mw-ui-icon svg,
        .vector-icon svg {
            fill: currentColor !important;
        }
        /* 5b-ii. Also apply fill:currentColor to SVG CHILDREN inside icon containers */
        /* Icon SVGs often have <path fill="#333"> which is invisible on dark themes */
        /* This is SAFE for icon containers (monochrome icons) unlike the old broad "svg *" rule */
        .mw-ui-icon svg *,
        .vector-icon svg *,
        .cdx-icon svg *,
        .cdx-button__icon svg *,
        [class*="mw-ui-icon"] svg *,
        [class*="cdx-icon"] svg *,
        [class*="vector-icon"] svg *,
        button[class*="icon"]:not(.tint-image-container) svg *,
        a[class*="icon"]:not(.tint-image-container) svg *,
        span[class*="icon"]:not(.tint-image-container) svg * {
            fill: currentColor !important;
        }
        /* 5b-iii. SVGs directly inside buttons, links, labels are ALMOST ALWAYS icons */
        /* These should always use currentColor for fill — covers sites that don't use icon classes */
        button:not(.tint-image-container) > svg,
        button:not(.tint-image-container) > svg *,
        a:not(.tint-image-container) > svg:not([class*="logo"]):not([class*="Logo"]),
        a:not(.tint-image-container) > svg:not([class*="logo"]):not([class*="Logo"]) *,
        label:not(.tint-image-container) > svg,
        label:not(.tint-image-container) > svg *,
        /* Small SVGs (24px or less) inside any element are virtually always icons */
        svg[width="16"], svg[width="20"], svg[width="24"],
        svg[height="16"], svg[height="20"], svg[height="24"],
        svg[width="16"] *, svg[width="20"] *, svg[width="24"] *,
        svg[height="16"] *, svg[height="20"] *, svg[height="24"] * {
            fill: currentColor !important;
        }
        /* 5c. Preserve CSS sprite icons globally — prevent empty boxes with visible borders */
        /* Many sites use background-image for icon visuals which MUST be preserved */
        /* Reset border-color to transparent so icon containers don't show as visible boxes */
        /* Specificity uses :not(.tint-image-container) to match/beat the * rule above (0,0,2,0) */
        [class*="icon"]:not(.tint-image-container),
        [class*="Icon"]:not(.tint-image-container),
        [id*="icon"]:not(.tint-image-container),
        [id*="Icon"]:not(.tint-image-container),
        .mw-ui-icon:not(.tint-image-container),
        [class*="mw-ui-icon"]:not(.tint-image-container),
        .vector-icon:not(.tint-image-container),
        [class*="vector-icon"]:not(.tint-image-container),
        .cdx-icon:not(.tint-image-container),
        [class*="cdx-icon"]:not(.tint-image-container),
        .cdx-button__icon:not(.tint-image-container),
        i[class*="fa-"]:not(.tint-image-container),
        [class*="material-icons"]:not(.tint-image-container),
        [class*="glyphicon"]:not(.tint-image-container) {
            border-color: transparent !important;
        }
        /* 5d. Mask-image icons — modern technique where background-color IS the icon color */
        /* These use -webkit-mask-image with a colored background to render the icon shape */
        /* If we strip background-color, the icon becomes invisible */
        [style*="mask-image"]:not(.tint-image-container),
        [style*="-webkit-mask-image"]:not(.tint-image-container) {
            background-color: ${textColor} !important;
        }
        /* 5e. JavaScript-protected icon elements — preserved by preserveIconElements() */
        /* These elements were detected as having CSS sprite backgrounds or mask-images */
        .tint-icon-preserved {
            background-image: var(--tint-original-bg-image) !important;
            background-color: transparent !important;
            border-color: transparent !important;
        }
        /* Specifically revert color for text inside image containers */
        .tint-image-container *, 
        [style*="background-image"] *,
        picture *, 
        figure *,
        figcaption {
            color: inherit !important;
        }
        /* Also explicitly target all text elements for maximum coverage */
        html p:not(.tint-image-container *), body p:not(.tint-image-container *),
        html span:not(.tint-image-container *), body span:not(.tint-image-container *),
        html div:not(.tint-image-container *), body div:not(.tint-image-container *),
        html h1:not(.tint-image-container *), body h1:not(.tint-image-container *),
        html h2:not(.tint-image-container *), body h2:not(.tint-image-container *),
        html h3:not(.tint-image-container *), body h3:not(.tint-image-container *),
        html h4:not(.tint-image-container *), body h4:not(.tint-image-container *),
        html h5:not(.tint-image-container *), body h5:not(.tint-image-container *),
        html h6:not(.tint-image-container *), body h6:not(.tint-image-container *),
        html li:not(.tint-image-container *), body li:not(.tint-image-container *),
        html ul:not(.tint-image-container *), body ul:not(.tint-image-container *),
        html ol:not(.tint-image-container *), body ol:not(.tint-image-container *),
        html table:not(.tint-image-container *), body table:not(.tint-image-container *),
        html tr:not(.tint-image-container *), body tr:not(.tint-image-container *),
        html td:not(.tint-image-container *), body td:not(.tint-image-container *),
        html th:not(.tint-image-container *), body th:not(.tint-image-container *),
        html label:not(.tint-image-container *), body label:not(.tint-image-container *),
        html button:not(.tint-image-container *), body button:not(.tint-image-container *) {
            color: ${textColor} !important;
        }

        

        /* 6. Ensure inputs are readable but themed */
        input:not(.tint-ui-exclude), textarea:not(.tint-ui-exclude), select:not(.tint-ui-exclude) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.15) !important;
            color: var(--tint-text, ${textColor}) !important;
            -webkit-text-fill-color: var(--tint-text, ${textColor}) !important;
            border-color: ${textColor}33 !important;
        }
        /* Select dropdowns need visible backgrounds */
        select:not(.tint-ui-exclude) option {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.95) !important;
            color: var(--tint-text, ${textColor}) !important;
        }
        
        /* 6a. Buttons and interactive controls - preserve visibility */
        /* IMPORTANT: Exclude icon buttons — they should show just the icon, not a boxed button */
        button:not(.tint-ui-exclude):not(.tint-image-container):not([class*="icon"]):not([class*="Icon"]):not(.mw-ui-icon),
        [role="button"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="icon"]):not([class*="Icon"]),
        input[type="button"]:not(.tint-ui-exclude),
        input[type="submit"]:not(.tint-ui-exclude),
        input[type="reset"]:not(.tint-ui-exclude),
        [class*="btn"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="icon"]),
        [class*="button"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="container"]):not([class*="wrapper"]):not([class*="icon"]) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.15) !important;
            color: var(--tint-text, ${textColor}) !important;
            border-color: ${textColor}33 !important;
        }
        
        /* 6b. Cards, chips, tags, badges - give them subtle backgrounds */
        [class*="card"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="container"]):not([class*="wrapper"]):not([class*="grid"]):not([class*="list"]),
        [class*="chip"]:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="tag"]:not(.tint-ui-exclude):not(.tint-image-container):not(html):not(body):not(head):not([class*="container"]),
        [class*="badge"]:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="pill"]:not(.tint-ui-exclude):not(.tint-image-container) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.1) !important;
            border-color: ${textColor}22 !important;
        }
        
        /* 6c. Dropdown menus, popups, tooltips - MUST be visible and opaque */
        /* These are "floating" UI layers that should never be transparent */
        [class*="dropdown"]:not(.tint-image-container),
        [class*="popover"]:not(.tint-image-container),
        [class*="tooltip"]:not(.tint-image-container),
        [class*="popup"]:not(.tint-image-container):not([class*="container"]),
        [class*="menu"]:not(.tint-image-container):not([class*="container"]):not(nav):not(header),
        [role="menu"]:not(.tint-image-container),
        [role="listbox"]:not(.tint-image-container),
        [role="tooltip"]:not(.tint-image-container),
        [role="combobox"]:not(.tint-image-container),
        [role="dialog"]:not(.tint-image-container),
        [aria-modal="true"]:not(.tint-image-container),
        [data-popper-placement],
        [data-state="open"]:not(.tint-image-container):not(input):not(select),
        [class*="autocomplete"]:not(.tint-image-container),
        [class*="typeahead"]:not(.tint-image-container),
        [class*="suggestion"]:not(.tint-image-container):not([class*="container"]),
        /* Wikipedia-specific dropdown menus */
        .vector-menu-dropdown,
        .vector-menu-content-list,
        .vector-appearance-menu,
        .mwe-popups,
        .ui-suggestions,
        /* Common SPA patterns — Tippy.js, Headless UI, Radix, etc. */
        [data-tippy-root],
        [data-radix-popper-content-wrapper],
        [data-headlessui-state] {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.98) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            box-shadow: 0 4px 24px rgba(0,0,0,0.15) !important;
        }
        /* Dropdown items need visible backgrounds on hover */
        [class*="dropdown"] li,
        [class*="dropdown"] a,
        [role="menu"] [role="menuitem"],
        [role="listbox"] [role="option"] {
            color: var(--tint-text, ${textColor}) !important;
        }
        
        /* 6d. Toast notifications, snackbars, cookie banners */
        [class*="toast"]:not(.tint-image-container),
        [class*="snackbar"]:not(.tint-image-container),
        [class*="notification"]:not(.tint-image-container):not([class*="container"]):not([class*="list"]),
        [class*="cookie"]:not(.tint-image-container),
        [class*="consent"]:not(.tint-image-container),
        [class*="gdpr"]:not(.tint-image-container),
        [class*="banner"]:not(.tint-image-container):not([class*="container"]),
        [id*="cookie"]:not(.tint-image-container),
        [id*="consent"]:not(.tint-image-container),
        [id*="gdpr"]:not(.tint-image-container),
        [role="alert"]:not(.tint-image-container),
        [role="alertdialog"]:not(.tint-image-container),
        [role="status"]:not(.tint-image-container) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.95) !important;
            backdrop-filter: blur(15px) !important;
            -webkit-backdrop-filter: blur(15px) !important;
        }
        
        /* 6e. Tab bars, toolbars, bottom navigation */
        [class*="toolbar"]:not(.tint-image-container):not([class*="container"]),
        [class*="tabbar"]:not(.tint-image-container),
        [class*="tab-bar"]:not(.tint-image-container),
        [class*="bottom-nav"]:not(.tint-image-container),
        [class*="bottomNav"]:not(.tint-image-container),
        [role="tablist"]:not(.tint-image-container),
        [role="toolbar"]:not(.tint-image-container),
        [class*="action-bar"]:not(.tint-image-container),
        [class*="actionbar"]:not(.tint-image-container) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.85) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
        }
        
        /* 6f. Code blocks - preserve readability on tech sites */
        pre:not(.tint-ui-exclude):not(.tint-image-container),
        code:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="highlight"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="container"]):not([class*="search"]),
        [class*="code-block"]:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="codeblock"]:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="CodeMirror"]:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="prism"]:not(.tint-ui-exclude):not(.tint-image-container),
        [class*="syntax"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="container"]) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.08) !important;
            border: 1px solid ${textColor}1A !important;
            border-radius: 6px !important;
        }
        /* Inline code blocks */
        :not(pre) > code:not(.tint-ui-exclude) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.08) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
        }

        /* 7. Link colors - apply to all links */
        a, a * {
            color: var(--tint-link, ${linkColor}) !important;
        }

        /* 8. FIX: UI Elements - Give them visible backgrounds while maintaining theme */
        /* CRITICAL: Target ALL fixed/sticky elements directly (not just marked ones) */
        /* This ensures sticky headers on Reddit/ESPN get visible backgrounds */
        /* Note: This only matches inline styles, but JavaScript marks computed styles */
        *[style*="position: fixed"],
        *[style*="position: sticky"] {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.9) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
        }
        /* CRITICAL: All UI-excluded elements (marked by JavaScript) get visible backgrounds */
        /* This catches sticky/fixed elements that are marked but don't have inline styles */
        .tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.9) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
        }
        /* Also target via computed styles - use a more specific approach */
        /* Fixed/sticky headers and navs should be semi-transparent, not fully transparent */
        header.tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude),
        nav.tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude),
        [class*="header"].tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude),
        [id*="header"].tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude),
        [class*="nav"].tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude),
        [id*="nav"].tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude) {
            /* Semi-transparent background based on theme - visible but allows theme to show through */
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.85) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
        }
        /* Dialogs, modals, and overlays - give them solid backgrounds so they're visible */
        /* Also target elements with role/dialog attributes directly (not just marked ones) */
        [role="dialog"]:not(.tint-image-container),
        [aria-modal="true"]:not(.tint-image-container),
        [class*="modal"]:not(.tint-image-container):not(.tint-image-container *),
        [id*="modal"]:not(.tint-image-container):not(.tint-image-container *),
        [class*="overlay"]:not(.tint-image-container):not(.tint-image-container *),
        [id*="overlay"]:not(.tint-image-container):not(.tint-image-container *),
        [class*="dialog"]:not(.tint-image-container):not(.tint-image-container *),
        [id*="dialog"]:not(.tint-image-container):not(.tint-image-container *),
        [role="dialog"].tint-ui-exclude,
        [aria-modal="true"].tint-ui-exclude,
        [class*="modal"].tint-ui-exclude,
        [id*="modal"].tint-ui-exclude,
        [class*="overlay"].tint-ui-exclude,
        [id*="overlay"].tint-ui-exclude,
        [class*="dialog"].tint-ui-exclude,
        [id*="dialog"].tint-ui-exclude {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.95) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
        }
        /* Other UI excludes (banners, etc.) - semi-transparent */
        .tint-ui-exclude:not(.tint-ui-exclude .tint-ui-exclude):not(header):not(nav):not([class*="header"]):not([id*="header"]):not([class*="nav"]):not([id*="nav"]):not([role="dialog"]):not([aria-modal="true"]):not([class*="modal"]):not([id*="modal"]):not([class*="overlay"]):not([id*="overlay"]) {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.9) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
        }
        /* Prevent nested UI excludes from stacking backgrounds */
        .tint-ui-exclude .tint-ui-exclude {
            background-color: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
        /* But ensure text in UI-excluded elements still gets theme color */
        .tint-ui-exclude * {
            color: var(--tint-text, ${textColor}) !important;
        }
        
        /* Elements marked by luminance checking get transparent background */
        .tint-transparent {
            background-color: transparent !important;
        }
        /* Strip background-image ONLY from non-logo transparent elements */
        /* Logo containers must keep their background-image (used for CSS sprite logos) */
        .tint-transparent:not(.tint-logo-preserved):not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([class*="Brand"]):not(.branding-box):not(.mw-logo):not(.mw-wiki-logo):not(.mw-logo-container):not(#nav-logo):not(#nav-logo-sprites):not(.nav-logo-link):not(.nav-sprite) {
            background-image: none !important;
        }
        
        /* Icon filter support for dark themes */
        .tint-filter-applied {
            /* Filter applied via JavaScript */
        }
        
        /* Images and media - must be visible and not themed, but preserve positioning */
        /* REFINED: Remove width/height auto to preserve CSS sprites (fixes Amazon) */
        /* SPLIT: SVGs handled separately below to preserve their filters and fills */
        /* LOGO EXEMPT: Logo images are excluded from filter:none so JS can apply invert */
        html img:not(.tint-logo-preserved):not(.tint-filter-applied),
        body img:not(.tint-logo-preserved):not(.tint-filter-applied),
        html picture, body picture, html video, body video,
        html canvas, body canvas,
        html iframe, body iframe, html object, body object, html embed, body embed,
        html [role="img"]:not(svg), body [role="img"]:not(svg) {
            background-color: transparent !important;
            background-image: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            max-width: 100% !important;
            filter: none !important; /* Prevent double-inversion */
        }
        /* Logo images — preserve JavaScript-applied filters (e.g., invert for dark themes) */
        /* These elements have been detected as logos by applyIconFilters() */
        img.tint-logo-preserved, svg.tint-logo-preserved,
        img.tint-filter-applied, svg.tint-filter-applied {
            opacity: 1 !important;
            visibility: visible !important;
            /* filter is intentionally NOT set here — JS controls it */
        }
        /* LOGO BACKGROUND-IMAGE SAFETY NET: Many sites render logos as background-image */
        /* on container elements (e.g., Wikipedia's .branding-box, .mw-wiki-logo). */
        /* Our theme strips background-image broadly — this rule preserves it for logos. */
        /* Uses high specificity (html body prefix) to override generic div transparency rules */
        /* LOGO CONTAINERS: Prevent ALL theme rules from stripping their background-image */
        /* "revert" is broken here (reverts to user-agent = none), so instead we use */
        /* "initial" as a fallback. The REAL preservation happens in preserveLogoBackgrounds() */
        /* which captures and inlines the original background-image BEFORE CSS is injected. */
        html body .tint-logo-preserved,
        html body [class*="logo"]:not(.tint-image-container),
        html body [id*="logo"]:not(.tint-image-container),
        html body [class*="Logo"]:not(.tint-image-container),
        html body [id*="Logo"]:not(.tint-image-container),
        html body .branding-box,
        html body .mw-wiki-logo,
        html body .mw-logo,
        html body .mw-logo-container,
        html body #nav-logo,
        html body #nav-logo-sprites,
        html body .nav-logo-link,
        html body .nav-sprite {
            /* Don't set background-image at all — let the original CSS or inline style stand */
            background-color: transparent !important;
        }
        /* SVGs — preserve visibility but DON'T strip filter or background-image */
        /* Some sites use filter for icon theming (e.g., filter: brightness(0)) */
        /* Stripping filter: none breaks these icons, especially on dark themes */
        html svg:not([class*="icon"]):not([id*="icon"]):not(.tint-image-container),
        body svg:not([class*="icon"]):not([id*="icon"]):not(.tint-image-container) {
            background-color: transparent !important;
            opacity: 1 !important;
            visibility: visible !important;
        }
        /* Image containers - exclude from background but allow text color */
        /* LOGO EXEMPT: Don't strip background from logo containers */
        html .tint-image-container:not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([class*="Brand"]):not(.tint-logo-preserved), 
        body .tint-image-container:not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([class*="Brand"]):not(.tint-logo-preserved),
        html .tint-image-container:not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([class*="Brand"]):not(.tint-logo-preserved) *:not(.tint-logo-preserved):not(.tint-filter-applied),
        body .tint-image-container:not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([class*="Brand"]):not(.tint-logo-preserved) *:not(.tint-logo-preserved):not(.tint-filter-applied) {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Figure elements - exclude from background */
        html figure, body figure, html figcaption, body figcaption {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Search containers - exclude from background but allow text color */
        html .tint-search-container, body .tint-search-container {
            background-color: transparent !important;
            background-image: none !important;
        }
    `;
}

/**
 * Generates Google-specific CSS
 */
function generateGoogleCSS(theme) {
    const textColor = theme.text || '#000000';
    return `
        /* GOOGLE-SPECIFIC OVERRIDES */
        /* Base CSS + the :not([role]) fix already makes structural elements transparent */
        /* This file only handles Google-specific elements that need extra attention */
        
        /* Target the persistent Google Header and Sign-in area (#gb) */
        #gb, .gb_T, .gb_Sa, header#hdr, #searchform,
        html body #gb,
        html body .gb_T,
        html body .gb_Sa,
        html body header#hdr {
            background-color: transparent !important;
            background-image: none !important;
        }
        
        /* Fix search bar depth — subtle themed tint, NOT white */
        .RNNXgb, .sbtc,
        html body .RNNXgb,
        html body .sbtc {
            background-color: rgba(var(--tint-bg-rgb), 0.1) !important;
        }
        
        /* Search bar containers — give them themed visible backgrounds (not white) */
        html body div[class*="RNNXgb"],
        html body div[class*="A8SBwf"],
        html body div[class*="SDkEP"],
        html body div[class*="RNmpXc"] {
            background-color: rgba(var(--tint-bg-rgb), 0.15) !important;
        }
        /* Search dropdown/autocomplete — themed visible background */
        html body div[class*="aajZCb"],
        html body div[class*="lJ9FBc"] {
            background-color: rgba(var(--tint-bg-rgb), 0.95) !important;
            backdrop-filter: blur(15px) !important;
            -webkit-backdrop-filter: blur(15px) !important;
        }
        html body div[class*="gLFyf"],
        html body div[class*="o3j99"],
        html body div[class*="L3eUgb"] {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Search container — allow background but keep it functional */
        html body .tint-search-container {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Make sure search bar area child divs are transparent so background shows */
        html body div[class*="RNNXgb"] > div,
        html body div[class*="A8SBwf"] > div,
        html body div[class*="RNNXgb"] div,
        html body div[class*="A8SBwf"] div,
        html body div[class*="SDkEP"] div,
        html body div[class*="o3j99"] div,
        html body div[class*="L3eUgb"] div,
        html body div[class*="RNNXgb"] > *,
        html body div[class*="A8SBwf"] > * {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Search results - position below search bar (no extra margin, let natural flow work) */
        html body #search,
        html body #rso,
        html body #center_col,
        html body #main,
        html body #res {
            position: relative !important;
            z-index: 1 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        /* Google tabs (AI Mode, All, Images, etc.) - ensure proper spacing */
        html body div[class*="hdtb"],
        html body div[class*="hdtb-tab"],
        html body div[id*="hdtb"] {
            position: relative !important;
            z-index: 9999 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
        /* CRITICAL: Ensure search input text is visible and uses theme color */
        html body input[type="search"],
        html body input[type="text"][name*="q"],
        html body input[type="text"][name*="search"],
        html body input.gLFyf,
        html body input[class*="gLFyf"],
        html body textarea[class*="search"],
        html body .tint-search-container input,
        html body .tint-search-container textarea {
            color: ${theme.text || '#000000'} !important;
            -webkit-text-fill-color: ${theme.text || '#000000'} !important;
            caret-color: ${theme.text || '#000000'} !important;
            background-color: transparent !important;
            opacity: 1 !important;
            -webkit-opacity: 1 !important;
            position: relative !important;
            z-index: 10000 !important;
        }
        /* Apply theme text color to search input value/text content */
        html body input[type="search"]:not(:placeholder-shown),
        html body input[type="text"][name*="q"]:not(:placeholder-shown),
        html body input.gLFyf:not(:placeholder-shown),
        html body input[class*="gLFyf"]:not(:placeholder-shown) {
            color: ${theme.text || '#000000'} !important;
            -webkit-text-fill-color: ${theme.text || '#000000'} !important;
        }
        html body input[type="search"]::placeholder,
        html body input[type="text"][name*="q"]::placeholder,
        html body input.gLFyf::placeholder,
        html body .tint-search-container input::placeholder {
            color: ${theme.text ? theme.text + 'B3' : 'rgba(0,0,0,0.7)'} !important;
            -webkit-text-fill-color: ${theme.text ? theme.text + 'B3' : 'rgba(0,0,0,0.7)'} !important;
            opacity: 1 !important;
            -webkit-opacity: 1 !important;
        }
        /* Ensure search container is above everything */
        html body .tint-search-container,
        html body div[class*="RNNXgb"],
        html body div[class*="A8SBwf"] {
            position: relative !important;
            z-index: 10000 !important;
        }
        /* Ensure search input text doesn't get hidden behind background */
        html body .tint-search-container input[type="search"],
        html body .tint-search-container input[type="text"],
        html body div[class*="RNNXgb"] input,
        html body div[class*="A8SBwf"] input {
            position: relative !important;
            z-index: 10001 !important;
            background-color: transparent !important;
            mix-blend-mode: normal !important;
        }
        /* Banners and UI elements - transparent so theme shows through */
        html body div[class*="kno-fb"],
        html body div[class*="kno-fb-lp"],
        html body div[class*="banner"],
        html body div[id*="banner"] {
            background-color: transparent !important;
            background-image: none !important;
        }
        /*
         * Interactive panels / overlays (e.g., sports match widgets) should render normally.
         * These often use dialog/overlay semantics; keep them unthemed.
         */
        html body [role="dialog"],
        html body [aria-modal="true"],
        html body [role="dialog"] *,
        html body [aria-modal="true"] *,
        /* Australian Open and sports match widgets - exclude from background but keep text color */
        html body div[class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[class*="sports"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[class*="widget"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[class*="statistics"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[id*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[id*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[id*="sports"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[id*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[id*="widget"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[id*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        /* Google rich results panels - be more aggressive */
        html body div[data-ved][class*="g"][class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="g"][class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="g"][class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="g"][class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude) {
            background-color: revert !important;
            background-image: revert !important;
        }
        /* But ensure text in these elements uses theme color */
        html body div[class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude) * {
            color: ${theme.text || '#000000'} !important;
        }
        /* Expanded/opened stats panels - exclude from background but keep text color */
        html body div[class*="stats"][aria-expanded="true"],
        html body div[class*="statistics"][aria-expanded="true"],
        html body div[id*="stats"][aria-expanded="true"],
        html body div[data-ved][aria-expanded="true"],
        html body div[class*="expanded"],
        html body div[id*="expanded"],
        html body [aria-expanded="true"] {
            background-color: revert !important;
            background-image: revert !important;
            position: relative !important;
            z-index: 100 !important;
            display: revert !important;
            visibility: revert !important;
            opacity: 1 !important;
        }
        /* Children of expanded panels - keep text color */
        html body [aria-expanded="true"] > *,
        html body div[class*="expanded"] > * {
            background-color: revert !important;
            background-image: revert !important;
            color: ${theme.text || '#000000'} !important;
        }
        /* Images and image containers - must be visible - FINAL OVERRIDE */
        html body .tint-image-container {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* CRITICAL: Images must be visible - highest priority, but preserve positioning */
        /* REFINED: Remove width/height auto to preserve CSS sprites (fixes Amazon) */
        /* LOGO EXEMPT: Logo images excluded so JS-applied dark theme filters work */
        html body img:not(.tint-logo-preserved):not(.tint-filter-applied),
        html body picture, html body video, html body canvas,
        html body svg:not([class*="icon"]):not([id*="icon"]), html body iframe,
        html body object, html body embed, html body [role="img"] {
            background-color: transparent !important;
            background-image: none !important;
            opacity: 1 !important;
            visibility: visible !important;
            /* REMOVED: width/height auto !important - This fixes Amazon sprites */
            /* Let the website control image dimensions for CSS sprites */
            max-width: 100% !important;
            filter: none !important; /* Prevent double-inversion */
        }
        /* Google search result images - ensure they display correctly */
        /* REMOVED: width/height auto to preserve CSS sprites */
        html body div[data-ved] img,
        html body div[class*="g"] img,
        html body div[class*="tF2Cxc"] img {
            object-fit: contain !important;
            max-width: 100% !important;
            transform: none !important;
            -webkit-transform: none !important;
            /* DO NOT revert position - keep images where they are */
        }
        /* Google scores/stats - ensure they display normally (not expanded) */
        html body div[data-ved][class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude),
        html body div[data-ved][class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude) {
            background-color: revert !important;
            background-image: revert !important;
        }
        /* But ensure text in these elements uses theme color */
        html body div[data-ved][class*="match"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="score"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="stats"]:not([aria-expanded="true"]):not(.tint-ui-exclude) *,
        html body div[data-ved][class*="event"]:not([aria-expanded="true"]):not(.tint-ui-exclude) * {
            color: ${theme.text || '#000000'} !important;
        }
    `;
}

/**
 * Generates Wikipedia-specific CSS
 */
function generateWikipediaCSS(theme) {
    const textColor = theme.text || '#000000';
    return `
        /* WIKIPEDIA-SPECIFIC OVERRIDES */
        /* Base CSS handles html/body/pseudo-element backgrounds universally */
        /* This file targets Wikipedia-specific wrapper elements and skins */
        
        /* ========== DESKTOP: VECTOR SKIN ========== */
        /* Target ALL Wikipedia page wrappers and containers */
        #mw-page-base,
        #mw-head-base,
        #mw-navigation,
        #mw-head,
        #mw-head-container,
        #left-navigation,
        #right-navigation,
        #content,
        #bodyContent,
        #mw-content-container,
        #mw-content-text,
        .mw-page-container,
        .mw-page-container-inner,
        .vector-body,
        .vector-body-before,
        .vector-body-after,
        .vector-page-container,
        .vector-page-container-inner,
        .vector-page-toolbar,
        .vector-page-toolbar-container,
        .vector-header,
        .vector-header-container {
            background-color: transparent !important;
            background-image: none !important;
        }
        
        /* Remove the 'fog' by making sure the content area is strictly transparent */
        .mw-body, #content, #mw-data-after-content, .settings-bar {
            background: transparent !important;
        }

        /* Sidebar menu needs visible background (desktop Vector) */
        .vector-sidebar-container,
        #mw-panel {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.9) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
        }
        .vector-menu-portal, .vector-menu-content {
            background-color: transparent !important;
        }

        .vector-menu-heading, .mw-panel .portal h3 {
            background: transparent !important;
            border-bottom: 1px solid ${textColor}33 !important;
        }
        
        /* ========== MOBILE: MINERVA SKIN ========== */
        /* CRITICAL: Mobile Wikipedia uses completely different class names */
        /* Target Minerva skin wrapper elements that have white backgrounds */
        /* NOTE: .branding-box intentionally EXCLUDED — it contains the Wikipedia logo */
        /* and stripping background-image would hide the logo on mobile */
        #mw-mf-viewport,
        #mw-mf-page-center,
        #mw-mf-page-left,
        .skin-minerva,
        .minerva-header,
        .header-container,
        .pre-content,
        .content-unstyled,
        .overlay-header,
        .overlay-content,
        /* Minerva header and navigation */
        html body #mw-mf-viewport,
        html body #mw-mf-page-center,
        html body #mw-mf-page-left,
        html body .minerva-header,
        html body .header-container,
        /* REMOVED: .branding-box — it contains the Wikipedia logo as a background-image */
        html body .pre-content,
        html body .content-unstyled,
        /* Mobile Wikipedia banner/notice elements */
        html body .mw-mf-page-center,
        html body .post-content,
        html body .last-modified-bar,
        html body .minerva__tab-container,
        html body .minerva-search-form,
        /* REMOVED: Overly broad [class*="minerva"], [class*="mw-mf"], [id*="mw-mf"] */
        /* Those caught icon elements like mw-ui-icon-minerva-hamburger and stripped background-image */
        /* Specific .minerva-*, #mw-mf-* selectors above already cover layout containers */
        /* The main page content wrapper on mobile */
        html body .mw-body-content,
        html body .mw-parser-output,
        html body .mw-content-ltr,
        html body .mw-content-rtl,
        /* Additional wrapper divs */
        html body .page-summary,
        html body .section-heading,
        html body .mw-headline {
            background-color: transparent !important;
            background-image: none !important;
        }
        
        /* Mobile Wikipedia hamburger menu overlay - needs themed background */
        #mw-mf-page-left,
        .navigation-drawer,
        html body .navigation-drawer,
        html body #mw-mf-page-left {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.95) !important;
            backdrop-filter: blur(15px) !important;
            -webkit-backdrop-filter: blur(15px) !important;
        }

        /* ========== SHARED: ALL WIKIPEDIA SKINS ========== */
        /* Tables — Wikipedia uses tables everywhere; clear their backgrounds */
        .mw-body, .parabase, td, th, tr, table,
        .infobox, .ambox, .navbox, .catlinks,
        .wikitable, .mw-datatable {
            background-color: transparent !important;
            background-image: none !important;
        }
        
        /* Navigation */
        #p-navigation, #p-tb, #p-lang,
        [id*="mw-navigation"],
        [class*="mw-navigation"],
        [id*="mw-page-base"],
        [class*="mw-page-base"] {
            background-color: transparent !important;
            background-image: none !important;
        }
        
        /* Remove background images from cards/boxes that cause white strips */
        [class*="card"],
        [class*="article-card"],
        [class*="box"]:not([class*="search"]),
        [class*="infobox"] {
            background-image: none !important;
        }
        
        /* CRITICAL: Preserve Wikipedia icon sprites and child images/svgs */
        /* Wikipedia mobile (Minerva) uses background-image CSS sprites for navigation icons */
        /* These MUST NOT be stripped — hamburger, search, language, star, edit icons */
        html body .mw-ui-icon,
        html body [class*="mw-ui-icon"],
        html body .cdx-icon,
        html body [class*="cdx-icon"],
        html body .cdx-button__icon,
        html body .vector-icon,
        html body [class*="vector-icon"],
        html body [class*="minerva-icon"],
        html body button[class*="icon"],
        html body a[class*="icon"],
        html body span[class*="icon"] {
            border-color: transparent !important;
            background-color: transparent !important;
        }
        /* Force SVG icon children to inherit theme color — fixes invisible icons on dark themes */
        /* Wikipedia icons often have <path fill="#333"> which disappears on dark backgrounds */
        html body .mw-ui-icon svg *,
        html body [class*="mw-ui-icon"] svg *,
        html body .cdx-icon svg *,
        html body [class*="cdx-icon"] svg *,
        html body .cdx-button__icon svg *,
        html body .vector-icon svg *,
        html body [class*="vector-icon"] svg * {
            fill: currentColor !important;
        }
        /* Ensure img/svg inside icon containers are fully visible */
        html body .mw-ui-icon img,
        html body .mw-ui-icon svg,
        html body [class*="mw-ui-icon"] img,
        html body [class*="mw-ui-icon"] svg,
        html body .cdx-icon img,
        html body .cdx-icon svg,
        html body .vector-icon img,
        html body .vector-icon svg,
        html body .cdx-button__icon img,
        html body .cdx-button__icon svg {
            opacity: 1 !important;
            visibility: visible !important;
            filter: none !important;
        }
        
        /* Wikipedia search inputs — keep functional */
        input.mw-input,
        input.vector-search-box-input,
        input[class*="search"] {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.15) !important;
            color: var(--tint-text, ${textColor}) !important;
        }
        
        /* ========== WIKIPEDIA DROPDOWNS & POPOVERS ========== */
        /* Vector skin dropdown menus (language selector, appearance, tools, etc.) */
        .vector-menu-dropdown .vector-menu-content,
        .vector-menu-dropdown .vector-menu-content-list,
        .vector-appearance .vector-menu-content,
        .mw-portlet .vector-menu-content,
        .vector-dropdown-content,
        .vector-page-tools-container .vector-menu-content {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.98) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
        }
        
        /* Wikipedia hover card previews (page previews on link hover) */
        .mwe-popups,
        .mwe-popups-container,
        .mwe-popups .mwe-popups-extract,
        .ui-suggestions,
        .ui-suggestions .suggestions-result {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.98) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border: 1px solid ${textColor}22 !important;
        }
        
        /* Wikipedia mobile search overlay and suggestions */
        .search-overlay,
        .search-box,
        .suggestions-dropdown,
        .search-results-view {
            background-color: rgba(var(--tint-bg-rgb, 255, 255, 255), 0.98) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
        }
    `;
}

/**
 * Generates Amazon-specific CSS
 */
function generateAmazonCSS(theme) {
    return `
        /* AMAZON-SPECIFIC EXCLUSIONS ONLY */
        /* Base CSS already applies theme to everything */
        /* Only exclude problematic elements here */
        
        /* Amazon Nav Fixes */
        #navbar, #nav-belt, #nav-main, #nav-subnav, .nav-sprite-v1,
        html body #navbar,
        html body #nav-belt,
        html body #nav-main,
        html body #nav-subnav,
        html body .nav-sprite-v1 {
            background-color: transparent !important;
            background-image: none !important;
        }

        /* Fix Logo Duplication: Don't force position or display */
        /* Amazon relies on relative positioning for its logo sprites */
        #nav-logo, .nav-logo-link, .nav-logo-tagline, #nav-logo-sprites,
        html body #nav-logo,
        html body .nav-logo-link,
        html body .nav-logo-tagline,
        html body #nav-logo-sprites,
        html body [id*="nav-logo"],
        html body [class*="nav-logo"] {
            background-color: transparent !important;
            /* Remove the aggressive reverts that cause duplication */
            /* DO NOT force position: static or display: revert */
        }

        /* Keep Amazon's specific image-replacement logos working */
        .nav-sprite,
        html body .nav-sprite {
            background-color: transparent !important;
        }
        
        /* Exclude ONLY specific logo images - be very specific to avoid excluding content */
        /* DO NOT apply filter: none to logo images — let JS dark-theme filter work */
        html body [id*="nav-logo"] img,
        html body [class*="nav-logo"] img,
        html body [id*="nav-logo-sprites"] img,
        html body [class*="nav-logo-sprites"] img,
        html body [id*="nav-logo"] svg,
        html body [class*="nav-logo"] svg,
        html body img[alt*="Amazon"][src*="logo"],
        html body img[alt*="amazon"][src*="logo"],
        html body a[href*="/"] img[src*="logo"],
        html body a[href*="/"] svg[class*="logo"] {
            background-color: transparent !important;
            background-image: revert !important;
            opacity: 1 !important;
            mix-blend-mode: normal !important;
            transform: none !important;
            -webkit-transform: none !important;
            /* filter intentionally omitted — JS controls dark theme inversion */
            /* DO NOT force position: static - Amazon needs relative positioning */
            /* DO NOT force display: revert - breaks layout */
        }
        
        /* Exclude ONLY the actual navbar container (not all divs with "nav" in ID) */
        html body [id="navbar"],
        html body [id="nav-main"],
        html body [class="navbar"],
        html body [class="nav-main"],
        html body [id*="navbar"]:not([id*="content"]):not([id*="main"]),
        html body [class*="navbar"]:not([class*="content"]):not([class*="main"]) {
            background-color: transparent !important;
            background-image: none !important;
        }
    `;
}

/**
 * Generates generic site CSS for sites without specific handlers
 */
function generateGenericCSS(theme) {
    return `
        /* GENERIC SITE RULES — transparency with proper exclusions */
        /* Same surgical exclusion list as base CSS section 3 — only exclude INTERACTIVE roles */
        /* CRITICAL: Exclude icon containers — they use background-image sprites that MUST be preserved */
        /* CRITICAL: Exclude logo containers — they use background-image for site logos */
        div:not(.tint-ui-exclude):not(.tint-image-container):not(.tint-icon-preserved):not(.tint-logo-preserved):not([role="dialog"]):not([role="alertdialog"]):not([role="tooltip"]):not([role="menu"]):not([role="listbox"]):not([role="combobox"]):not([aria-modal]):not([class*="modal"]):not([class*="dialog"]):not([class*="popup"]):not([class*="dropdown"]):not([class*="menu"]):not([class*="tooltip"]):not([class*="popover"]):not([class*="toast"]):not([class*="snackbar"]):not([class*="cookie"]):not([class*="consent"]):not([class*="toolbar"]):not([class*="tabbar"]):not([class*="tab-bar"]):not([class*="card"]:not([class*="container"])):not([class*="btn"]):not([class*="button"]:not([class*="container"])):not([id*="modal"]):not([id*="dialog"]):not([id*="popup"]):not([id*="dropdown"]):not([id*="menu"]):not([id*="cookie"]):not([id*="consent"]):not([class*="icon"]):not([class*="Icon"]):not([id*="icon"]):not([id*="Icon"]):not([class*="logo"]):not([class*="Logo"]):not([id*="logo"]):not([id*="Logo"]):not([class*="brand"]):not([id*="brand"]),
        div#content:not(.tint-ui-exclude):not(.tint-image-container),
        div#main:not(.tint-ui-exclude):not(.tint-image-container),
        main:not(.tint-ui-exclude):not(.tint-image-container),
        section:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]),
        article:not(.tint-ui-exclude):not(.tint-image-container),
        .wrapper:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]),
        .container:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([aria-modal]),
        div[class*="content"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([class*="modal"]):not([class*="dialog"]):not([class*="popup"]),
        div[class*="main"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([class*="modal"]):not([class*="dialog"]),
        div[class*="wrapper"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([class*="modal"]),
        div[class*="container"]:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]):not([role="alertdialog"]):not([class*="modal"]),
        /* Structural role elements — MUST be transparent on generic sites too */
        [role="banner"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="search"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="main"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="contentinfo"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="complementary"]:not(.tint-ui-exclude):not(.tint-image-container),
        [role="region"]:not(.tint-ui-exclude):not(.tint-image-container):not([class*="modal"]),
        [role="form"]:not(.tint-ui-exclude):not(.tint-image-container),
        header:not(.tint-ui-exclude):not(.tint-image-container),
        nav:not(.tint-ui-exclude):not(.tint-image-container),
        footer:not(.tint-ui-exclude):not(.tint-image-container),
        aside:not(.tint-ui-exclude):not(.tint-image-container),
        form:not(.tint-ui-exclude):not(.tint-image-container):not([role="dialog"]) {
            background-color: transparent !important;
            background-image: none !important;
        }
        /* Nuke white backgrounds in generic sites too */
        [style*="background-color: #fff"]:not(.tint-ui-exclude):not([role="dialog"]):not([role="alertdialog"]),
        [style*="background-color: #ffffff"]:not(.tint-ui-exclude):not([role="dialog"]):not([role="alertdialog"]),
        [style*="background-color: white"]:not(.tint-ui-exclude):not([role="dialog"]):not([role="alertdialog"]),
        [style*="background-color: rgb(255, 255, 255)"]:not(.tint-ui-exclude):not([role="dialog"]):not([role="alertdialog"]) {
            background-color: transparent !important;
        }
        /* Ad containers and sponsored content */
        html [class*="ad"]:not([class*="header"]):not([class*="nav"]):not(.tint-ui-exclude),
        html [class*="advertisement"]:not(.tint-ui-exclude),
        html [class*="sponsored"]:not(.tint-ui-exclude),
        html [id*="ad"]:not([id*="header"]):not([id*="nav"]):not(.tint-ui-exclude),
        html [id*="advertisement"]:not(.tint-ui-exclude),
        html [id*="sponsored"]:not(.tint-ui-exclude),
        html [class*="promo"]:not(.tint-ui-exclude),
        html [id*="promo"]:not(.tint-ui-exclude) {
            background-color: transparent !important;
            background-image: none !important;
        }
`;
}

/**
 * Detects which site we're on and returns appropriate CSS generator
 */
function getSiteCSS(hostname, theme) {
    const domain = hostname.toLowerCase();
    
    if (domain.includes('google.com') || domain.includes('google.')) {
        return generateGoogleCSS(theme);
    } else if (domain.includes('wikipedia.org') || domain.includes('wikimedia.org')) {
        return generateWikipediaCSS(theme);
    } else if (domain.includes('amazon.com') || domain.includes('amazon.')) {
        return generateAmazonCSS(theme);
    } else {
        return generateGenericCSS(theme);
    }
}

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
        debugLog("Tint: Theme is disabled");
        return;
    }

    // CRITICAL: Mark fixed/sticky elements BEFORE generating CSS
    // But be selective - only mark actual headers/navs, not all fixed elements
    // Make this function global so MutationObserver can call it
    window.markFixedStickyElements = function markFixedStickyElements() {
        // Only mark headers/navs that are fixed/sticky, not all fixed elements
        document.querySelectorAll('header, nav, [class*="header"]:not([class*="content"]):not([class*="main"]), [class*="nav"]:not([class*="content"]):not([class*="main"]), [id*="header"]:not([id*="content"]):not([id*="main"]), [id*="nav"]:not([id*="content"]):not([id*="main"])').forEach(el => {
            try {
                const style = window.getComputedStyle(el);
                // Only mark if it's actually fixed/sticky AND it's a header/nav
                if ((style.position === 'fixed' || style.position === 'sticky') && 
                    (el.tagName === 'HEADER' || el.tagName === 'NAV' || 
                     el.className.includes('header') || el.className.includes('nav') ||
                     el.id.includes('header') || el.id.includes('nav'))) {
                    if (!el.classList.contains('tint-ui-exclude')) {
                        el.classList.add('tint-ui-exclude');
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        });
    };
    window.markFixedStickyElements();

    debugLog("Tint: Applying theme:", theme);
    debugLog("Tint: Theme backgroundType:", theme.backgroundType);
    debugLog("Tint: Theme backgroundGradient:", theme.backgroundGradient);
    debugLog("Tint: Theme background:", theme.background);

    // Mark divs containing images so we can exclude them from background rules
    // Find all images, videos, etc. and mark their parent divs - do this FIRST
    // Make this function global so MutationObserver can call it
    window.markImageContainers = function markImageContainers() {
        // CRITICAL FIX: Separate SVGs from other media when marking parents.
        // SVGs are often small inline icons — marking their parent divs as tint-image-container
        // strips background-color/background-image from the ENTIRE subtree, killing icon sprites
        // and UI element backgrounds within that container.
        // Only mark parents of actual images/media (img, picture, video, iframe, canvas).
        
        // 1. Mark non-SVG media and their parent containers (up to 3 levels)
        // LOGO EXEMPT: Skip marking parents that are logo containers, to preserve
        // background-image sprites used by some sites for their logos.
        document.querySelectorAll('img, picture, video, iframe, canvas').forEach(media => {
            if (!media.classList.contains('tint-image-container')) {
                media.classList.add('tint-image-container');
            }
            // Check if this image is inside a logo container — if so, don't mark parents
            const isLogoImage = media.classList.contains('tint-logo-preserved') ||
                media.classList.contains('tint-filter-applied') ||
                (media.closest && media.closest('[class*="logo"], [class*="Logo"], [id*="logo"], [id*="Logo"], [class*="brand"], [class*="Brand"], .branding-box, .mw-logo, .nav-logo-link'));
            if (isLogoImage) return; // Don't mark parent containers of logos
            
            let parent = media.parentElement;
            let levels = 0;
            while (parent && levels < 3) {
                if (parent.tagName === 'DIV' && !parent.classList.contains('tint-image-container')) {
                    parent.classList.add('tint-image-container');
                }
                if (parent.tagName === 'FIGURE' && !parent.classList.contains('tint-image-container')) {
                    parent.classList.add('tint-image-container');
                }
                parent = parent.parentElement;
                levels++;
            }
        });
        
        // 2. Mark SVGs themselves as tint-image-container (for opacity/visibility)
        // but do NOT mark their parent divs — SVGs are often small icons within
        // containers that need their backgrounds preserved
        document.querySelectorAll('svg, [role="img"]').forEach(media => {
            if (!media.classList.contains('tint-image-container')) {
                media.classList.add('tint-image-container');
            }
            // Only mark the immediate parent if it's a figure element (semantic image wrapper)
            const parent = media.parentElement;
            if (parent && parent.tagName === 'FIGURE' && !parent.classList.contains('tint-image-container')) {
                parent.classList.add('tint-image-container');
            }
        });
    }
    // Mark images immediately
    markImageContainers();
    // Also watch for dynamically added images - THROTTLED with requestAnimationFrame
    let imageObserverPending = false;
    const imageObserver = new MutationObserver((mutations) => {
        // Pre-filter: only process if there are actual image/media elements
        const hasMedia = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return false;
                const el = node;
                return el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.tagName === 'VIDEO' ||
                       el.tagName === 'IFRAME' || el.tagName === 'CANVAS' || el.tagName === 'SVG' ||
                       el.querySelector && (el.querySelector('img, picture, video, iframe, canvas, svg'));
            });
        });
        if (!hasMedia) return;
        
        if (!imageObserverPending) {
            imageObserverPending = true;
            requestAnimationFrame(() => {
                markImageContainers();
                imageObserverPending = false;
            });
        }
    });
    imageObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    // Re-mark after delays to catch late-loading images
    setTimeout(markImageContainers, 100);
    setTimeout(markImageContainers, 500);
    setTimeout(markImageContainers, 1000);
    setTimeout(markImageContainers, 2000);
    
    // Function to mark search containers
    function markSearchContainers() {
        // Catch all possible search input patterns
        const searchInputs = document.querySelectorAll(
            'input[type="search"], ' +
            'input[type="text"][name*="q"], input[type="text"][name*="Q"], ' +
            'input[type="text"][name*="search"], input[type="text"][name*="Search"], ' +
            'input[aria-label*="Search"], input[aria-label*="search"], ' +
            'input[placeholder*="Search"], input[placeholder*="search"], ' +
            'input.gLFyf, input[class*="gLFyf"], ' +
            'input[class*="search"], input[id*="search"]'
        );
        searchInputs.forEach(input => {
            let parent = input.parentElement;
            // Mark parent and grandparent divs (up to 5 levels) to catch Google's complex structure
            let levels = 0;
            while (parent && levels < 5) {
                if (parent.tagName === 'DIV' && !parent.classList.contains('tint-search-container')) {
                    parent.classList.add('tint-search-container');
                }
                // Also mark form elements
                if (parent.tagName === 'FORM' && !parent.classList.contains('tint-search-container')) {
                    parent.classList.add('tint-search-container');
                }
                parent = parent.parentElement;
                levels++;
            }
        });
        
        // Also mark Google-specific search containers by class patterns
        document.querySelectorAll('[class*="RNNXgb"], [class*="A8SBwf"], [class*="SDkEP"], [class*="RNmpXc"], [class*="aajZCb"], [class*="lJ9FBc"], [class*="gLFyf"]').forEach(el => {
            let parent = el.parentElement;
            let levels = 0;
            while (parent && levels < 3) {
                if (parent.tagName === 'DIV' && !parent.classList.contains('tint-search-container')) {
                    parent.classList.add('tint-search-container');
                }
                parent = parent.parentElement;
                levels++;
            }
        });
    }
    
    // Mark search containers immediately
    markSearchContainers();
    
    // Also watch for dynamically added search inputs (Google loads them dynamically) - THROTTLED
    let searchObserverPending = false;
    const searchObserver = new MutationObserver((mutations) => {
        // Pre-filter: only process if there are actual input elements
        const hasInputs = mutations.some(mutation => {
            return Array.from(mutation.addedNodes).some(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return false;
                const el = node;
                return el.tagName === 'INPUT' || el.tagName === 'FORM' ||
                       (el.querySelector && el.querySelector('input[type="search"], input[type="text"]'));
            });
        });
        if (!hasInputs) return;
        
        if (!searchObserverPending) {
            searchObserverPending = true;
            requestAnimationFrame(() => {
                markSearchContainers();
                searchObserverPending = false;
            });
        }
    });
    searchObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Re-mark after a short delay to catch late-loading elements
    setTimeout(markSearchContainers, 500);
    setTimeout(markSearchContainers, 1000);
    setTimeout(markSearchContainers, 2000);
    
    // Mark banners and UI sections to exclude them
    function markUISections() {
        // TARGETED: Mark fixed/sticky elements using specific selectors instead of querySelectorAll('*')
        // This is much more performant than iterating every element on the page
        
        // Common elements that are typically fixed/sticky: headers, navs, footers, sidebars, toolbars
        const stickyFixedCandidates = document.querySelectorAll(
            'header, nav, footer, aside, ' +
            '[class*="header"]:not([class*="content"]):not([class*="main"]), ' +
            '[class*="nav"]:not([class*="content"]):not([class*="main"]), ' +
            '[class*="footer"]:not([class*="content"]):not([class*="main"]), ' +
            '[class*="sidebar"]:not([class*="content"]):not([class*="main"]), ' +
            '[class*="toolbar"]:not([class*="content"]):not([class*="main"]), ' +
            '[class*="sticky"]:not([class*="content"]):not([class*="main"]), ' +
            '[class*="fixed"]:not([class*="content"]):not([class*="main"]), ' +
            '[id*="header"]:not([id*="content"]):not([id*="main"]), ' +
            '[id*="nav"]:not([id*="content"]):not([id*="main"]), ' +
            '[id*="footer"]:not([id*="content"]):not([id*="main"]), ' +
            '[id*="sidebar"]:not([id*="content"]):not([id*="main"]), ' +
            '[id*="toolbar"]:not([id*="content"]):not([id*="main"]), ' +
            '[role="banner"], [role="navigation"], [role="contentinfo"], ' +
            '[role="toolbar"], [role="tablist"], ' +
            // Common top-level divs that might be fixed/sticky
            'body > div, body > div > div, #app > div, #root > div, #__next > div'
        );
        
        stickyFixedCandidates.forEach(el => {
            try {
            const style = window.getComputedStyle(el);
                const zIndex = parseInt(style.zIndex) || 0;
                
                if (style.position === 'fixed') {
                if (!el.classList.contains('tint-ui-exclude')) {
                    el.classList.add('tint-ui-exclude');
                }
                } else if (style.position === 'sticky') {
                    const isSectionHeader = /^H[1-6]$/.test(el.tagName);
                    if (!isSectionHeader && !el.classList.contains('tint-ui-exclude')) {
                        el.classList.add('tint-ui-exclude');
                    }
                }
                
                // Mark elements with elevated z-index (likely UI overlays, modals, dropdowns)
                // Lowered from 500 → 10 to catch more floating UI elements
                if (zIndex > 10 && !el.classList.contains('tint-ui-exclude')) {
                        el.classList.add('tint-ui-exclude');
                }
            } catch (e) {
                // Ignore errors
            }
        });
        
        // Also check for overlay/modal elements — these must NEVER be made transparent
        document.querySelectorAll(
            '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], ' +
            '[role="tooltip"], [role="combobox"], [aria-modal="true"], ' +
            '[class*="modal"], [class*="overlay"], [class*="popup"], ' +
            '[class*="dropdown"]:not([class*="container"]), ' +
            '[class*="popover"]:not([class*="container"]), ' +
            '[class*="toast"], [class*="snackbar"], ' +
            '[class*="cookie"], [class*="consent"], [class*="gdpr"], ' +
            /* Modern SPA framework patterns */
            '[data-popper-placement], [data-tippy-root], ' +
            '[data-radix-popper-content-wrapper], ' +
            '[data-state="open"]:not(input):not(select), ' +
            /* Wikipedia-specific floating UI */
            '.mwe-popups, .vector-menu-dropdown, .vector-appearance-menu, .ui-suggestions'
        ).forEach(el => {
            if (!el.classList.contains('tint-ui-exclude')) {
                el.classList.add('tint-ui-exclude');
            }
        });
        
        // Mark Wikipedia sidebar menu - needs visible background
        document.querySelectorAll('#mw-panel, .vector-sidebar-container, [id*="mw-panel"], [class*="sidebar"]').forEach(el => {
            if (!el.classList.contains('tint-ui-exclude')) {
                el.classList.add('tint-ui-exclude');
            }
        });
        
        // Mark banners — but do NOT mark parent divs (over-marking parents can white-out headers)
        document.querySelectorAll('[class*="kno-fb"], [class*="kno-fb-lp"]').forEach(el => {
            if (!el.classList.contains('tint-ui-exclude')) {
                el.classList.add('tint-ui-exclude');
            }
        });
        // Mark elements containing rich widget content (sports, events, etc.)
        // REFINED: Only mark elements with specific widget/rich-result classes, NOT all data-ved elements
        // data-ved is used on almost every Google element — marking all of them is too broad
        document.querySelectorAll('div[class*="widget"], div[class*="rich-result"], div[class*="kp-wholepage"]').forEach(el => {
            if (el.textContent && (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'ARTICLE')) {
                if (!el.classList.contains('tint-ui-exclude')) {
                    el.classList.add('tint-ui-exclude');
                }
            }
        });
        // Mark Google stats/match widgets by content
        document.querySelectorAll('div[data-ved]').forEach(el => {
            const text = el.textContent || '';
            // Check for stats/match indicators
            if (text.includes('match') || text.includes('score') || text.includes('stats') || 
                text.includes('statistics') || text.includes('Semi-final') || text.includes('Final') ||
                text.includes('Completed') || text.includes('Video highlights')) {
                // Check if it's a stats widget (has scores, player names, etc.)
                const hasScorePattern = /\d+\s+\d+/; // Pattern like "6 7" (scores)
                const hasPlayerPattern = /[A-Z]\.\s+[A-Z][a-z]+/; // Pattern like "J. Pegula"
                if (hasScorePattern.test(text) || hasPlayerPattern.test(text)) {
                    if (!el.classList.contains('tint-ui-exclude')) {
                        el.classList.add('tint-ui-exclude');
                    }
                    // Mark parent and children
                    let parent = el.parentElement;
                    let levels = 0;
                    while (parent && levels < 2) {
                        if (parent.tagName === 'DIV' && !parent.classList.contains('tint-ui-exclude')) {
                            parent.classList.add('tint-ui-exclude');
                        }
                        parent = parent.parentElement;
                        levels++;
                    }
                    el.querySelectorAll('*').forEach(child => {
                        if (!child.classList.contains('tint-ui-exclude')) {
                            child.classList.add('tint-ui-exclude');
                        }
                    });
                }
            }
        });
        // Mark related searches and people also ask sections - but DON'T exclude from text color
        // We want these to have theme text color, just exclude from background
        document.querySelectorAll('[class*="related"], [id*="related"], [class*="people-also-ask"], [id*="people-also-ask"], [class*="also-ask"], [id*="also-ask"], [class*="accordion"], [id*="accordion"]').forEach(el => {
            // Don't mark as tint-ui-exclude - we want text color to apply
            // Just ensure background is transparent (handled by CSS)
            // Also mark parent divs
            let parent = el.parentElement;
            let levels = 0;
            while (parent && levels < 2) {
                if (parent.tagName === 'DIV' && !parent.classList.contains('tint-ui-exclude')) {
                    parent.classList.add('tint-ui-exclude');
                }
                parent = parent.parentElement;
                levels++;
            }
        });

        // Mark overlay / dialog style UI (common for rich widgets like sports match panels)
        document.querySelectorAll('[role="dialog"], [aria-modal="true"], [class*="overlay"], [id*="overlay"], [class*="modal"], [id*="modal"]').forEach(el => {
            if (!el.classList.contains('tint-ui-exclude')) {
                el.classList.add('tint-ui-exclude');
            }
            let parent = el.parentElement;
            let levels = 0;
            while (parent && levels < 2) {
                if ((parent.tagName === 'DIV' || parent.tagName === 'SECTION') && !parent.classList.contains('tint-ui-exclude')) {
                    parent.classList.add('tint-ui-exclude');
                }
                parent = parent.parentElement;
                levels++;
            }
        });
    }
    markUISections();
    setTimeout(markUISections, 500);
    setTimeout(markUISections, 1000);
    
    // TARGETED MutationObserver: Mark new fixed/sticky/overlay elements
    let uiObserverPending = false;
    const uiObserver = new MutationObserver((mutations) => {
        if (uiObserverPending) return;
        
        // Quick check if any significant elements were added
        const hasSignificantNodes = mutations.some(m => {
            return Array.from(m.addedNodes).some(node => {
                if (node.nodeType !== Node.ELEMENT_NODE) return false;
                const tag = node.tagName;
                // Only process structural/UI elements, not text spans etc.
                return tag === 'DIV' || tag === 'HEADER' || tag === 'NAV' || 
                       tag === 'FOOTER' || tag === 'ASIDE' || tag === 'SECTION' ||
                       tag === 'DIALOG' || tag === 'FORM';
            });
        });
        
        if (!hasSignificantNodes) return;
        
        uiObserverPending = true;
        requestAnimationFrame(() => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    const el = node;
                    try {
                        const style = window.getComputedStyle(el);
                        const zIndex = parseInt(style.zIndex) || 0;
                        
                        // Mark fixed/sticky elements
                        if (style.position === 'fixed' || style.position === 'sticky') {
                            if (!el.classList.contains('tint-ui-exclude')) {
                                el.classList.add('tint-ui-exclude');
                            }
                        }
                        
                        // Mark very high z-index elements (modals/overlays)
                        if (zIndex > 500 && !el.classList.contains('tint-ui-exclude')) {
                            el.classList.add('tint-ui-exclude');
                        }
                        
                        // Check for dialog/modal/overlay roles in the new element
                        const role = el.getAttribute('role');
                        if (role === 'dialog' || role === 'alertdialog' || el.getAttribute('aria-modal') === 'true') {
                            if (!el.classList.contains('tint-ui-exclude')) {
                                el.classList.add('tint-ui-exclude');
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }
            }
            uiObserverPending = false;
        });
    });
    
    // Observe the entire document for new elements
    uiObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    // ── PRESERVE LOGO BACKGROUNDS (BEFORE CSS injection) ──
    // CSS rules strip background-image broadly. By the time JavaScript's applyIconFilters()
    // runs, the computed backgroundImage is already "none". We must capture and inline
    // the original background-image BEFORE the stylesheet is inserted.
    // Inline !important beats stylesheet !important in the cascade.
    (function preserveLogoBackgrounds() {
        const logoSelectors = [
            '[class*="logo"]', '[class*="Logo"]',
            '[id*="logo"]', '[id*="Logo"]',
            '[class*="brand"]', '[class*="Brand"]',
            '.branding-box', '.mw-wiki-logo', '.mw-logo', '.mw-logo-container',
            '#nav-logo', '#nav-logo-sprites', '.nav-logo-link', '.nav-sprite',
            'a[href="/"] > *',
            '[role="banner"] [class*="logo"]', '[role="banner"] [id*="logo"]'
        ].join(', ');
        
        try {
            document.querySelectorAll(logoSelectors).forEach(el => {
                if (el.classList.contains('tint-logo-preserved')) return;
                try {
                    const style = window.getComputedStyle(el);
                    const bgImage = style.backgroundImage;
                    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
                        // Capture and inline the original background-image
                        el.style.setProperty('background-image', bgImage, 'important');
                        el.classList.add('tint-logo-preserved');
                        debugLog('Tint: Preserved logo bg-image on', el.tagName, el.className || el.id);
                    }
                } catch (e) { /* skip cross-origin etc */ }
            });
        } catch (e) { /* body not ready yet — logos will be caught by delayed re-runs */ }
    })();
    
    // Get hostname for site-specific CSS
    const hostname = window.location.hostname;
    
    // Generate CSS using modular approach
    const baseCSS = generateBaseCSS(theme);
    const siteCSS = getSiteCSS(hostname, theme);

    const style = document.createElement('style');
    style.id = 'tint-theme';
    style.innerHTML = baseCSS + siteCSS;
    // Insert at the beginning of head to ensure high priority
    if (document.head) {
        document.head.insertBefore(style, document.head.firstChild);
    } else {
        document.documentElement.appendChild(style);
    }
    
    // CRITICAL: Inject theme-color meta tag for iOS Safari
    // This controls the status bar, overscroll, and toolbar color
    // Without this, iOS Safari shows white in the overscroll area and behind the status bar
    (function injectThemeColorMeta() {
        const bgColor = theme.background || '#FFFFFF';
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', bgColor);
        } else {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.setAttribute('name', 'theme-color');
            themeColorMeta.setAttribute('content', bgColor);
            if (document.head) {
                document.head.appendChild(themeColorMeta);
            }
        }
        // Also set the Apple-specific status bar style
        let statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
        if (!statusBarMeta) {
            statusBarMeta = document.createElement('meta');
            statusBarMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
            statusBarMeta.setAttribute('content', 'black-translucent');
            if (document.head) {
                document.head.appendChild(statusBarMeta);
            }
        }
    })();
    
    // Force immediate application by applying directly to html and body as well
    if (document.documentElement) {
        const htmlStyle = document.documentElement.style;
        if (theme.backgroundType === 'gradient' && theme.backgroundGradient) {
            if (isMonochromeDiagonalGradient(theme.backgroundGradient)) {
                // Monochrome diagonal split - match getBackgroundCSS values
                htmlStyle.setProperty('background', theme.backgroundGradient, 'important');
                htmlStyle.setProperty('background-size', MONOCHROME_GRADIENT_SIZE, 'important');
                htmlStyle.setProperty('background-position', MONOCHROME_GRADIENT_POSITION, 'important');
                htmlStyle.setProperty('background-attachment', 'fixed', 'important');
                htmlStyle.setProperty('background-repeat', 'no-repeat', 'important');
            } else {
                htmlStyle.setProperty('background', theme.backgroundGradient, 'important');
                htmlStyle.setProperty('background-size', DEFAULT_GRADIENT_SIZE, 'important');
                htmlStyle.setProperty('background-attachment', 'fixed', 'important');
                htmlStyle.setProperty('background-repeat', 'no-repeat', 'important');
            }
        } else {
            htmlStyle.setProperty('background-color', theme.background || '#FFFFFF', 'important');
        }
    }
    if (document.body) {
        const bodyStyle = document.body.style;
        if (theme.backgroundType === 'gradient' && theme.backgroundGradient) {
            if (isMonochromeDiagonalGradient(theme.backgroundGradient)) {
                // Monochrome diagonal split - match getBackgroundCSS values
                bodyStyle.setProperty('background', theme.backgroundGradient, 'important');
                bodyStyle.setProperty('background-size', MONOCHROME_GRADIENT_SIZE, 'important');
                bodyStyle.setProperty('background-position', MONOCHROME_GRADIENT_POSITION, 'important');
                bodyStyle.setProperty('background-attachment', 'fixed', 'important');
                bodyStyle.setProperty('background-repeat', 'no-repeat', 'important');
            } else {
                bodyStyle.setProperty('background', theme.backgroundGradient, 'important');
                bodyStyle.setProperty('background-size', DEFAULT_GRADIENT_SIZE, 'important');
                bodyStyle.setProperty('background-attachment', 'fixed', 'important');
                bodyStyle.setProperty('background-repeat', 'no-repeat', 'important');
            }
        } else {
            bodyStyle.setProperty('background-color', theme.background || '#FFFFFF', 'important');
        }
    }
    
    // Force a reflow
    void document.body.offsetHeight;
    
    // Debug: Log the CSS to see what's being applied
    debugLog("Tint: Applied CSS length:", (baseCSS + siteCSS).length);
    debugLog("Tint: Base CSS preview:", baseCSS.substring(0, 500));
    
    // Debug: Check if background is actually applied to body and elements
    setTimeout(() => {
        const bodyStyle = window.getComputedStyle(document.body);
        debugLog("Tint: Body background-color:", bodyStyle.backgroundColor);
        debugLog("Tint: Body background-image:", bodyStyle.backgroundImage);
        const firstDiv = document.querySelector('div');
        if (firstDiv) {
            const divStyle = window.getComputedStyle(firstDiv);
            debugLog("Tint: First div background-color:", divStyle.backgroundColor);
            debugLog("Tint: First div background-image:", divStyle.backgroundImage);
        }
        // Check a few more elements
        const elements = document.querySelectorAll('div, section, article, main');
        debugLog("Tint: Checked", elements.length, "elements");
        for (let i = 0; i < Math.min(5, elements.length); i++) {
            const el = elements[i];
            const elStyle = window.getComputedStyle(el);
            debugLog("Tint: Element", i, "background-color:", elStyle.backgroundColor, "background-image:", elStyle.backgroundImage);
        }
    }, 1000);
    
    // Inject into shadow DOM if present - improved recursive version
    // Make this function global so MutationObserver can call it
    window.injectIntoShadowDOMs = function injectIntoShadowDOMs(root = document) {
        root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                // Check if we've already injected
                if (!el.shadowRoot.getElementById('tint-theme')) {
                    const shadowStyle = document.createElement('style');
                    shadowStyle.id = 'tint-theme';
                    shadowStyle.innerHTML = baseCSS + siteCSS;
                    el.shadowRoot.appendChild(shadowStyle);
                    debugLog("Tint: Injected theme into Shadow DOM");
                }
                // Recursively check shadow DOMs within shadow DOMs
                injectIntoShadowDOMs(el.shadowRoot);
            }
        });
    };
    // Check for shadow DOMs after a delay
    setTimeout(() => window.injectIntoShadowDOMs(), 500);
    setTimeout(() => window.injectIntoShadowDOMs(), 2000);
    
    // Apply icon filters for dark themes
    applyIconFilters(theme);
    
    // CRITICAL: Preserve icon elements AFTER CSS is applied but BEFORE observer starts
    // This detects CSS sprite icons and mask-image icons and protects them from theme stripping
    preserveIconElements(theme);
    
    // Fix SVG icons that are invisible on dark themes (hardcoded dark fills)
    fixDarkThemeSVGs(theme);
    
    // Re-run preservation after delays to catch late-loading icons and logos
    setTimeout(() => { applyIconFilters(theme); preserveIconElements(theme); fixDarkThemeSVGs(theme); }, 500);
    setTimeout(() => { applyIconFilters(theme); preserveIconElements(theme); fixDarkThemeSVGs(theme); }, 1500);
    setTimeout(() => { applyIconFilters(theme); preserveIconElements(theme); fixDarkThemeSVGs(theme); }, 3000);
    
    // Start the universal MutationObserver for dynamic content
    startThemeObserver(theme);
}

/**
 * Universal MutationObserver - Monitors the page for changes and re-applies theme logic to new elements.
 * This handles infinite scroll, pop-ups, dynamic menus, and all dynamically loaded content.
 */
function startThemeObserver(theme) {
    if (!theme || theme.enabled === false) return;
    
    // Disconnect any existing observer
    if (window.__tintThemeObserver) {
        window.__tintThemeObserver.disconnect();
    }

    // Use a debounce/throttle mechanism to avoid performance lag
    let timeout = null;
    let isProcessing = false;

    const observer = new MutationObserver((mutations) => {
        // We check if the mutations actually added nodes
        const nodesAdded = mutations.some(m => {
            return Array.from(m.addedNodes).some(node => {
                return node.nodeType === Node.ELEMENT_NODE && 
                       (node.tagName === 'DIV' || node.tagName === 'SECTION' || 
                        node.tagName === 'ARTICLE' || node.tagName === 'MAIN');
            });
        });
        
        if (nodesAdded && !isProcessing) {
            // Debounce the call so it doesn't fire 100 times a second
            if (timeout) cancelAnimationFrame(timeout);
            
            timeout = requestAnimationFrame(() => {
                isProcessing = true;
                debugLog("Tint: New content detected, re-applying theme logic");
                
                // Re-run marking functions for new elements
                if (window.markFixedStickyElements) window.markFixedStickyElements();
                if (window.markImageContainers) window.markImageContainers();
                
                // Process new elements with luminance checking
                processNewElements();
                
                // Re-inject into any new Shadow DOMs
                if (window.injectIntoShadowDOMs) {
                    window.injectIntoShadowDOMs();
                }
                
                // Re-apply icon filters (especially for Amazon)
                applyIconFilters(theme);
                
                // Preserve dynamically added icon elements (CSS sprites, mask-image)
                preserveIconElements(theme);
                
                // Fix dark theme SVG visibility for new icons
                fixDarkThemeSVGs(theme);
                
                
                isProcessing = false;
            });
        }
    });

    // Start observing the entire document
    observer.observe(document.body, {
        childList: true,
        subtree: true
        // NOTE: We intentionally do NOT observe attributes to avoid infinite loops
    });

    // Store reference for cleanup
    window.__tintThemeObserver = observer;
    
    debugLog("Tint: Universal MutationObserver started");
    return observer;
}

/**
 * Reads theme config from storage directly (more reliable on iOS)
 * Falls back to window.__TINT_THEME_DATA__ if storage read fails
 */
async function getThemeConfig() {
    const hostname = window.location.hostname;
    debugLog("Tint: Loading theme config for:", hostname);
    
    // CRITICAL: Always read directly from storage first (most reliable on iOS)
    // Don't rely on window.__TINT_THEME_DATA__ which may be stale
    let themeData = null;
    
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
        try {
            const result = await browser.storage.local.get('tintThemeData');
            if (result && result.tintThemeData) {
                themeData = result.tintThemeData;
                debugLog("Tint: Got theme from storage directly - background:", themeData.globalTheme?.background);
                debugLog("Tint: Got theme - backgroundType:", themeData.globalTheme?.backgroundType);
                debugLog("Tint: Got theme - backgroundGradient:", themeData.globalTheme?.backgroundGradient);
                // Update the global for other scripts that might use it
                window.__TINT_THEME_DATA__ = themeData;
                window.__TINT_THEME_DATA__._ready = true;
            }
        } catch (e) {
            debugError("Tint: Error reading from storage:", e);
        }
    }
    
    // Fallback to window.__TINT_THEME_DATA__ if storage read failed
    if (!themeData) {
        debugLog("Tint: Storage read failed, trying window.__TINT_THEME_DATA__");
        if (window.__TINT_THEME_DATA__ && window.__TINT_THEME_DATA__._ready) {
            themeData = window.__TINT_THEME_DATA__;
        } else {
            // Wait a bit for injected script to load
            let attempts = 0;
            while ((!window.__TINT_THEME_DATA__ || !window.__TINT_THEME_DATA__._ready) && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
            if (window.__TINT_THEME_DATA__ && window.__TINT_THEME_DATA__._ready) {
                themeData = window.__TINT_THEME_DATA__;
            }
        }
    }
    
    if (!themeData || !themeData.globalTheme) {
        debugLog("Tint: No theme data found");
        return null;
    }
    
    // Determine which theme to apply (global or site-specific)
    let themeToApply = { ...themeData.globalTheme };
    
    // Check for site-specific theme
    if (themeData.siteThemes && themeData.siteThemes[hostname]) {
        themeToApply = { ...themeToApply, ...themeData.siteThemes[hostname] };
        debugLog("Tint: Using site-specific theme for", hostname);
    }
    
    return themeToApply;
}

/**
 * Loads and applies theme on page load
 * Noir-style: reads from injected global variable
 */
async function loadAndApplyTheme() {
    debugLog("Tint content: loadAndApplyTheme called");
    const themeConfig = await getThemeConfig();
    
    if (themeConfig) {
        debugLog("Tint content: Applying theme - background:", themeConfig.background, "text:", themeConfig.text);
        applyTheme(themeConfig);
        window.__TINT_THEME__ = themeConfig;
    } else {
        debugLog("Tint: No theme config available");
    }
}

// Load and apply theme when page loads

// CRITICAL: Immediately trigger background script to sync from App Group
// This ensures we get fresh theme data even if background script hasnt run yet
setTimeout(() => {
    requestThemeUpdate();
}, 100);
loadAndApplyTheme();

// Simple theme update mechanism - relies on storage change listener for instant updates

/**
 * Triggers a theme sync by requesting background script to check for updates
 * This ensures fresh theme data when user returns to Safari after changing settings
 */
async function requestThemeUpdate() {
    try {
        debugLog("Tint content: Requesting theme update");
        
        // FIRST: Try to trigger background script to sync from App Group
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            try {
                debugLog("Tint content: Sending message to background script");
                const response = await browser.runtime.sendMessage({ type: "checkThemeUpdate" });
                debugLog("Tint content: Background script response:", response);
                
                // Wait a moment for storage to update
                await new Promise(resolve => setTimeout(resolve, THEME_SYNC_DELAY_MS));
            } catch (e) {
                debugError("Tint content: Error sending message to background:", e);
            }
        }
        
        // SECOND: Try to call native handler directly (might not work, but worth trying)
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendNativeMessage) {
            try {
                debugLog("Tint content: Trying sendNativeMessage directly");
                const response = await new Promise((resolve, reject) => {
                    browser.runtime.sendNativeMessage(
                        NATIVE_MESSAGE_ID,
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
                
                if (response && response.themeData) {
                    debugLog("Tint content: Got theme from native handler directly!");
                    // Update storage
                    if (browser.storage && browser.storage.local) {
                        await browser.storage.local.set({ tintThemeData: response.themeData });
                    }
                    // Update global and apply
                    window.__TINT_THEME_DATA__ = response.themeData;
                    window.__TINT_THEME_DATA__._ready = true;
                    await loadAndApplyTheme();
                    return;
                }
            } catch (e) {
                debugLog("Tint content: sendNativeMessage failed (expected from content script):", e.message);
            }
        }
        
        // THIRD: Read from storage (fallback) - this is the most reliable on iOS
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            const result = await browser.storage.local.get('tintThemeData');
            if (result && result.tintThemeData) {
                // Check if theme actually changed before applying
                const currentTheme = window.__TINT_THEME__;
                const newTheme = result.tintThemeData.globalTheme;
                
                if (hasThemeChanged(currentTheme, newTheme) || !currentTheme) {
                    debugLog("Tint content: Theme changed or not set - updating from storage");
                    window.__TINT_THEME_DATA__ = result.tintThemeData;
                    window.__TINT_THEME_DATA__._ready = true;
                    await loadAndApplyTheme();
                } else {
                    debugLog("Tint content: Theme unchanged, skipping apply");
                }
            } else {
                debugLog("Tint content: No theme data in storage");
            }
        }
    } catch (error) {
        debugError("Tint content: Error in requestThemeUpdate:", error);
    }
}


// Listen for storage changes (when background script updates theme data)
// This is the PRIMARY mechanism for instant theme updates
if (typeof browser !== 'undefined' && browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.tintThemeData) {
            debugLog("Tint: Storage changed, theme data updated - applying immediately");
            debugLog("Tint: Old theme:", changes.tintThemeData.oldValue?.globalTheme?.background);
            debugLog("Tint: New theme:", changes.tintThemeData.newValue?.globalTheme?.background);
            
            // Update the injected script's global data
            if (changes.tintThemeData.newValue) {
                window.__TINT_THEME_DATA__ = changes.tintThemeData.newValue;
                window.__TINT_THEME_DATA__._ready = true;
                
                // Re-apply theme with new data IMMEDIATELY
                debugLog("Tint: Applying updated theme immediately");
                // Use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    loadAndApplyTheme();
                }, 100);
            }
        }
    });
    debugLog("Tint: Storage change listener registered");
} else {
    debugError("Tint: Storage change listener NOT available!");
}

// Listen for visibility changes (Safari tab focus) to check for theme updates
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        debugLog("Tint: Page visible, checking for theme updates");
        requestThemeUpdate();
    }
});

// Also handle SPA navigation (if needed) - THROTTLED to reduce performance impact
let lastUrl = location.href;
let urlObserverTimeout;
new MutationObserver(() => {
    clearTimeout(urlObserverTimeout);
    urlObserverTimeout = setTimeout(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
            debugLog("Tint: URL changed, re-applying theme");
        loadAndApplyTheme();
    }
    }, MUTATION_DEBOUNCE_MS);
}).observe(document, { subtree: true, childList: true });

// Also check for theme updates periodically when page is visible
// This is critical on iOS where background scripts are unreliable
// Reduced from 2s to 5s to improve battery life on mobile devices
setInterval(() => {
    if (!document.hidden) {
        debugLog("Tint: Periodic theme check");
        // Read directly from storage and apply if changed
        if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
            browser.storage.local.get('tintThemeData').then(result => {
                if (result && result.tintThemeData) {
                    const currentTheme = window.__TINT_THEME__;
                    const newTheme = result.tintThemeData.globalTheme;
                    
                    // Check if theme actually changed using helper function
                    if (hasThemeChanged(currentTheme, newTheme)) {
                        debugLog("Tint: Theme changed in periodic check - applying");
                        window.__TINT_THEME_DATA__ = result.tintThemeData;
                        window.__TINT_THEME_DATA__._ready = true;
                        loadAndApplyTheme();
                    }
                }
            }).catch(error => {
                debugError("Tint: Error in periodic check:", error);
            });
        }
    }
}, POLLING_INTERVAL_MS);
