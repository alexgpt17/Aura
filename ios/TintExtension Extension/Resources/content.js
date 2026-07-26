/**
 * AURA THEME ENGINE - Fixed Version with Memory Leak Prevention
 */

(function() {
    let currentTheme = null;
    const processedShadowRoots = new WeakSet();
    let mutationObserver = null;
    let customEventListenerAttached = false;
    // Elements we forced opaque because they are position:fixed/sticky.
    // Tracked so removeTheme() can cleanly revert them.
    const stickyModified = new Set();
    // Near-white opaque surfaces cleared by rethemeBrightSurfaces().
    const brightModified = new Set();
    // Visible dialogs / alertdialogs we forced opaque with --aura-overlay.
    const overlayModified = new Set();

    const H = (typeof AuraThemeHeuristics !== 'undefined' && AuraThemeHeuristics)
        ? AuraThemeHeuristics
        : null;
    const Split = (typeof AuraSplitTheme !== 'undefined' && AuraSplitTheme)
        ? AuraSplitTheme
        : null;
    const Resolve = (typeof AuraThemeResolve !== 'undefined' && AuraThemeResolve)
        ? AuraThemeResolve
        : null;

    let splitScrollAttached = false;
    let splitRafPending = false;
    let splitMonochromeActive = false;

    // 1. SITE-SPECIFIC OVERRIDES
    // Each entry: { match: [hostnames], css }. A site matches when the current
    // hostname equals a listed host or is a subdomain of it (suffix match), so
    // e.g. 'google.com' also covers 'www.google.com'.
    const SITE_FIXES = [
        {
            match: ['google.com'],
            css: `
                /* The universal 'a { color: link }' rule recolors the Sign-in
                   pill's text to match its own light background, making it
                   invisible. Give it a readable themed surface instead. */
                .gb_A {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }

                /* The search input has a text-fade overlay (.u4frDf) painted as
                   a white linear-gradient. The universal rule only clears
                   background-COLOR, not background-IMAGE, so this gradient
                   survives and reads as a gray/white box to the right of the
                   query text on any non-white theme. Remove the gradient. */
                .u4frDf {
                    background-image: none !important;
                }

                /* Result-area surfaces (the AI Overview panel, answer cards)
                   set their dark background with multi-class selectors that
                   out-specify the universal 'div { ...transparent }' rule, so
                   under color-scheme:dark they keep Google's own dark surface.
                   Re-assert transparency scoped to the #rso results container:
                   an ID selector out-specifies any class-only rule, so the
                   themed page background shows through instead.
                   NOTE: the AI Overview "Show more" collapse-fade renders in an
                   isolated context that page CSS cannot reach; it is a minor
                   residual and must be pinned on-device if it needs removal. */
                #rso div:not([role="dialog"]):not([role="menu"]) {
                    background-color: transparent !important;
                }
            `
        },
        {
            match: ['wikipedia.org'],
            css: `
                /* Content cards: subtle surface lift (off-white analog), NOT
                   --aura-overlay which is near-black and reads as a slab. */
                .infobox, .navbox, .sidebar, .wikitable, .metadata, .mbox, .catlinks {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                    border: 1px solid var(--aura-border) !important;
                }

                /* Section headers only (Men's, Women's, etc.). Do NOT include
                   .infobox th — row labels like Founded/Editions are also <th
                   class="infobox-label"> and must stay flush with their data. */
                .infobox-title,
                .infobox-header {
                    background: var(--aura-elevated) !important;
                    background-color: var(--aura-elevated) !important;
                    background-image: none !important;
                    color: var(--aura-text) !important;
                }
                .infobox-label {
                    color: var(--aura-muted) !important;
                    background-color: transparent !important;
                }
                .infobox-data,
                .infobox-full-data {
                    color: var(--aura-text) !important;
                    background-color: transparent !important;
                }
                .infobox a {
                    color: var(--aura-link) !important;
                }

                /* Same header treatment for tables / navboxes. */
                .wikitable th,
                .navbox-title,
                .navbox th {
                    background: var(--aura-elevated) !important;
                    background-color: var(--aura-elevated) !important;
                    background-image: none !important;
                    color: var(--aura-text) !important;
                }

                /* Search field: inputs aren't covered by universal transparency. */
                .cdx-text-input__input {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }

                /* Footer / logo tiles use Codex fake-buttons. Theming them to
                   --aura-surface left visible tinted boxes around the logos.
                   Make them seamless so icons sit directly on the page bg.
                   Multi-class selectors beat Codex's own
                   .cdx-button--fake-button--enabled { background:#fff !important }.
                   NOTE: do NOT add .minerva-icon — those are mask-image icons
                   whose white "background" IS the visible icon color. */
                .cdx-button.cdx-button--fake-button,
                .cdx-button.cdx-button--fake-button--enabled,
                .mw-footer .cdx-button,
                .mw-footer-container .cdx-button,
                .mw-footer .cdx-button.cdx-button--fake-button,
                .mw-footer-container .cdx-button.cdx-button--fake-button {
                    background: transparent !important;
                    background-color: transparent !important;
                    background-image: none !important;
                    border: none !important;
                    box-shadow: none !important;
                    color: var(--aura-text) !important;
                }

                /* Related articles (ReadMore) load asynchronously into
                   .read-more-container. Cards are <a>/<li>/summary surfaces the
                   universal div-transparency rule never reaches, so they stay
                   white without an explicit override. */
                .read-more-container,
                .read-more-container a,
                .read-more-container li,
                .read-more-container .mw-page-summary,
                .read-more-card,
                .related-pages,
                .related-pages a,
                .page-summary,
                .page-summary .content {
                    background-color: transparent !important;
                    background-image: none !important;
                    color: var(--aura-text) !important;
                    box-shadow: none !important;
                }
                .read-more-container h2,
                .read-more-container h3,
                .read-more-container p,
                .read-more-container span {
                    color: var(--aura-text) !important;
                }

                /* Leftover light Minerva surfaces. */
                .hatnote,
                .toggle-list-item {
                    background-color: transparent !important;
                    color: var(--aura-text) !important;
                }
                .last-modified-bar {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }
                .last-modified-bar a,
                .last-modified-bar span {
                    color: var(--aura-text) !important;
                }
            `
        },
        {
            match: ['amazon.com'],
            css: `
                /* Search field renders solid white; inputs aren't covered by
                   the universal transparency rule, so theme it explicitly. */
                #nav-search-keywords, .nav-input {
                    background-color: var(--aura-surface) !important;
                    color: var(--aura-text) !important;
                }
            `
        }
        // youtube.com, reddit.com and x.com/twitter.com were verified to need no
        // override: the universal transparency + sticky/fixed pass themes them
        // cleanly. Add entries here if device testing reveals site-specific issues.
    ];

    // Concatenate the CSS of every SITE_FIXES entry whose host matches.
    function getSiteFix(hostname) {
        if (Resolve) return Resolve.getSiteFix(hostname, SITE_FIXES);
        return SITE_FIXES
            .filter(entry => entry.match.some(h => hostname === h || hostname.endsWith('.' + h)))
            .map(entry => entry.css)
            .join('\n');
    }

    // Pick the theme that applies to the current page.
    // Precedence: per-site theme > time-based day/night > global theme.
    function resolveTheme(themeData) {
        if (Resolve) {
            return Resolve.resolveTheme(themeData, window.location.hostname);
        }
        if (!themeData) return null;
        const host = window.location.hostname;
        const siteTheme = themeData.siteThemes && themeData.siteThemes[host];
        if (siteTheme && siteTheme.enabled !== false) {
            return siteTheme;
        }
        const timed = resolveTimeBasedTheme(themeData.timeBasedRule);
        if (timed) return timed;
        return themeData.globalTheme || null;
    }

    function resolveTimeBasedTheme(rule) {
        if (Resolve) return Resolve.resolveTimeBasedTheme(rule);
        return null;
    }

    // 2. CORE THEME GENERATOR
    function getFullStyleSheet(theme) {
        if (!theme) return '';
        const bgColor = theme.background || '#121212';
        const textColor = theme.text || '#e0e0e0';
        // Gradient themes: soft CSS gradient. Split themes: hard diagonal with
        // --aura-split-pct updated on scroll (light wedge grows while scrolling).
        const isSplit = !!(Split && Split.isSplitTheme(theme));
        const isGradient = !isSplit && theme.backgroundType === 'gradient' && !!theme.backgroundGradient;
        const splitColors = isSplit ? Split.parseSplitColors(theme.backgroundGradient || theme) : null;
        const bgGradient = isGradient ? theme.backgroundGradient : null;
        const splitGradient = (isSplit && splitColors)
            ? Split.buildSplitGradient(splitColors.dark, splitColors.light, 'var(--aura-split-pct)')
            : null;

        const siteFix = getSiteFix(window.location.hostname);
        // Soft gradients still paint on html. Split diagonals also paint on html
        // (not ::before) so mix-blend-mode:difference can see the wedges — a
        // sibling/pseudo layer is not a valid blend backdrop on iOS Safari.
        // Viewport lock: background-size 100vw/100vh + scroll-synced position.
        const usesGradientBg = !!bgGradient;
        const bodyTransparent = !!(usesGradientBg || isSplit);
        const splitPctStart = (Split && Split.SPLIT_PCT_START) || 52;
        // White base + difference blend so glyphs invert across both wedges.
        const splitTextColor = isSplit ? '#ffffff' : textColor;

        return `
            :root {
                --aura-bg: ${bgColor};
                --aura-text: ${splitTextColor};
                --aura-link: ${theme.link || '#8ab4f8'};
                --aura-surface: rgba(255, 255, 255, 0.08);
                --aura-elevated: rgba(255, 255, 255, 0.14);
                --aura-muted: color-mix(in srgb, var(--aura-text) 65%, transparent);
                --aura-border: rgba(255, 255, 255, 0.15);
                /* Solid (no alpha) so modal sheets never glass the page. */
                --aura-overlay: color-mix(in srgb, var(--aura-bg) 82%, #000000);
                --aura-split-pct: ${splitPctStart}%;
                ${splitColors ? `--aura-split-dark: ${splitColors.dark};
                --aura-split-light: ${splitColors.light};` : ''}
            }
            html { 
                color-scheme: dark !important;
                background-color: ${bgColor} !important;
                ${isSplit && splitGradient
                    ? `background-image: ${splitGradient} !important;
                background-repeat: no-repeat !important;
                background-size: 100vw 100vh !important;
                background-attachment: scroll !important;
                background-position: 0 0 !important;`
                    : usesGradientBg
                    ? `background-image: ${bgGradient} !important;
                background-attachment: fixed !important;
                background-repeat: no-repeat !important;
                background-size: cover !important;`
                    : `background-image: none !important;
                background: ${bgColor} !important;`}
            }
            body { 
                ${bodyTransparent
                    ? `background-color: transparent !important;
                background-image: none !important;`
                    : `background-color: ${bgColor} !important;
                background: ${bgColor} !important;`}
                color: var(--aura-text) !important; 
            }
            
            /* Universal Transparency - strip container backgrounds so the
               themed html/body background shows through. Background IMAGES
               survive (only background-color is cleared); sticky/fixed bars are
               re-made opaque by reopaqueStickyFixed() so they don't bleed.
               Do NOT include a/button/input/li — that collapses CTAs and cards.
               Dialog ROOTS are excluded here and painted opaque below; their
               children stay transparent so white inner cards don't glass text. */
            :is(
                div, main, section, article, header, nav, aside,
                ul, ol, footer, figure, figcaption,
                table, thead, tbody, tfoot, tr,
                form, fieldset
            ):not([role="dialog"]):not([role="alertdialog"]):not([role="menu"]):not([aria-modal="true"]) {
                background-color: transparent !important;
            }

            /* Popups / modals: opaque sheet + themed text; children transparent
               so the sheet shows through (avoids white-on-white inner cards). */
            [role="dialog"],
            [role="alertdialog"],
            [aria-modal="true"] {
                background-color: var(--aura-overlay) !important;
                color: var(--aura-text) !important;
            }
            [role="dialog"] *:not(img):not(svg):not(video):not(canvas):not(iframe),
            [role="alertdialog"] *:not(img):not(svg):not(video):not(canvas):not(iframe),
            [aria-modal="true"] *:not(img):not(svg):not(video):not(canvas):not(iframe) {
                background-color: transparent !important;
                color: var(--aura-text) !important;
            }
            [role="dialog"] a,
            [role="alertdialog"] a,
            [aria-modal="true"] a {
                color: var(--aura-link) !important;
            }

            /* White / light fills that survive tag-based transparency.
               Exclude controls, icons, and overlay ROOTS (children may clear). */
            :is(
                [style*="background-color:#fff"],
                [style*="background-color: #fff"],
                [style*="background-color:#FFF"],
                [style*="background-color: #FFF"],
                [style*="background-color:#ffffff"],
                [style*="background-color: #ffffff"],
                [style*="background-color:#FFFFFF"],
                [style*="background-color: #FFFFFF"],
                [style*="background-color:white"],
                [style*="background-color: white"],
                [style*="background-color:rgb(255, 255, 255)"],
                [style*="background-color:rgb(255,255,255)"],
                [style*="background:#fff"],
                [style*="background: #fff"],
                [style*="background:#ffffff"],
                [style*="background: #ffffff"],
                [style*="background:#FFF"],
                [style*="background: #FFF"],
                [style*="background:#FFFFFF"],
                [style*="background: #FFFFFF"],
                [class*="bg-white"],
                [class*="bg-gray-50"],
                [class*="bg-slate-50"],
                [class*="bg-neutral-50"],
                [class*="bg-stone-50"]
            ):not(button):not([role="button"]):not(input):not(select):not(textarea):not(svg):not(img):not([class*="icon" i]):not([class*="Icon"]):not([role="dialog"]):not([role="alertdialog"]):not([role="menu"]):not([aria-modal="true"]) {
                background-color: transparent !important;
            }

            h1, h2, h3, h4, h5, h6, p, li, span, td, th, label, figcaption, dt, dd {
                color: var(--aura-text) !important;
                ${isSplit
                    ? `mix-blend-mode: difference !important;`
                    : ''}
            }
            /* Dialogs/modals: solid sheet — disable difference so text stays readable. */
            ${isSplit ? `
            [role="dialog"] :is(h1, h2, h3, h4, h5, h6, p, li, span, td, th, label, figcaption, dt, dd),
            [role="alertdialog"] :is(h1, h2, h3, h4, h5, h6, p, li, span, td, th, label, figcaption, dt, dd),
            [aria-modal="true"] :is(h1, h2, h3, h4, h5, h6, p, li, span, td, th, label, figcaption, dt, dd),
            [role="dialog"] a,
            [role="alertdialog"] a,
            [aria-modal="true"] a {
                mix-blend-mode: normal !important;
            }` : ''}
            a {
                color: ${isSplit ? '#ffffff' : 'var(--aura-link)'} !important;
                ${isSplit
                    ? `mix-blend-mode: difference !important;`
                    : 'mix-blend-mode: normal !important;'}
            }

            ${siteFix}
        `;
    }

    function updateSplitProgress() {
        if (!Split || !currentTheme || !Split.isSplitTheme(currentTheme)) return;
        const doc = document.documentElement;
        const body = document.body;
        const scrollY = window.scrollY || doc.scrollTop || 0;
        const scrollHeight = Math.max(
            body ? body.scrollHeight : 0,
            doc.scrollHeight || 0
        );
        const viewportHeight = window.innerHeight || doc.clientHeight || 0;
        const progress = Split.computeScrollProgress(scrollY, scrollHeight, viewportHeight);
        const pct = Split.scrollProgressToSplitPct(progress);
        doc.style.setProperty('--aura-split-pct', pct + '%');
        // Pin the viewport-sized gradient to the visible area without relying on
        // background-attachment:fixed (broken on iOS Safari).
        doc.style.setProperty('background-size', '100vw 100vh', 'important');
        doc.style.setProperty('background-position', '0px ' + scrollY + 'px', 'important');
    }

    function onSplitScrollOrResize() {
        if (splitRafPending) return;
        splitRafPending = true;
        requestAnimationFrame(() => {
            splitRafPending = false;
            updateSplitProgress();
        });
    }

    function attachSplitScrollListeners() {
        if (splitScrollAttached) return;
        window.addEventListener('scroll', onSplitScrollOrResize, { passive: true, capture: true });
        window.addEventListener('resize', onSplitScrollOrResize, { passive: true });
        splitScrollAttached = true;
    }

    function detachSplitScrollListeners() {
        if (!splitScrollAttached) return;
        window.removeEventListener('scroll', onSplitScrollOrResize, true);
        window.removeEventListener('resize', onSplitScrollOrResize);
        splitScrollAttached = false;
    }

    // 3. APPLY BACKGROUND DIRECTLY TO HTML/BODY
    function applyBackgroundColors(theme) {
        const bgColor = theme.background || '#121212';
        const isSplit = !!(Split && Split.isSplitTheme(theme));
        const isGradient = !isSplit && theme.backgroundType === 'gradient' && !!theme.backgroundGradient;
        const splitColors = isSplit ? Split.parseSplitColors(theme.backgroundGradient || theme) : null;
        const splitImage = (isSplit && splitColors)
            ? Split.buildSplitGradient(splitColors.dark, splitColors.light, 'var(--aura-split-pct)')
            : null;
        const imageBg = splitImage || (isGradient ? theme.backgroundGradient : null);
        const bodyTransparent = !!(imageBg || isSplit);

        // Method 1: Direct style properties (inline, so they win over site CSS)
        if (document.documentElement) {
            const de = document.documentElement.style;
            de.setProperty('background-color', bgColor, 'important');
            de.setProperty('color-scheme', 'dark', 'important');
            if (isSplit && splitColors && splitImage) {
                de.setProperty('--aura-split-dark', splitColors.dark);
                de.setProperty('--aura-split-light', splitColors.light);
                de.setProperty('background-image', splitImage, 'important');
                de.setProperty('background-repeat', 'no-repeat', 'important');
                de.setProperty('background-attachment', 'scroll', 'important');
                updateSplitProgress();
            } else if (imageBg) {
                de.setProperty('background-image', imageBg, 'important');
                de.setProperty('background-attachment', 'fixed', 'important');
                de.setProperty('background-repeat', 'no-repeat', 'important');
                de.setProperty('background-size', 'cover', 'important');
                de.removeProperty('background-position');
            } else {
                de.setProperty('background', bgColor, 'important');
                de.setProperty('background-image', 'none', 'important');
                de.removeProperty('background-position');
                de.removeProperty('background-size');
            }
        }
        
        if (document.body) {
            const bs = document.body.style;
            if (bodyTransparent) {
                // Let the html split/gradient show through the body
                bs.setProperty('background-color', 'transparent', 'important');
                bs.setProperty('background-image', 'none', 'important');
            } else {
                bs.setProperty('background-color', bgColor, 'important');
                bs.setProperty('background', bgColor, 'important');
            }
        }
        
        // Method 2: Force repaint by toggling a class
        const dummyClass = 'aura-bg-' + Date.now();
        const tempStyle = document.createElement('style');
        tempStyle.id = 'aura-temp-' + Date.now();
        tempStyle.textContent = imageBg
            ? `html.${dummyClass} { background-image: ${imageBg} !important; }`
            : `html.${dummyClass} { background-color: ${bgColor} !important; background: ${bgColor} !important; }`;
        document.head?.appendChild(tempStyle);
        document.documentElement.classList.add(dummyClass);
        
        // Clean up dummy class after repaint - use requestAnimationFrame for safer timing
        requestAnimationFrame(() => {
            document.documentElement.classList.remove(dummyClass);
            if (tempStyle && tempStyle.parentNode) {
                tempStyle.parentNode.removeChild(tempStyle);
            }
        });
    }

    // 3b. BRIGHT-SURFACE SAFETY NET
    // CSS tag/class rules lose to high-specificity or CSS-variable whites on
    // random sites. Clear only near-white opaque leftovers; never touch
    // controls, icons, media, dialogs, floating banners, or tiny tiles.
    function rethemeBrightSurfaces(root) {
        if (!root || !currentTheme || !H) return;

        let elements;
        try {
            elements = root.nodeType === 1
                ? [root, ...root.querySelectorAll('*')]
                : Array.from(root.querySelectorAll('*'));
        } catch (e) {
            return;
        }

        const MAX = 4000;
        let seen = 0;
        const vh = window.innerHeight || 0;
        const vw = window.innerWidth || 0;

        for (const el of elements) {
            if (!el || el.nodeType !== 1) continue;
            if (++seen > MAX) break;

            let style;
            try { style = getComputedStyle(el); } catch (e) { continue; }

            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { continue; }

            const mask = style.webkitMaskImage || style.maskImage;
            const overlayRoot = H.isOverlayRoot(el);
            const floatingBannerRoot = H.isFloatingBannerRoot(el, getComputedStyle, { vh, vw });

            if (H.shouldSkipBrightElement({
                tag: el.tagName,
                role: el.getAttribute('role'),
                className: typeof el.className === 'string' ? el.className : '',
                inSvg: typeof el.closest === 'function' && !!el.closest('svg'),
                mask: mask || 'none',
                visibility: style.visibility,
                opacity: style.opacity,
                width: rect.width,
                height: rect.height,
                overlayRoot,
                floatingBannerRoot,
            })) {
                continue;
            }

            const parsed = H.parseCssRgb(style.backgroundColor);
            if (!H.isNearWhiteSurface(parsed)) continue;

            el.style.setProperty('background-color', 'transparent', 'important');
            brightModified.add(el);
        }
    }

    // 3c. OVERLAY / POPUP SAFETY NET
    // Sticky pass skips dialogs (hidden cookie sheets, etc.). Visible modals
    // still need an opaque sheet so theming cannot leave them glass-like.
    function reopaqueOverlays(root) {
        if (!root || !currentTheme || !H) return;

        let candidates;
        try {
            const scope = root.nodeType === 1 ? root : document.documentElement;
            candidates = scope.querySelectorAll(
                '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
            );
            if (root.nodeType === 1 && H.isOverlayChrome(root)
                && (root.getAttribute('role') === 'dialog'
                    || root.getAttribute('role') === 'alertdialog'
                    || root.getAttribute('aria-modal') === 'true')) {
                candidates = [root, ...candidates];
            }
        } catch (e) {
            return;
        }

        for (const el of candidates) {
            if (!el || el.nodeType !== 1) continue;

            let style;
            try { style = getComputedStyle(el); } catch (e) { continue; }
            if (style.visibility === 'hidden' || style.opacity === '0') continue;

            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { continue; }
            if (rect.width < 1 || rect.height < 1) continue;

            el.style.setProperty('background-color', 'var(--aura-overlay)', 'important');
            overlayModified.add(el);
        }
    }

    // 3d. STICKY/FIXED SAFETY NET
    // The universal transparency rule (getFullStyleSheet) strips backgrounds off
    // sticky/fixed headers and bars, so page content scrolls through them. CSS
    // can't select by computed position, so re-opaque ONLY chrome-like bars here.
    // Full-viewport fixed overlays (HubSpot anchors, cookie modals, etc.) must
    // NOT be painted — doing so creates a solid theme-colored curtain over the
    // page (seen on usopen.com / wta.com) with content only peeking on overscroll.
    // Visible dialogs are handled by reopaqueOverlays instead.
    function reopaqueStickyFixed(root) {
        if (!root || !currentTheme || !H) return;

        let elements;
        try {
            elements = root.nodeType === 1
                ? [root, ...root.querySelectorAll('*')]
                : Array.from(root.querySelectorAll('*'));
        } catch (e) {
            return;
        }

        const vh = window.innerHeight || 0;
        const vw = window.innerWidth || 0;

        for (const el of elements) {
            if (!el || el.nodeType !== 1) continue;

            let style;
            try { style = getComputedStyle(el); } catch (e) { continue; }

            let rect;
            try { rect = el.getBoundingClientRect(); } catch (e) { continue; }

            const mask = style.webkitMaskImage || style.maskImage;
            if (H.shouldSkipStickyElement({
                position: style.position,
                mask: mask || 'none',
                visibility: style.visibility,
                opacity: style.opacity,
                overlayChrome: H.isOverlayChrome(el),
                width: rect.width,
                height: rect.height,
                vh,
                vw,
            })) {
                continue;
            }

            el.style.setProperty('background-color', 'var(--aura-bg)', 'important');
            stickyModified.add(el);
        }
    }

    // 4. THEME APPLICATION
    function applyTheme(theme) {
        if (!theme || theme.enabled === false) return removeTheme();
        currentTheme = theme;
        
        const bgColor = theme.background || '#121212';
        
        // Remove old style element
        const oldStyleEl = document.getElementById('aura-core-engine');
        if (oldStyleEl) {
            oldStyleEl.remove();
        }
        
        // Create and inject new style element
        const styleEl = document.createElement('style');
        styleEl.id = 'aura-core-engine';
        styleEl.textContent = getFullStyleSheet(theme);
        (document.head || document.documentElement).appendChild(styleEl);

        // Apply background colors with multiple methods (handles solid + gradient)
        applyBackgroundColors(theme);

        // Handle Shadow DOM
        handleShadowDOM(document.documentElement);

        // Clear leftover near-white surfaces, paint visible popups opaque, then
        // re-opaque sticky/fixed chrome bars (dialogs handled separately).
        rethemeBrightSurfaces(document.documentElement);
        reopaqueOverlays(document.documentElement);
        reopaqueStickyFixed(document.documentElement);

        // Scroll-linked hard diagonal for split presets.
        if (Split && Split.isSplitTheme(theme)) {
            splitMonochromeActive = Split.isMonochromeSplit(theme);
            attachSplitScrollListeners();
            updateSplitProgress();
        } else {
            splitMonochromeActive = false;
            detachSplitScrollListeners();
        }
        
        console.log("Aura: Theme applied - background:", bgColor);
    }

    function removeTheme() {
        detachSplitScrollListeners();
        splitMonochromeActive = false;
        const styleEl = document.getElementById('aura-core-engine');
        if (styleEl) styleEl.remove();
        if (document.documentElement) {
            const de = document.documentElement.style;
            de.removeProperty('background-color');
            de.removeProperty('background');
            de.removeProperty('background-image');
            de.removeProperty('background-attachment');
            de.removeProperty('background-repeat');
            de.removeProperty('background-size');
            de.removeProperty('background-position');
            de.removeProperty('color-scheme');
            de.removeProperty('--aura-split-pct');
            de.removeProperty('--aura-split-dark');
            de.removeProperty('--aura-split-light');
        }
        if (document.body) {
            document.body.style.removeProperty('background-color');
            document.body.style.removeProperty('background');
            document.body.style.removeProperty('background-image');
        }
        // Revert any sticky/fixed elements we forced opaque
        stickyModified.forEach(el => {
            try { el.style.removeProperty('background-color'); } catch (e) {}
        });
        stickyModified.clear();
        // Revert near-white surfaces we cleared
        brightModified.forEach(el => {
            try { el.style.removeProperty('background-color'); } catch (e) {}
        });
        brightModified.clear();
        // Revert dialog overlays we painted
        overlayModified.forEach(el => {
            try { el.style.removeProperty('background-color'); } catch (e) {}
        });
        overlayModified.clear();
    }

    // 5. SHADOW DOM HANDLER - Prevent duplicate style injections
    function handleShadowDOM(root) {
        if (!root) return;
        
        if (root.shadowRoot && !processedShadowRoots.has(root.shadowRoot)) {
            // Check if we already injected a style in this shadow root
            const existingStyle = root.shadowRoot.querySelector('style[data-aura-shadow]');
            if (existingStyle) {
                // Update existing style instead of adding new one
                existingStyle.textContent = getFullStyleSheet(currentTheme);
            } else {
                // Add new style only if it doesn't exist
                const style = document.createElement('style');
                style.setAttribute('data-aura-shadow', 'true');
                style.textContent = getFullStyleSheet(currentTheme);
                root.shadowRoot.appendChild(style);
            }
            processedShadowRoots.add(root.shadowRoot);
        }
        
        // Only process direct children, not all descendants
        for (let i = 0; i < root.children.length; i++) {
            const child = root.children[i];
            if (child.nodeType === 1) {
                handleShadowDOM(child);
            }
        }
    }

    // REQUEST THEME UPDATE: Ask background script to sync from App Group
    async function requestThemeUpdate() {
        try {
            console.log("Aura Content: Requesting theme update");
            
            // Ask background script to sync from App Group
            if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
                try {
                    console.log("Aura Content: Sending checkThemeUpdate to background script");
                    const response = await browser.runtime.sendMessage({ type: "checkThemeUpdate" });
                    console.log("Aura Content: Background script response:", response);
                    
                    // Wait for storage to update
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return true;
                } catch (e) {
                    console.error("Aura Content: Error sending message to background:", e);
                }
            }
            
            // Fallback: Try direct native messaging
            const freshData = await tryDirectNativeSync();
            if (freshData?.globalTheme) {
                await browser.storage.local.set({ tintThemeData: freshData });
                window.__TINT_THEME_DATA__ = freshData;
                window.__TINT_THEME_DATA__._ready = true;
                window.__TINT_THEME__ = freshData.globalTheme;
                applyTheme(freshData.globalTheme);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error("Aura Content: Error in requestThemeUpdate:", error);
            return false;
        }
    }

    // 6. MESSAGE LISTENER (fallback only)
    browser.runtime.onMessage.addListener((message) => {
        console.log("Aura Content: Message received", message);
        if (message.type === 'UPDATE_THEME' || message.type === 'THEME_UPDATED') {
            // Prefer full themeData (so we can resolve site/time-based); fall
            // back to the pre-resolved theme the background script sent.
            const themeData = message.themeData || window.__TINT_THEME_DATA__;
            if (themeData) {
                window.__TINT_THEME_DATA__ = themeData;
                window.__TINT_THEME_DATA__._ready = true;
            }
            const theme = (themeData && resolveTheme(themeData))
                || message.theme
                || message.themeData?.globalTheme;
            if (theme) {
                window.__TINT_THEME__ = theme;
                applyTheme(theme);
            }
        }
    });

    // 7. STORAGE CHANGE LISTENER - Direct application without re-fetch
    browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.tintThemeData?.newValue) {
            const newThemeData = changes.tintThemeData.newValue;
            const newTheme = resolveTheme(newThemeData);
            if (!newTheme) return;
            console.log("Aura Content: Storage changed, applying new theme");
            
            // Update coordination variables immediately
            window.__TINT_THEME_DATA__ = newThemeData;
            window.__TINT_THEME_DATA__._ready = true;
            window.__TINT_THEME__ = newTheme;
            
            // Apply theme DIRECTLY without async re-fetch
            applyTheme(newTheme);
        }
    });

    // 8. CUSTOM EVENT LISTENER - Listen for updates from injected script (attach only once)
    function attachCustomEventListener() {
        if (customEventListenerAttached) return;
        
        window.addEventListener('aura-theme-updated', (event) => {
            if (event.detail?.themeData) {
                console.log("Aura Content: Custom event received, applying theme");
                const newThemeData = event.detail.themeData;
                const newTheme = resolveTheme(newThemeData);
                if (!newTheme) return;
                
                window.__TINT_THEME_DATA__ = newThemeData;
                window.__TINT_THEME_DATA__._ready = true;
                window.__TINT_THEME__ = newTheme;
                
                applyTheme(newTheme);
            }
        });
        
        customEventListenerAttached = true;
    }

    // FALLBACK: Direct native messaging from content script
    async function tryDirectNativeSync() {
        try {
            if (!browser.runtime?.sendNativeMessage) return null;
            
            console.log("Aura Content: Trying direct native messaging");
            
            const response = await new Promise((resolve, reject) => {
                let completed = false;
                
                const timeout = setTimeout(() => {
                    if (!completed) {
                        completed = true;
                        console.warn("Aura Content: Direct native message timeout");
                        resolve(null);
                    }
                }, 2000);
                
                browser.runtime.sendNativeMessage(
                    "org.reactjs.native.example.TintApp.TintExtensionExtension.Extension",
                    { type: "getTheme" },
                    (response) => {
                        if (!completed) {
                            completed = true;
                            clearTimeout(timeout);
                            
                            if (browser.runtime.lastError) {
                                console.warn("Aura Content: Direct native message error:", browser.runtime.lastError.message);
                                resolve(null);
                            } else {
                                console.log("Aura Content: Direct native message SUCCESS");
                                resolve(response);
                            }
                        }
                    }
                );
            });
            
            if (response?.themeData?.globalTheme) {
                console.log("Aura Content: Got theme via direct native messaging");
                return response.themeData;
            }
        } catch (error) {
            console.error("Aura Content: Direct native messaging failed:", error);
        }
        
        return null;
    }

    // 9. INITIALIZATION
    async function init() {
        const data = await browser.storage.local.get('tintThemeData');
        const td = data?.tintThemeData;
        if (td) {
            const theme = resolveTheme(td);
            if (theme) {
                window.__TINT_THEME_DATA__ = td;
                window.__TINT_THEME_DATA__._ready = true;
                window.__TINT_THEME__ = theme;
                applyTheme(theme);
            }
        }

        // Attach custom event listener (only once)
        attachCustomEventListener();

        // Set up mutation observer for Shadow DOM (only once)
        if (!mutationObserver) {
            mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(m => {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            handleShadowDOM(node);
                            rethemeBrightSurfaces(node);
                            reopaqueOverlays(node);
                            reopaqueStickyFixed(node);
                        }
                    });
                });
                // Late layout growth can change scrollHeight; keep split stop in sync.
                if (Split && currentTheme && Split.isSplitTheme(currentTheme)) {
                    onSplitScrollOrResize();
                }
            });
            mutationObserver.observe(document.documentElement, { childList: true, subtree: true });
        }

        // Re-evaluate time-based day/night every minute so themes flip at
        // boundary times without waiting for a storage sync.
        setInterval(() => {
            const td = window.__TINT_THEME_DATA__;
            if (!td?.timeBasedRule?.enabled) return;
            const next = resolveTheme(td);
            if (!next) return;
            const prev = window.__TINT_THEME__;
            if (!prev
                || prev.background !== next.background
                || prev.text !== next.text
                || prev.link !== next.link
                || prev.backgroundGradient !== next.backgroundGradient) {
                window.__TINT_THEME__ = next;
                applyTheme(next);
            }
        }, 60000);
    }

    // Safari tab focus detection - request theme update
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            console.log("Aura Content: Page visible, requesting theme update");
            requestThemeUpdate();
        }
    });

    init();
    
    // CRITICAL: Immediately trigger background script to sync from App Group
    // This ensures we get fresh theme data even if background script hasn't run yet
    setTimeout(() => {
        requestThemeUpdate();
    }, 100);
})();
